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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("rural-rest-rwa", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;
  const connection = provider.connection;

  // provider 지갑에서 SOL 이체 (localnet airdrop 대체)
  const fundAccount = async (publicKey: PublicKey, lamports: number) => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: publicKey,
        lamports,
      })
    );
    await provider.sendAndConfirm(tx);
  };

  const authority = Keypair.generate();
  const investor = Keypair.generate();

  let usdcMint: PublicKey;

  // -------------------------------------------------------
  // 시나리오 A: gyeongju-001 (완판 → 배당)
  // -------------------------------------------------------
  const listingId = "gyeongju-001";
  const TOTAL_SUPPLY = new anchor.BN(10);
  const PRICE_PER_TOKEN = new anchor.BN(1_000_000); // 1 USDC
  const VALUATION_KRW = new anchor.BN(500_000_000);
  const MIN_FUNDING_BPS = 6000; // 60%

  let tokenMintKeypair: Keypair;
  let propertyToken: PublicKey;
  let investorPosition: PublicKey;
  let fundingVault: PublicKey;
  let usdcVault: PublicKey;
  let authorityUsdcAccount: PublicKey;
  let investorUsdcAccount: PublicKey;
  let investorRwaAccount: PublicKey;

  // -------------------------------------------------------
  // 시나리오 B: gyeongju-002 (deadline 3초, 환불)
  // -------------------------------------------------------
  const listingId2 = "gyeongju-002";
  const TOTAL_SUPPLY2 = new anchor.BN(100);

  let tokenMintKeypair2: Keypair;
  let propertyToken2: PublicKey;
  let investorPosition2: PublicKey;
  let fundingVault2: PublicKey;
  let usdcVault2: PublicKey;
  let investorRwaAccount2: PublicKey;

  before(async () => {
    await fundAccount(authority.publicKey, 0.5 * LAMPORTS_PER_SOL);
    await fundAccount(investor.publicKey, 0.5 * LAMPORTS_PER_SOL);

    usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);

    authorityUsdcAccount = await createAssociatedTokenAccount(
      connection, authority, usdcMint, authority.publicKey
    );
    await mintTo(connection, authority, usdcMint, authorityUsdcAccount, authority, 1_000_000_000);

    investorUsdcAccount = await createAssociatedTokenAccount(
      connection, investor, usdcMint, investor.publicKey
    );
    await mintTo(connection, authority, usdcMint, investorUsdcAccount, authority, 1_000_000_000);

    // 시나리오 A PDAs
    [propertyToken] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId)],
      program.programId
    );
    [investorPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId)],
      program.programId
    );
    usdcVault = getAssociatedTokenAddressSync(usdcMint, propertyToken, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair = Keypair.generate();

    // 시나리오 B PDAs
    [propertyToken2] = PublicKey.findProgramAddressSync(
      [Buffer.from("property"), Buffer.from(listingId2)],
      program.programId
    );
    [investorPosition2] = PublicKey.findProgramAddressSync(
      [Buffer.from("investor"), propertyToken2.toBuffer(), investor.publicKey.toBuffer()],
      program.programId
    );
    [fundingVault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("funding_vault"), Buffer.from(listingId2)],
      program.programId
    );
    usdcVault2 = getAssociatedTokenAddressSync(usdcMint, propertyToken2, true, TOKEN_PROGRAM_ID);
    tokenMintKeypair2 = Keypair.generate();
  });

  // -------------------------------------------------------
  // 1. 매물 등록 (60일 deadline)
  // -------------------------------------------------------
  it("1. initialize_property", async () => {
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 24 * 3600);

    await program.methods
      .initializeProperty(listingId, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken,
        tokenMint: tokenMintKeypair.publicKey,
        fundingVault,
        usdcVault,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair])
      .rpc();

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
  // 2. 토큰 구매 (1개, 10% 상한)
  // -------------------------------------------------------
  it("2. purchase_tokens — 1토큰 구매 성공", async () => {
    await program.methods
      .purchaseTokens(listingId, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken,
        tokenMint: tokenMintKeypair.publicKey,
        investorPosition,
        investorUsdcAccount,
        fundingVault,
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
      await program.methods
        .purchaseTokens(listingId, new anchor.BN(1))
        .accounts({
          investor: investor.publicKey,
          propertyToken,
          tokenMint: tokenMintKeypair.publicKey,
          investorPosition,
          investorUsdcAccount,
          fundingVault,
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
  // 5. 완판 → Funded 자동 전환
  // -------------------------------------------------------
  it("5. purchase_tokens — 완판 시 Funded 자동 전환", async () => {
    for (let i = 0; i < 9; i++) {
      const kp = Keypair.generate();
      await fundAccount(kp.publicKey, 0.1 * LAMPORTS_PER_SOL);

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
          fundingVault,
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
  // 6. release_funds — 완판 후 에스크로 해제
  // -------------------------------------------------------
  it("6. release_funds — 완판 후 운영자 계좌로 송금", async () => {
    const before = await connection.getTokenAccountBalance(authorityUsdcAccount);

    await program.methods
      .releaseFunds(listingId)
      .accounts({
        propertyToken,
        authority: authority.publicKey,
        fundingVault,
        authorityUsdcAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    const after = await connection.getTokenAccountBalance(authorityUsdcAccount);
    const received = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(received, 10_000_000, "10토큰 × 1 USDC = 10 USDC 수령");
    console.log("    운영자 수령:", received / 1_000_000, "USDC");
  });

  // -------------------------------------------------------
  // 7. Funded → Active
  // -------------------------------------------------------
  it("7. activate_property — Funded → Active", async () => {
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
  // 8. 월 배당 분배
  // -------------------------------------------------------
  it("8. distribute_monthly_revenue — 10 USDC 분배", async () => {
    await program.methods
      .distributeMonthlyRevenue(listingId, new anchor.BN(10_000_000))
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
    console.log("    acc_dividend_per_share =", property.accDividendPerShare.toString());
  });

  // -------------------------------------------------------
  // 9. 배당 수령 (1토큰 → 1 USDC)
  // -------------------------------------------------------
  it("9. claim_dividend — 1 USDC 수령 확인", async () => {
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
    assert.equal(received, 1_000_000);
    console.log("    수령 배당:", received / 1_000_000, "USDC");
  });

  // -------------------------------------------------------
  // 10. 중복 수령 차단
  // -------------------------------------------------------
  it("10. claim_dividend — 중복 수령 시 NoPendingDividend 에러", async () => {
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

  // ================================================================
  // 시나리오 B: 환불 (gyeongju-002, deadline 3초, 60% 미달)
  // ================================================================

  it("11. initialize_property (gyeongju-002, deadline = 3초 후)", async () => {
    const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + 3);

    await program.methods
      .initializeProperty(listingId2, TOTAL_SUPPLY2, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
      .accounts({
        authority: authority.publicKey,
        propertyToken: propertyToken2,
        tokenMint: tokenMintKeypair2.publicKey,
        fundingVault: fundingVault2,
        usdcVault: usdcVault2,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority, tokenMintKeypair2])
      .rpc();

    investorRwaAccount2 = getAssociatedTokenAddressSync(
      tokenMintKeypair2.publicKey, investor.publicKey, false, TOKEN_PROGRAM_ID
    );

    const account = await program.account.propertyToken.fetch(propertyToken2);
    assert.deepEqual(account.status, { funding: {} });
    console.log("    status = Funding, deadline = 3초 후");
  });

  it("12. purchase_tokens (gyeongju-002, 1토큰 — 60% 미달)", async () => {
    await program.methods
      .purchaseTokens(listingId2, new anchor.BN(1))
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken2,
        tokenMint: tokenMintKeypair2.publicKey,
        investorPosition: investorPosition2,
        investorUsdcAccount,
        fundingVault: fundingVault2,
        investorRwaAccount: investorRwaAccount2,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const property = await program.account.propertyToken.fetch(propertyToken2);
    assert.equal(property.tokensSold.toNumber(), 1); // 1% < 60%
    console.log("    tokens_sold = 1/100 (1%, 60% 미달)");
  });

  it("13. purchase_tokens — deadline 경과 후 FundingExpired 에러", async () => {
    await sleep(4000); // deadline 대기

    try {
      await program.methods
        .purchaseTokens(listingId2, new anchor.BN(1))
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken2,
          tokenMint: tokenMintKeypair2.publicKey,
          investorPosition: investorPosition2,
          investorUsdcAccount,
          fundingVault: fundingVault2,
          investorRwaAccount: investorRwaAccount2,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("FundingExpired 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "FundingExpired");
      console.log("    FundingExpired 에러 정상 발생");
    }
  });

  it("14. refund — 펀딩 실패 시 투자자 환불", async () => {
    const before = await connection.getTokenAccountBalance(investorUsdcAccount);

    await program.methods
      .refund(listingId2)
      .accounts({
        investor: investor.publicKey,
        propertyToken: propertyToken2,
        investorPosition: investorPosition2,
        fundingVault: fundingVault2,
        investorUsdcAccount,
        usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([investor])
      .rpc();

    const after = await connection.getTokenAccountBalance(investorUsdcAccount);
    const refunded = Number(after.value.amount) - Number(before.value.amount);
    assert.equal(refunded, 1_000_000, "1토큰 × 1 USDC = 1 USDC 환불");

    const property = await program.account.propertyToken.fetch(propertyToken2);
    assert.deepEqual(property.status, { failed: {} });
    console.log("    환불액:", refunded / 1_000_000, "USDC, status = Failed");
  });

  it("15. refund — 이미 환불 후 재시도 시 AlreadyRefunded 에러", async () => {
    try {
      await program.methods
        .refund(listingId2)
        .accounts({
          investor: investor.publicKey,
          propertyToken: propertyToken2,
          investorPosition: investorPosition2,
          fundingVault: fundingVault2,
          investorUsdcAccount,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([investor])
        .rpc();
      assert.fail("AlreadyRefunded 에러가 발생해야 함");
    } catch (e: any) {
      assert.include(e.message, "AlreadyRefunded");
      console.log("    AlreadyRefunded 에러 정상 발생");
    }
  });
});
