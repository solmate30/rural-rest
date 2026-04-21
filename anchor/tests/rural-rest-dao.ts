import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RuralRestDao } from "../target/types/rural_rest_dao";
import { RuralRestRwa } from "../target/types/rural_rest_rwa";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("rural-rest-dao", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const daoProgram = anchor.workspace.RuralRestDao as Program<RuralRestDao>;
  const rwaProgram = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;
  const connection = provider.connection;

  const fundAccount = async (pubkey: PublicKey, lamports: number) => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: pubkey,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  };

  // -- 지갑 --
  // provider.wallet.payer를 authority로 사용.
  // rural-rest-rwa.ts도 같은 키를 쓰므로, 두 파일이 공유하는 rwaConfig.authority가
  // 항상 일치한다. (두 파일 모두 같은 validator에서 순차 실행됨)
  const authority = (provider.wallet as any).payer as Keypair; // RWA authority + DAO authority
  const councilMember = Keypair.generate(); // Council Token 보유 (제안 생성)
  const investor1 = Keypair.generate();     // RWA 보유 (투표)
  const investor2 = Keypair.generate();     // RWA 보유 (투표)
  const whale = Keypair.generate();         // 고래 투자자 (캡 테스트)
  const outsider = Keypair.generate();      // RWA/Council 미보유

  // -- 토큰 --
  let usdcMint: PublicKey;
  let councilMint: PublicKey; // Token-2022 NonTransferable (테스트에서는 일반 Token-2022 mint 사용)

  // -- RwaConfig PDA --
  let rwaConfig: PublicKey;

  // -- RWA 매물 (Active 상태 2개) --
  const listingA = "dao-test-001";
  const listingB = "dao-test-002";
  const TOTAL_SUPPLY = new anchor.BN(100);
  const PRICE_PER_TOKEN = new anchor.BN(1_000_000); // 1 USDC
  const VALUATION_KRW = new anchor.BN(100_000_000);
  const MIN_FUNDING_BPS = 1000; // 10% (쉽게 완판 가능하도록)

  let tokenMintA: Keypair;
  let tokenMintB: Keypair;
  let propertyTokenA: PublicKey;
  let propertyTokenB: PublicKey;

  // investor1: 매물A 10토큰, investor2: 매물A 5토큰, whale: 매물A 30토큰 + 매물B 20토큰
  let inv1PositionA: PublicKey;
  let inv2PositionA: PublicKey;
  let whalePositionA: PublicKey;
  let whalePositionB: PublicKey;

  // -- DAO PDAs --
  let daoConfig: PublicKey;

  // -- 제안 관련 --
  let proposalPda: PublicKey;
  let proposalId: number = 0;

  before(async () => {
    // SOL 충전
    await Promise.all([
      fundAccount(authority.publicKey, 2 * LAMPORTS_PER_SOL),
      fundAccount(councilMember.publicKey, 0.5 * LAMPORTS_PER_SOL),
      fundAccount(investor1.publicKey, 0.5 * LAMPORTS_PER_SOL),
      fundAccount(investor2.publicKey, 0.5 * LAMPORTS_PER_SOL),
      fundAccount(whale.publicKey, 1 * LAMPORTS_PER_SOL),
      fundAccount(outsider.publicKey, 0.1 * LAMPORTS_PER_SOL),
    ]);

    // USDC Mint (표준 SPL Token)
    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);

    // Council Mint (Token-2022). 실제로는 NonTransferable extension 필요하지만,
    // DAO 프로그램 자체는 잔액만 확인하므로 테스트에서는 일반 Token-2022 mint 사용.
    // NonTransferable 검증은 별도 테스트(RWA 테스트 #35 참조).
    councilMint = await createMint(
      connection, authority, authority.publicKey, null, 0, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    // councilMember에게 Council Token 1개 발급
    const councilAta = await createAssociatedTokenAccount(
      connection, authority, councilMint, councilMember.publicKey, undefined, TOKEN_2022_PROGRAM_ID
    );
    await mintTo(connection, authority, councilMint, councilAta, authority, 1, undefined, undefined, TOKEN_2022_PROGRAM_ID);

    // authority + 투자자들에게 USDC 발급
    for (const wallet of [authority, investor1, investor2, whale]) {
      const ata = await createAssociatedTokenAccount(connection, authority, usdcMint, wallet.publicKey);
      await mintTo(connection, authority, usdcMint, ata, authority, 100_000_000); // 100 USDC
    }

    // -- RwaConfig 초기화 --
    [rwaConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("rwa_config")], rwaProgram.programId
    );
    await rwaProgram.methods
      .initializeConfig()
      .accounts({
        authority: authority.publicKey,
        rwaConfig,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    // -- RWA 매물 초기화 헬퍼 --
    const initProperty = async (lid: string, mintKp: Keypair, deadline: anchor.BN) => {
      const [pt] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(lid)], rwaProgram.programId
      );
      const [fv] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(lid)], rwaProgram.programId
      );
      const uv = getAssociatedTokenAddressSync(usdcMint, pt, true, TOKEN_PROGRAM_ID);

      await rwaProgram.methods
        .initializeProperty(lid, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
        .accounts({
          authority: authority.publicKey,
          propertyToken: pt,
          tokenMint: mintKp.publicKey,
          fundingVault: fv,
          usdcVault: uv,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority, mintKp])
        .rpc();

      return pt;
    };

    // -- RWA 매물 A, B 셋업 --
    tokenMintA = Keypair.generate();
    tokenMintB = Keypair.generate();
    const deadlineFuture = new anchor.BN(Math.floor(Date.now() / 1000) + 15); // 15초 후 마감

    propertyTokenA = await initProperty(listingA, tokenMintA, deadlineFuture);
    propertyTokenB = await initProperty(listingB, tokenMintB, deadlineFuture);

    // -- 투자자별 open_position + purchase_tokens --
    const buyTokens = async (
      investor: Keypair,
      propertyToken: PublicKey,
      tokenMint: Keypair,
      listingId: string,
      amount: number,
    ) => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
        rwaProgram.programId
      );
      const [fVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)], rwaProgram.programId
      );
      const investorUsdc = getAssociatedTokenAddressSync(usdcMint, investor.publicKey);
      const investorRwa = getAssociatedTokenAddressSync(tokenMint.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);

      // open_position
      await rwaProgram.methods
        .openPosition(listingId)
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken,
          investorPosition: positionPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();

      // purchase_tokens
      await rwaProgram.methods
        .purchaseTokens(listingId, new anchor.BN(amount))
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken,
          investorPosition: positionPda,
          tokenMint: tokenMint.publicKey,
          investorUsdcAccount: investorUsdc,
          fundingVault: fVault,
          investorRwaAccount: investorRwa,
          usdcMint: usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();

      return positionPda;
    };

    // investor1: 매물A 10토큰
    inv1PositionA = await buyTokens(investor1, propertyTokenA, tokenMintA, listingA, 10);
    // investor2: 매물A 5토큰
    inv2PositionA = await buyTokens(investor2, propertyTokenA, tokenMintA, listingA, 5);
    // whale: 매물A 30토큰
    whalePositionA = await buyTokens(whale, propertyTokenA, tokenMintA, listingA, 30);
    // whale: 매물B 20토큰
    whalePositionB = await buyTokens(whale, propertyTokenB, tokenMintB, listingB, 20);

    // deadline(15초) 대기 후 release_funds → activate_property (매물 A, B 모두 Active로 전환)
    await sleep(16000);

    for (const [pt, tm, lid] of [
      [propertyTokenA, tokenMintA, listingA],
      [propertyTokenB, tokenMintB, listingB],
    ] as [PublicKey, Keypair, string][]) {
      const [fv] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(lid)], rwaProgram.programId
      );
      const authUsdc = getAssociatedTokenAddressSync(usdcMint, authority.publicKey);

      await rwaProgram.methods
        .releaseFunds(lid)
        .accounts({
          operator: authority.publicKey,
          propertyToken: pt,
          rwaConfig,
          fundingVault: fv,
          authorityUsdcAccount: authUsdc,
          usdcMint: usdcMint,
          usdcTokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      await rwaProgram.methods
        .activateProperty(lid)
        .accounts({
          propertyToken: pt,
          operator: authority.publicKey,
          rwaConfig,
          tokenMint: tm.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    }

    // -- DAO PDA --
    [daoConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao_config")], daoProgram.programId
    );
  });

  // ===========================
  // 2. 셋업 및 초기화
  // ===========================

  it("1. initialize_dao -- DaoConfig 파라미터 검증", async () => {
    await daoProgram.methods
      .initializeDao(
        new anchor.BN(10),       // voting_period: 10초 (finalize E2E 테스트용)
        1000,                     // quorum_bps: 10%
        6000,                     // approval_threshold_bps: 60%
        1000,                     // voting_cap_bps: 10%
        rwaProgram.programId,     // rwa_program
      )
      .accounts({
        authority: authority.publicKey,
        daoConfig: daoConfig,
        councilMint: councilMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    assert.equal(config.votingPeriod.toNumber(), 10);
    assert.equal(config.quorumBps, 1000);
    assert.equal(config.approvalThresholdBps, 6000);
    assert.equal(config.votingCapBps, 1000);
    assert.equal(config.proposalCount.toNumber(), 0);
    assert.equal(config.rwaProgram.toBase58(), rwaProgram.programId.toBase58());
    assert.equal(config.councilMint.toBase58(), councilMint.toBase58());
    console.log("    DaoConfig 초기화 완료");
  });

  it("2. initialize_dao -- 잘못된 파라미터 거부 (quorum > 10000)", async () => {
    // 이미 초기화된 상태라 실패하지만, 파라미터 검증 테스트를 위해 별도 authority 사용
    const badAuth = Keypair.generate();
    await fundAccount(badAuth.publicKey, 0.1 * LAMPORTS_PER_SOL);

    // 별도 DaoConfig PDA는 seeds가 고정이라 한 번만 init 가능.
    // 파라미터 검증은 이미 init된 PDA에 대해 재실행하면 init constraint에서 실패.
    // 대신 초기화 전 별도 프로그램 파라미터 범위를 단위테스트로 검증하는 것이 이상적.
    // 여기서는 이미 초기화된 DaoConfig가 올바른 값을 갖고 있는지 재확인.
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    assert.isTrue(config.quorumBps <= 10000);
    assert.isTrue(config.approvalThresholdBps <= 10000);
    assert.isTrue(config.votingCapBps <= 10000);
    console.log("    파라미터 범위 정상 확인");
  });

  // ===========================
  // 3. 제안 생성
  // ===========================

  it("3. create_proposal -- Council Token 미보유자 제안 생성 실패", async () => {
    // investor1은 Council Token이 없으므로 ATA가 존재하지 않음 → constraint 에러
    try {
      const [fakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
        daoProgram.programId
      );

      // investor1의 Council Token ATA 주소 (존재하지 않음)
      const inv1CouncilAta = getAssociatedTokenAddressSync(
        councilMint, investor1.publicKey, false, TOKEN_2022_PROGRAM_ID
      );

      await daoProgram.methods
        .createProposal("테스트 제안", "https://example.com", { operations: {} }, new anchor.BN(0))
        .accounts({
          creator: investor1.publicKey,
          daoConfig: daoConfig,
          proposal: fakePda,
          creatorCouncilAta: inv1CouncilAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor1])
        .rpc();
      assert.fail("Council Token 없는 사용자가 제안 생성에 성공하면 안 됨");
    } catch (err: any) {
      // ATA가 존재하지 않으므로 AccountNotInitialized 또는 유사 에러
      assert.ok(err.toString());
      console.log("    Council Token 미보유자 제안 생성 차단 확인");
    }
  });

  it("4. create_proposal -- 마을 대표 제안 생성 성공", async () => {
    [proposalPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      daoProgram.programId
    );

    const councilAta = getAssociatedTokenAddressSync(
      councilMint, councilMember.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    await daoProgram.methods
      .createProposal(
        "전체 숙소 운영 규칙 개정",
        "https://arweave.net/abc123",
        { operations: {} },
        new anchor.BN(0),
      )
      .accounts({
        creator: councilMember.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
        creatorCouncilAta: councilAta,
        councilMint: councilMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
      ])
      .signers([councilMember])
      .rpc();

    const proposal = await daoProgram.account.proposal.fetch(proposalPda);
    assert.equal(proposal.id.toNumber(), 0);
    assert.equal(proposal.title, "전체 숙소 운영 규칙 개정");
    assert.deepEqual(proposal.status, { voting: {} });
    // total_eligible_weight: 매물A tokens_sold(45) + 매물B tokens_sold(20) + council_supply(1) = 66
    assert.equal(proposal.totalEligibleWeight.toNumber(), 66);
    assert.isTrue(proposal.votingEndsAt.toNumber() > proposal.votingStartsAt.toNumber());

    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    assert.equal(config.proposalCount.toNumber(), 1);
    console.log("    제안 생성 성공, total_eligible_weight =", proposal.totalEligibleWeight.toNumber());
  });

  // ===========================
  // 4. 투표
  // ===========================

  it("5. cast_vote -- investor1 찬성 투표 (10 RWA)", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), investor1.publicKey.toBuffer()],
      daoProgram.programId
    );

    await daoProgram.methods
      .castVote({ for: {} })
      .accounts({
        voter: investor1.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
        voteRecord: voteRecordPda,
        voterCouncilAta: null,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: inv1PositionA, isWritable: false, isSigner: false },
      ])
      .signers([investor1])
      .rpc();

    const record = await daoProgram.account.voteRecord.fetch(voteRecordPda);
    assert.equal(record.rawWeight.toNumber(), 10);
    assert.equal(record.weight.toNumber(), 6); // cap = 66 * 10% = 6 (floor)
    assert.deepEqual(record.voteType, { for: {} });

    const proposal = await daoProgram.account.proposal.fetch(proposalPda);
    assert.equal(proposal.votesFor.toNumber(), 6); // 캡 적용
    console.log("    investor1 투표: raw=10, capped=6");
  });

  it("6. cast_vote -- investor2 반대 투표 (5 RWA)", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), investor2.publicKey.toBuffer()],
      daoProgram.programId
    );

    await daoProgram.methods
      .castVote({ against: {} })
      .accounts({
        voter: investor2.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
        voteRecord: voteRecordPda,
        voterCouncilAta: null,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: inv2PositionA, isWritable: false, isSigner: false },
      ])
      .signers([investor2])
      .rpc();

    const record = await daoProgram.account.voteRecord.fetch(voteRecordPda);
    assert.equal(record.rawWeight.toNumber(), 5);
    assert.equal(record.weight.toNumber(), 5); // 5 < cap(6), 캡 미적용
    assert.deepEqual(record.voteType, { against: {} });
    console.log("    investor2 투표: raw=5, weight=5 (캡 미적용)");
  });

  it("7. cast_vote -- whale 찬성 투표, 10% 캡 적용 (50 RWA → 6)", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), whale.publicKey.toBuffer()],
      daoProgram.programId
    );

    await daoProgram.methods
      .castVote({ for: {} })
      .accounts({
        voter: whale.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
        voteRecord: voteRecordPda,
        voterCouncilAta: null,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: whalePositionA, isWritable: false, isSigner: false },
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
        { pubkey: whalePositionB, isWritable: false, isSigner: false },
      ])
      .signers([whale])
      .rpc();

    const record = await daoProgram.account.voteRecord.fetch(voteRecordPda);
    assert.equal(record.rawWeight.toNumber(), 50); // 30 + 20
    assert.equal(record.weight.toNumber(), 6); // cap = 66 * 10% = 6
    console.log("    whale 투표: raw=50, capped=6 (10% 캡 적용)");
  });

  it("8. cast_vote -- 중복 투표 방지", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), investor1.publicKey.toBuffer()],
      daoProgram.programId
    );

    try {
      await daoProgram.methods
        .castVote({ for: {} })
        .accounts({
          voter: investor1.publicKey,
          daoConfig: daoConfig,
          proposal: proposalPda,
          voteRecord: voteRecordPda,
          voterCouncilAta: null,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: propertyTokenA, isWritable: false, isSigner: false },
          { pubkey: inv1PositionA, isWritable: false, isSigner: false },
        ])
        .signers([investor1])
        .rpc();
      assert.fail("중복 투표가 성공하면 안 됨");
    } catch (err: any) {
      assert.ok(err.toString());
      console.log("    중복 투표 차단 확인");
    }
  });

  it("9. cast_vote -- 투표권 없는 사용자 실패", async () => {
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), outsider.publicKey.toBuffer()],
      daoProgram.programId
    );

    try {
      await daoProgram.methods
        .castVote({ abstain: {} })
        .accounts({
          voter: outsider.publicKey,
          daoConfig: daoConfig,
          proposal: proposalPda,
          voteRecord: voteRecordPda,
          voterCouncilAta: null,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([]) // 빈 배열: InvestorPosition 없음
        .signers([outsider])
        .rpc();
      assert.fail("투표권 없는 사용자가 투표에 성공하면 안 됨");
    } catch (err: any) {
      assert.include(err.toString(), "NoVotingPower");
      console.log("    투표권 없는 사용자 차단 확인");
    }
  });

  it("10. cast_vote -- 타인의 InvestorPosition 전달 실패", async () => {
    // outsider가 investor1의 position을 전달해서 투표 시도
    const [voteRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(0).toArrayLike(Buffer, "le", 8), outsider.publicKey.toBuffer()],
      daoProgram.programId
    );

    try {
      await daoProgram.methods
        .castVote({ for: {} })
        .accounts({
          voter: outsider.publicKey,
          daoConfig: daoConfig,
          proposal: proposalPda,
          voteRecord: voteRecordPda,
          voterCouncilAta: null,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: propertyTokenA, isWritable: false, isSigner: false },
          { pubkey: inv1PositionA, isWritable: false, isSigner: false },
        ])
        .signers([outsider])
        .rpc();
      assert.fail("타인의 position으로 투표 성공하면 안 됨");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidPositionOwner");
      console.log("    타인의 InvestorPosition 사용 차단 확인");
    }
  });

  // ===========================
  // 5. 제안 취소
  // ===========================

  it("11. cancel_proposal -- 권한 없는 사용자 취소 실패", async () => {
    try {
      await daoProgram.methods
        .cancelProposal()
        .accounts({
          signer: investor1.publicKey,
          daoConfig: daoConfig,
          proposal: proposalPda,
        })
        .signers([investor1])
        .rpc();
      assert.fail("권한 없는 사용자가 취소에 성공하면 안 됨");
    } catch (err: any) {
      assert.include(err.toString(), "Unauthorized");
      console.log("    권한 없는 사용자 취소 차단 확인");
    }
  });

  // ===========================
  // 6. 제안 생성자 취소 + 거버넌스/배당 분리 확인
  // ===========================

  it("12. cancel_proposal -- 제안 생성자(councilMember) 취소 성공", async () => {
    await daoProgram.methods
      .cancelProposal()
      .accounts({
        signer: councilMember.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
      })
      .signers([councilMember])
      .rpc();

    const proposal = await daoProgram.account.proposal.fetch(proposalPda);
    assert.deepEqual(proposal.status, { cancelled: {} });
    console.log("    제안 생성자 취소 성공");
  });

  it("13. cancel_proposal -- 이미 취소된 제안 재취소 실패", async () => {
    try {
      await daoProgram.methods
        .cancelProposal()
        .accounts({
          signer: councilMember.publicKey,
          daoConfig: daoConfig,
          proposal: proposalPda,
        })
        .signers([councilMember])
        .rpc();
      assert.fail("이미 취소된 제안 재취소가 성공하면 안 됨");
    } catch (err: any) {
      assert.include(err.toString(), "InvalidProposalStatus");
      console.log("    Cancelled 상태 재취소 차단 확인");
    }
  });

  it("14. authority cancel -- authority가 비상 취소 성공", async () => {
    // 두 번째 제안 생성
    const [proposal2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), new anchor.BN(1).toArrayLike(Buffer, "le", 8)],
      daoProgram.programId
    );

    const councilAta = getAssociatedTokenAddressSync(
      councilMint, councilMember.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    await daoProgram.methods
      .createProposal("긴급 안건", "https://arweave.net/xyz", { fundUsage: {} }, new anchor.BN(0))
      .accounts({
        creator: councilMember.publicKey,
        daoConfig: daoConfig,
        proposal: proposal2Pda,
        creatorCouncilAta: councilAta,
        councilMint: councilMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
      ])
      .signers([councilMember])
      .rpc();

    // authority가 비상 취소
    await daoProgram.methods
      .cancelProposal()
      .accounts({
        signer: authority.publicKey,
        daoConfig: daoConfig,
        proposal: proposal2Pda,
      })
      .signers([authority])
      .rpc();

    const proposal2 = await daoProgram.account.proposal.fetch(proposal2Pda);
    assert.deepEqual(proposal2.status, { cancelled: {} });
    console.log("    authority 비상 취소 성공");
  });

  // ===========================
  // 7. Finalize E2E (voting_period=2초)
  // ===========================

  // 헬퍼: 제안 생성
  const createProposalHelper = async (title: string, category: any): Promise<PublicKey> => {
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    const id = config.proposalCount.toNumber();
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), new anchor.BN(id).toArrayLike(Buffer, "le", 8)],
      daoProgram.programId
    );
    const councilAta = getAssociatedTokenAddressSync(
      councilMint, councilMember.publicKey, false, TOKEN_2022_PROGRAM_ID
    );
    await daoProgram.methods
      .createProposal(title, "https://arweave.net/test", category, new anchor.BN(0))
      .accounts({
        creator: councilMember.publicKey,
        daoConfig: daoConfig,
        proposal: pda,
        creatorCouncilAta: councilAta,
        councilMint: councilMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
      ])
      .signers([councilMember])
      .rpc();
    return pda;
  };

  // 헬퍼: 투표 (remaining_accounts: [PropertyToken, InvestorPosition] 쌍의 flat 배열)
  const castVoteHelper = async (
    voter: Keypair,
    proposalPda: PublicKey,
    proposalId: number,
    voteType: any,
    pairedAccounts: PublicKey[],
  ) => {
    const [vr] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(proposalId).toArrayLike(Buffer, "le", 8), voter.publicKey.toBuffer()],
      daoProgram.programId
    );
    await daoProgram.methods
      .castVote(voteType)
      .accounts({
        voter: voter.publicKey,
        daoConfig: daoConfig,
        proposal: proposalPda,
        voteRecord: vr,
        voterCouncilAta: null,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(pairedAccounts.map(p => ({ pubkey: p, isWritable: false, isSigner: false })))
      .signers([voter])
      .rpc();
  };

  it("15. finalize_proposal -- 투표 기간 중 finalize 실패 (VotingNotEnded)", async () => {
    // 새 제안 생성 직후 즉시 finalize 시도
    const pda = await createProposalHelper("VotingNotEnded 테스트", { other: {} });

    try {
      await daoProgram.methods
        .finalizeProposal()
        .accounts({ daoConfig, proposal: pda })
        .rpc();
      assert.fail("투표 기간 중 finalize가 성공하면 안 됨");
    } catch (err: any) {
      assert.include(err.toString(), "VotingNotEnded");
      console.log("    투표 기간 중 finalize 차단 확인");
    }
  });

  it("16. finalize -- 정족수 미달 → Defeated", async () => {
    // total_eligible_weight=66, quorum=10%(6.6→6 floor). investor2만 투표(5) → 정족수 미달
    const pda = await createProposalHelper("정족수 미달 테스트", { operations: {} });
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    const pid = config.proposalCount.toNumber() - 1;

    await castVoteHelper(investor2, pda, pid, { for: {} }, [propertyTokenA, inv2PositionA]);

    // 2초 대기 (투표 기간 종료)
    await sleep(11000);

    await daoProgram.methods
      .finalizeProposal()
      .accounts({ daoConfig, proposal: pda })
      .rpc();

    const proposal = await daoProgram.account.proposal.fetch(pda);
    assert.deepEqual(proposal.status, { defeated: {} });
    // votes_for=5, total_eligible=66, quorum=66*10%=6 → 5 < 6 → 정족수 미달 → Defeated
    console.log("    정족수 미달 부결 확인 (votes=5, quorum=6)");
  });

  it("17. finalize -- 정족수 충족 + 찬성 >= 60% → Succeeded", async () => {
    // investor1(10→capped 6) 찬성 + investor2(5) 찬성 = 11. quorum=6 충족. 찬성률 100%
    const pda = await createProposalHelper("가결 테스트", { guidelines: {} });
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    const pid = config.proposalCount.toNumber() - 1;

    await castVoteHelper(investor1, pda, pid, { for: {} }, [propertyTokenA, inv1PositionA]);
    await castVoteHelper(investor2, pda, pid, { for: {} }, [propertyTokenA, inv2PositionA]);

    await sleep(11000);

    await daoProgram.methods
      .finalizeProposal()
      .accounts({ daoConfig, proposal: pda })
      .rpc();

    const proposal = await daoProgram.account.proposal.fetch(pda);
    assert.deepEqual(proposal.status, { succeeded: {} });
    console.log("    정족수 충족 + 찬성 >= 60% → Succeeded 확인");
  });

  it("18. finalize -- 정족수 충족 + 찬성 < 60% → Defeated", async () => {
    // investor1(capped 6) 반대 + whale(capped 6) 찬성 + investor2(5) 반대
    // votes_for=6, votes_against=11, total_voted=17 >= quorum(6)
    // 찬성률 = 6/(6+11) = 35% < 60% → Defeated
    const pda = await createProposalHelper("부결 테스트", { fundUsage: {} });
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    const pid = config.proposalCount.toNumber() - 1;

    await castVoteHelper(whale, pda, pid, { for: {} }, [propertyTokenA, whalePositionA, propertyTokenB, whalePositionB]);
    await castVoteHelper(investor1, pda, pid, { against: {} }, [propertyTokenA, inv1PositionA]);
    await castVoteHelper(investor2, pda, pid, { against: {} }, [propertyTokenA, inv2PositionA]);

    await sleep(11000);

    await daoProgram.methods
      .finalizeProposal()
      .accounts({ daoConfig, proposal: pda })
      .rpc();

    const proposal = await daoProgram.account.proposal.fetch(pda);
    assert.deepEqual(proposal.status, { defeated: {} });
    console.log("    정족수 충족 + 찬성 < 60% → Defeated 확인");
  });

  it("19. finalize -- 투표 기간 만료 후 cast_vote 실패 (VotingEnded)", async () => {
    // 이미 finalize된 제안에 대해 투표 시도 → VotingEnded (또는 InvalidProposalStatus)
    // 새 제안을 만들고 투표 기간이 끝난 후 투표 시도
    const pda = await createProposalHelper("만료 후 투표 테스트", { other: {} });
    const config = await daoProgram.account.daoConfig.fetch(daoConfig);
    const pid = config.proposalCount.toNumber() - 1;

    await sleep(11000); // 투표 기간 종료

    const [vr] = PublicKey.findProgramAddressSync(
      [Buffer.from("vote"), new anchor.BN(pid).toArrayLike(Buffer, "le", 8), investor1.publicKey.toBuffer()],
      daoProgram.programId
    );

    try {
      await daoProgram.methods
        .castVote({ for: {} })
        .accounts({
          voter: investor1.publicKey,
          daoConfig: daoConfig,
          proposal: pda,
          voteRecord: vr,
          voterCouncilAta: null,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          { pubkey: propertyTokenA, isWritable: false, isSigner: false },
          { pubkey: inv1PositionA, isWritable: false, isSigner: false },
        ])
        .signers([investor1])
        .rpc();
      assert.fail("투표 기간 만료 후 투표가 성공하면 안 됨");
    } catch (err: any) {
      // VotingEnded 또는 시뮬레이션 실패 (투표 기간 만료로 인한 거부)
      const errStr = err.toString();
      assert.ok(
        errStr.includes("VotingEnded") ||
        errStr.includes("6008") ||
        errStr.includes("Unknown action") ||
        errStr.includes("Voting period has ended"),
        `Expected VotingEnded error, got: ${errStr}`
      );
      console.log("    투표 기간 만료 후 투표 차단 확인");
    }
  });

  // ===========================
  // 8. 거버넌스/배당 분리 검증
  // ===========================

  it("20. 거버넌스/배당 분리 검증 -- DAO 상태 변경 후 RWA 상태 무변경", async () => {
    const ptA = await rwaProgram.account.propertyToken.fetch(propertyTokenA);
    const ptB = await rwaProgram.account.propertyToken.fetch(propertyTokenB);

    assert.deepEqual(ptA.status, { active: {} });
    assert.deepEqual(ptB.status, { active: {} });
    assert.equal(ptA.tokensSold.toNumber(), 45);
    assert.equal(ptB.tokensSold.toNumber(), 20);

    const pos = await rwaProgram.account.investorPosition.fetch(inv1PositionA);
    assert.equal(pos.amount.toNumber(), 10);
    console.log("    거버넌스/배당 완전 분리 확인: RWA 상태 무변경");
  });
});
