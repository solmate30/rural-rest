/**
 * Localnet DAO 셋업 스크립트
 *
 * 역할:
 *   - Authority (~/.config/solana/id.json): 매물 생성, DAO 초기화, Council Token Mint Authority
 *   - Council Member (새 키페어): Council Token 보유 → 제안 생성
 *   - Investor (Phantom E2v5...): RWA 토큰 구매 → 투표
 *
 * 실행:
 *   solana-test-validator --reset
 *   cd anchor && anchor deploy --provider.cluster localnet
 *   ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-node scripts/setup-localnet.ts
 */

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
import * as fs from "fs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ========== 설정 ==========
const INVESTOR_WALLET = new PublicKey("E2v5Fg9vd2MDejT2u6X13Rxoc6B2YCnPiWgf7iMtWkSt");
const VILLAGE_WALLET = new PublicKey("DQtCUoiE8LoQfVUBrm5NJUFnVrSEeumwLLTnKZRVifLn");
const LISTING_ID = "gyeongju-001";
const TOTAL_SUPPLY = new anchor.BN(100);
const PRICE_PER_TOKEN = new anchor.BN(1_000_000); // 1 USDC
const VALUATION_KRW = new anchor.BN(100_000_000);
const MIN_FUNDING_BPS = 1000; // 10%
const FUNDING_DEADLINE_SECS = 10;

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const daoProgram = anchor.workspace.RuralRestDao as Program<RuralRestDao>;
  const rwaProgram = anchor.workspace.RuralRestRwa as Program<RuralRestRwa>;
  const connection = provider.connection;
  const authority = (provider.wallet as anchor.Wallet).payer;

  console.log("=== Localnet DAO 셋업 시작 ===");
  console.log();
  console.log("지갑 역할:");
  console.log(`  Authority (관리자): ${authority.publicKey.toBase58()}`);
  console.log(`  마을 대표:          ${VILLAGE_WALLET.toBase58()}`);
  console.log(`  투자자:             ${INVESTOR_WALLET.toBase58()}`);
  console.log();

  // 1. SOL 에어드롭
  console.log("1. SOL 충전...");
  const airdropInv = await connection.requestAirdrop(INVESTOR_WALLET, 5 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdropInv);
  const airdropVil = await connection.requestAirdrop(VILLAGE_WALLET, 5 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdropVil);
  console.log("   투자자: 5 SOL");
  console.log("   마을 대표: 5 SOL");

  // 2. USDC Mint 생성
  console.log("2. USDC Mint 생성...");
  const usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);
  console.log(`   ${usdcMint.toBase58()}`);

  // 3. Council Token Mint 생성 (Token-2022)
  console.log("3. Council Token Mint 생성 (Token-2022)...");
  const councilMint = await createMint(
    connection, authority, authority.publicKey, null, 0, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  console.log(`   ${councilMint.toBase58()}`);

  // 4. Investor에게 USDC 발급
  console.log("4. Investor에게 USDC 발급...");
  const investorUsdcAta = await createAssociatedTokenAccount(
    connection, authority, usdcMint, INVESTOR_WALLET
  );
  await mintTo(connection, authority, usdcMint, investorUsdcAta, authority, 100_000_000);
  console.log("   100 USDC");

  // 5. RWA 매물 초기화
  console.log(`5. RWA 매물 초기화 (${LISTING_ID})...`);
  const tokenMintKp = Keypair.generate();
  const deadline = new anchor.BN(Math.floor(Date.now() / 1000) + FUNDING_DEADLINE_SECS);

  const [propertyToken] = PublicKey.findProgramAddressSync(
    [Buffer.from("property"), Buffer.from(LISTING_ID)], rwaProgram.programId
  );
  const [fundingVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("funding_vault"), Buffer.from(LISTING_ID)], rwaProgram.programId
  );
  const usdcVault = getAssociatedTokenAddressSync(usdcMint, propertyToken, true, TOKEN_PROGRAM_ID);

  await (rwaProgram.methods as any)
    .initializeProperty(LISTING_ID, TOTAL_SUPPLY, VALUATION_KRW, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
    .accounts({
      authority: authority.publicKey,
      propertyToken,
      tokenMint: tokenMintKp.publicKey,
      fundingVault,
      usdcVault,
      usdcMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority, tokenMintKp])
    .rpc();
  console.log(`   PropertyToken: ${propertyToken.toBase58()}`);

  // 6. Investor로 RWA 토큰 구매 (별도 키페어 사용, 나중에 웹 UI에서도 가능)
  // Investor는 외부 지갑(Phantom)이라 서명 불가 → 별도 키페어로 구매
  const investorKp = Keypair.generate();
  console.log("6. 별도 투자자로 RWA 토큰 구매 (20개)...");

  const fundInvTx = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: investorKp.publicKey,
      lamports: 0.5 * LAMPORTS_PER_SOL,
    })
  );
  await provider.sendAndConfirm(fundInvTx);

  const invKpUsdcAta = await createAssociatedTokenAccount(
    connection, authority, usdcMint, investorKp.publicKey
  );
  await mintTo(connection, authority, usdcMint, invKpUsdcAta, authority, 100_000_000);

  const [invPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), propertyToken.toBuffer(), investorKp.publicKey.toBuffer()],
    rwaProgram.programId
  );
  const invRwaAta = getAssociatedTokenAddressSync(
    tokenMintKp.publicKey, investorKp.publicKey, false, TOKEN_2022_PROGRAM_ID
  );

  await (rwaProgram.methods as any)
    .openPosition(LISTING_ID)
    .accounts({
      investor: investorKp.publicKey,
      propertyToken,
      investorPosition: invPosition,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([investorKp])
    .rpc();

  await (rwaProgram.methods as any)
    .purchaseTokens(LISTING_ID, new anchor.BN(20))
    .accounts({
      investor: investorKp.publicKey,
      propertyToken,
      investorPosition: invPosition,
      tokenMint: tokenMintKp.publicKey,
      investorUsdcAccount: invKpUsdcAta,
      fundingVault,
      investorRwaAccount: invRwaAta,
      usdcMint,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([investorKp])
    .rpc();
  console.log(`   ${investorKp.publicKey.toBase58().slice(0, 8)}... 20 RWA 토큰 구매 완료`);

  // 7. Deadline 대기 + release_funds + activate
  console.log(`7. Funding deadline 대기 (${FUNDING_DEADLINE_SECS + 2}초)...`);
  await sleep((FUNDING_DEADLINE_SECS + 2) * 1000);

  const authUsdcAta = await createAssociatedTokenAccount(
    connection, authority, usdcMint, authority.publicKey
  );

  console.log("   release_funds...");
  await (rwaProgram.methods as any)
    .releaseFunds(LISTING_ID)
    .accounts({
      authority: authority.publicKey,
      propertyToken,
      fundingVault,
      authorityUsdcAccount: authUsdcAta,
      usdcMint,
      usdcTokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
  console.log("   Funding -> Funded");

  console.log("   activate_property...");
  await (rwaProgram.methods as any)
    .activateProperty(LISTING_ID)
    .accounts({
      authority: authority.publicKey,
      propertyToken,
      tokenMint: tokenMintKp.publicKey,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([authority])
    .rpc();
  console.log("   Funded -> Active");

  // 8. DAO 초기화
  console.log("8. DAO 초기화...");
  const [daoConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("dao_config")], daoProgram.programId
  );

  await (daoProgram.methods as any)
    .initializeDao(
      new anchor.BN(604800),   // voting_period: 7일
      1000,                     // quorum_bps: 10%
      6000,                     // approval_threshold_bps: 60%
      1000,                     // voting_cap_bps: 10%
      rwaProgram.programId,
    )
    .accounts({
      authority: authority.publicKey,
      daoConfig,
      councilMint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([authority])
    .rpc();
  console.log(`   DaoConfig: ${daoConfig.toBase58()}`);

  // 9. 마을 대표에게 Council Token 발급
  console.log("9. 마을 대표에게 Council Token 발급...");
  const villageCouncilAta = await createAssociatedTokenAccount(
    connection, authority, councilMint, VILLAGE_WALLET, undefined, TOKEN_2022_PROGRAM_ID
  );
  await mintTo(
    connection, authority, councilMint, villageCouncilAta, authority, 1,
    undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  console.log("   Council Token 1개 발급 완료");

  // 완료
  console.log();
  console.log("==========================================");
  console.log("  셋업 완료");
  console.log("==========================================");
  console.log();
  console.log("[ 마을 대표 ] -- 제안 생성");
  console.log(`  주소: ${VILLAGE_WALLET.toBase58()}`);
  console.log(`  SOL: 5 / Council Token: 1`);
  console.log();
  console.log("[ 투자자 ] -- 투표");
  console.log(`  주소: ${INVESTOR_WALLET.toBase58()}`);
  console.log(`  SOL: 5 / USDC: 100 (웹 UI에서 RWA 구매 후 투표)`);
  console.log();
  console.log("[ 별도 투자자 (스크립트 생성) ] -- 투표 가능");
  console.log(`  주소: ${investorKp.publicKey.toBase58()}`);
  console.log(`  RWA Token: 20`);
  console.log();
  console.log("테스트 순서:");
  console.log("  1. Phantom에서 마을 대표 계정으로 전환 → /governance/new → 제안 생성");
  console.log("  2. Phantom에서 투자자 계정으로 전환 → /invest에서 RWA 구매 → 투표");
  console.log();
  console.log("주요 주소:");
  console.log(`  USDC Mint:     ${usdcMint.toBase58()}`);
  console.log(`  Council Mint:  ${councilMint.toBase58()}`);
  console.log(`  RWA Token Mint: ${tokenMintKp.publicKey.toBase58()}`);
  console.log(`  PropertyToken: ${propertyToken.toBase58()}`);
  console.log(`  DaoConfig:     ${daoConfig.toBase58()}`);
}

main().catch((err) => {
  console.error("셋업 실패:", err);
  process.exit(1);
});
