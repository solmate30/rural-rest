import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RuralRestRwa } from "../target/types/rural_rest_rwa";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("rural-rest-rwa", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;
  const connection = provider.connection;

  // 테스트 참여자
  const authority = Keypair.generate();
  const investor = Keypair.generate();

  // 테스트용 USDC 민트
  let usdcMint: PublicKey;
  let tokenMintKeypair: Keypair;

  const listingId = "gyeongju-001";
  const TOTAL_SUPPLY = new anchor.BN(10);           // 총 10토큰 (10% cap = 1토큰/투자자)
  const PRICE_PER_TOKEN = new anchor.BN(1_000_000); // 1 USDC
  const VALUATION_KRW = new anchor.BN(500_000_000);

  let propertyToken: PublicKey;
  let investorPosition: PublicKey;
  let usdcVault: PublicKey;
  let authorityUsdcAccount: PublicKey;
  let investorUsdcAccount: PublicKey;
  let investorRwaAccount: PublicKey;

  // -------------------------------------------------------
  // 셋업: 에어드랍, USDC 민트, 계좌, PDA 계산
  // -------------------------------------------------------
  before(async () => {
    const airdropA = await connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    const airdropI = await connection.requestAirdrop(investor.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropA);
    await connection.confirmTransaction(airdropI);

    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);

    authorityUsdcAccount = await createAssociatedTokenAccount(
      connection, authority, usdcMint, authority.publicKey
    );
    await mintTo(connection, authority, usdcMint, authorityUsdcAccount, authority, 1_000_000_000);

    investorUsdcAccount = await createAssociatedTokenAccount(
      connection, investor, usdcMint, investor.publicKey
    );
    await mintTo(connection, authority, usdcMint, investorUsdcAccount, authority, 1_000_000_000);

    [propertyToken] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId)],
      program.programId
    );
    [investorPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    usdcVault = getAssociatedTokenAddressSync(usdcMint, propertyToken, true, TOKEN_PROGRAM_ID);
    investorRwaAccount = getAssociatedTokenAddressSync(
      tokenMintKeypair ? tokenMintKeypair.publicKey : PublicKey.default,
      investor.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );
    tokenMintKeypair = Keypair.generate();
  });

  // -------------------------------------------------------
  // 1. 매물 등록
  // -------------------------------------------------------
  it("1. initialize_property", async () => {
    await program.methods
      .initializeProperty(listingId, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN)
      .accounts({
        authority: authority.publicKey,
        propertyToken,
        tokenMint: tokenMintKeypair.publicKey,
        usdcVault,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair])
      .rpc();

    // investorRwaAccount는 tokenMint 확정 후 계산
    investorRwaAccount = getAssociatedTokenAddressSync(
      tokenMintKeypair.publicKey, investor.publicKey, false, TOKEN_PROGRAM_ID
    );

    const account = await program.account.propertyToken.fetch(propertyToken);
    assert.equal(account.listingId, listingId);
    assert.equal(account.totalSupply.toNumber(), 10);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    status =", JSON.stringify(account.status));
  });

  // -------------------------------------------------------
  // 2. 토큰 구매 (정상 — 1개, 10% 상한 정확히)
  // -------------------------------------------------------
  it("2. purchase_tokens — 1토큰 구매 성공 (10% 상한)", async () => {
    await program.methods
      .purchaseTokens(listingId, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        tokenMint: tokenMintKeypair.publicKey,
        investorPosition,
        investorUsdcAccount,
        authorityUsdcAccount,
        investorRwaAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const pos = await program.account.investorPosition.fetch(investorPosition);
    assert.equal(pos.amount.toNumber(), 1);
    console.log("    InvestorPosition.amount =", pos.amount.toNumber());
  });

  // -------------------------------------------------------
  // 3. 10% 상한 초과 → 실패
  // -------------------------------------------------------
  it("3. purchase_tokens — 10% 상한 초과 시 실패", async () => {
    try {
      // 이미 1개 보유. 1개 추가 → 합계 2 > 상한(1) 초과
      await program.methods
        .purchaseTokens(listingId, new anchor.BN(1))
        .accounts({
          investor: investor.publicKey,
          propertyToken,
          tokenMint: tokenMintKeypair.publicKey,
          investorPosition,
          investorUsdcAccount,
          authorityUsdcAccount,
          investorRwaAccount,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("ExceedsInvestorCap 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "ExceedsInvestorCap");
      console.log("    ExceedsInvestorCap 에러 정상 발생");
    }
  });

  // -------------------------------------------------------
  // 4. Funding 상태에서 activate → 실패
  // -------------------------------------------------------
  it("4. activate_property — Funding 상태에서 호출 시 실패", async () => {
    try {
      await program.methods
        .activateProperty(listingId)
        .accounts({ propertyToken, authority: authority.publicKey })
        .signers([authority])
        .rpc();
      assert.fail("InvalidStatus 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "InvalidStatus");
      console.log("    InvalidStatus 에러 정상 발생");
    }
  });

  // -------------------------------------------------------
  // 5. 완판 (투자자 9명 추가) → Funded 자동 전환
  // -------------------------------------------------------
  it("5. purchase_tokens — 완판 시 Funded 자동 전환", async () => {
    // investor가 이미 1개 보유. 나머지 9개를 새 투자자 9명이 각 1개씩 구매
    for (let i = 0; i < 9; i++) {
      const kp = Keypair.generate();
      const airdrop = await connection.requestAirdrop(kp.publicKey, 3 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(airdrop);

      const kpUsdc = await createAssociatedTokenAccount(connection, authority, usdcMint, kp.publicKey);
      await mintTo(connection, authority, usdcMint, kpUsdc, authority, 10_000_000);

      const [kpPos] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), kp.publicKey.toBuffer()],
        program.programId
      );
      const kpRwa = getAssociatedTokenAddressSync(
        tokenMintKeypair.publicKey, kp.publicKey, false, TOKEN_PROGRAM_ID
      );

      await program.methods
        .purchaseTokens(listingId, new anchor.BN(1))
        .accounts({
          investor: kp.publicKey,
          propertyToken,
          tokenMint: tokenMintKeypair.publicKey,
          investorPosition: kpPos,
          investorUsdcAccount: kpUsdc,
          authorityUsdcAccount,
          investorRwaAccount: kpRwa,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([kp])
        .rpc();
    }

    const property = await program.account.propertyToken.fetch(propertyToken);
    assert.equal(property.tokensSold.toNumber(), 10);
    assert.deepEqual(property.status, { funded: {} });
    console.log("    tokens_sold = 10/10, status = Funded");
  });

  // -------------------------------------------------------
  // 6. Funded → Active
  // -------------------------------------------------------
  it("6. activate_property — Funded → Active", async () => {
    await program.methods
      .activateProperty(listingId)
      .accounts({ propertyToken, authority: authority.publicKey })
      .signers([authority])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken);
    assert.deepEqual(property.status, { active: {} });
    console.log("    status = Active");
  });

  // -------------------------------------------------------
  // 7. 월 배당 분배
  // -------------------------------------------------------
  it("7. distribute_monthly_revenue — 10 USDC 분배", async () => {
    const NET_REVENUE = new anchor.BN(10_000_000); // 10 USDC

    await program.methods
      .distributeMonthlyRevenue(listingId, NET_REVENUE)
      .accounts({
        propertyToken,
        authority: authority.publicKey,
        authorityUsdcAccount,
        usdcVault,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken);
    assert.isTrue(property.accDividendPerShare.gtn(0));
    // 10 USDC / 10토큰 = 1 USDC/토큰
    console.log("    acc_dividend_per_share =", property.accDividendPerShare.toString());
  });

  // -------------------------------------------------------
  // 8. 배당 수령 (investor: 1토큰 보유 → 1 USDC 수령)
  // -------------------------------------------------------
  it("8. claim_dividend — 1 USDC 수령 확인", async () => {
    const before = await connection.getTokenAccountBalance(investorUsdcAccount);

    await program.methods
      .claimDividend(listingId)
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        investorPosition,
        usdcVault,
        investorUsdcAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const after = await connection.getTokenAccountBalance(investorUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(received, 1_000_000, "1토큰 보유 → 1 USDC 수령");
    console.log("    수령 배당:", received / 1_000_000, "USDC");
  });

  // -------------------------------------------------------
  // 9. 중복 수령 차단
  // -------------------------------------------------------
  it("9. claim_dividend — 중복 수령 시 NoPendingDividend 에러", async () => {
    try {
      await program.methods
        .claimDividend(listingId)
        .accounts({
          investor: investor.publicKey,
          propertyToken,
          investorPosition,
          usdcVault,
          investorUsdcAccount,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("NoPendingDividend 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "NoPendingDividend");
      console.log("    NoPendingDividend 에러 정상 발생");
    }
  });
});
