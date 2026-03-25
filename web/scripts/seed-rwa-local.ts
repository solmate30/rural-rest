/**
 * 로컬 온체인 RWA 테스트 세팅 스크립트
 *
 * 사전 준비:
 *   1. solana-test-validator --reset (별도 터미널)
 *   2. cd anchor && anchor build && anchor deploy --provider.cluster localnet
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/seed-rwa-local.ts
 *
 * 실행 후 앱 시작:
 *   VITE_SOLANA_RPC=http://localhost:8899 VITE_USDC_MINT=<출력된 민트> npm run dev
 *
 * Phantom 임포트:
 *   scripts/investor-keypair.json 파일을 Phantom에 임포트
 *   네트워크: localhost:8899 (Custom RPC)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
} from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program, BN, Wallet } from "@coral-xyz/anchor";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from "../app/db/schema";
import IDL from "../app/anchor-idl/rural_rest_rwa.json";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 설정 ─────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.VITE_SOLANA_RPC ?? "http://localhost:8899";
const PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const LISTING_ID = "seed-listing-gyeongju-3000";
const RWA_TOKEN_DB_ID = "seed-rwa-gyeongju-3000";

// 테스트용 소규모 설정 (완판 → release → activate 플로우 확인)
const TOTAL_SUPPLY = 100;          // 작게 설정
const VALUATION_KRW = 500_000_000;
const PRICE_PER_TOKEN_USDC = 3_704;
const MIN_FUNDING_BPS = 0;         // 테스트: 최소 판매율 0% (즉시 release 가능)
const PURCHASE_TOKEN_COUNT = 10;   // 10% 이하 (투자자 1인 상한)

// distribute 테스트용 수익: 100 USDC
const TEST_REVENUE_USDC = 100_000_000; // micro-USDC

// investor keypair 저장 경로
const INVESTOR_KEYPAIR_PATH = path.join(__dirname, "investor-keypair.json");

// ── DB 연결 ──────────────────────────────────────────────────────────────────

const client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// ── 지갑 로드 ────────────────────────────────────────────────────────────────

function loadKeypair(filePath: string): Keypair {
    const raw = fs.readFileSync(filePath, "utf-8");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function getDefaultWallet(): Keypair {
    const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
    if (fs.existsSync(defaultPath)) return loadKeypair(defaultPath);
    const kp = Keypair.generate();
    fs.mkdirSync(path.dirname(defaultPath), { recursive: true });
    fs.writeFileSync(defaultPath, JSON.stringify(Array.from(kp.secretKey)));
    console.log(`새 지갑 생성: ${defaultPath}`);
    return kp;
}

// ── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔗 RPC: ${RPC_URL}`);
    const connection = new Connection(RPC_URL, "confirmed");

    // ── 1. 지갑 준비 ────────────────────────────────────────────────────────
    const payer = getDefaultWallet();

    // investor keypair: 파일이 있으면 재사용, 없으면 생성 후 저장
    let investor: Keypair;
    if (fs.existsSync(INVESTOR_KEYPAIR_PATH)) {
        investor = loadKeypair(INVESTOR_KEYPAIR_PATH);
        console.log(`♻️  기존 investor keypair 재사용: ${INVESTOR_KEYPAIR_PATH}`);
    } else {
        investor = Keypair.generate();
        fs.writeFileSync(INVESTOR_KEYPAIR_PATH, JSON.stringify(Array.from(investor.secretKey)));
        console.log(`💾 investor keypair 저장: ${INVESTOR_KEYPAIR_PATH}`);
    }

    console.log(`\n👛 Payer:    ${payer.publicKey.toBase58()}`);
    console.log(`👛 Investor: ${investor.publicKey.toBase58()}`);

    // ── 2. SOL 에어드롭 ─────────────────────────────────────────────────────
    console.log("\n💧 SOL 에어드롭 중...");
    await airdrop(connection, payer.publicKey, 10);
    await airdrop(connection, investor.publicKey, 2);
    console.log("✓ Payer 10 SOL, Investor 2 SOL");

    // ── 3. 가짜 USDC 민트 생성 ──────────────────────────────────────────────
    console.log("\n🪙 로컬 USDC 민트 생성 중...");
    const usdcMint = await createMint(
        connection, payer, payer.publicKey, null, 6,
        undefined, undefined, TOKEN_PROGRAM_ID,
    );
    console.log(`✓ USDC Mint: ${usdcMint.toBase58()}`);

    // ── 4. 투자자 USDC 충전 ─────────────────────────────────────────────────
    console.log("\n💵 투자자 USDC 충전 중...");
    const investorUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, investor.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID,
    );
    const usdcForPurchase = PURCHASE_TOKEN_COUNT * PRICE_PER_TOKEN_USDC + 1_000_000;
    await mintTo(connection, payer, usdcMint, investorUsdcAccount.address, payer, usdcForPurchase, [], undefined, TOKEN_PROGRAM_ID);
    console.log(`✓ 투자자 USDC: ${(usdcForPurchase / 1_000_000).toFixed(4)} USDC`);

    // Payer USDC 충전 (distribute_monthly_revenue 에 사용)
    const payerUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, payer.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID,
    );
    await mintTo(connection, payer, usdcMint, payerUsdcAccount.address, payer, TEST_REVENUE_USDC + 1_000_000, [], undefined, TOKEN_PROGRAM_ID);
    console.log(`✓ Payer USDC: ${((TEST_REVENUE_USDC + 1_000_000) / 1_000_000).toFixed(2)} USDC (distribute용)`);

    // ── 5. Anchor 프로그램 연결 ──────────────────────────────────────────────
    const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
    const program = new Program(IDL as any, provider);

    // ── 6. initialize_property ──────────────────────────────────────────────
    console.log(`\n🏠 initialize_property 호출 중...`);
    const tokenMintKp = Keypair.generate();
    // 마감일을 8초 후로 설정 → purchase 후 대기하면 release_funds 가능
    const fundingDeadlineTs = Math.floor(Date.now() / 1000) + 8;

    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(LISTING_ID)], PROGRAM_ID,
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(LISTING_ID)], PROGRAM_ID,
    );
    const [usdcVault] = PublicKey.findProgramAddressSync(
        [propertyToken.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), usdcMint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM,
    );

    const initTx = await program.methods
        .initializeProperty(
            LISTING_ID,
            new BN(TOTAL_SUPPLY),
            new BN(VALUATION_KRW),
            new BN(PRICE_PER_TOKEN_USDC),
            new BN(fundingDeadlineTs),
            MIN_FUNDING_BPS,
        )
        .accounts({
            authority: payer.publicKey,
            propertyToken,
            tokenMint: tokenMintKp.publicKey,
            fundingVault,
            usdcVault,
            usdcMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
            systemProgram: SystemProgram.programId,
        })
        .signers([tokenMintKp])
        .rpc();
    console.log(`✓ Token Mint: ${tokenMintKp.publicKey.toBase58()}`);
    console.log(`  TX: ${initTx}`);

    // ── 7. purchase_tokens ──────────────────────────────────────────────────
    console.log(`\n🛒 purchase_tokens 호출 중... (${PURCHASE_TOKEN_COUNT} tokens)`);
    const [investorPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
        PROGRAM_ID,
    );
    const investorRwaAccount = getAssociatedTokenAddressSync(
        tokenMintKp.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID,
    );
    const purchaseTx = await program.methods
        .purchaseTokens(LISTING_ID, new BN(PURCHASE_TOKEN_COUNT))
        .accounts({
            investor: investor.publicKey,
            propertyToken,
            tokenMint: tokenMintKp.publicKey,
            investorPosition,
            investorUsdcAccount: investorUsdcAccount.address,
            fundingVault,
            investorRwaAccount,
            usdcMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([investor])
        .rpc();
    console.log(`✓ 구매 완료  TX: ${purchaseTx}`);

    // ── 8. release_funds (마감 경과 대기 후 호출) ────────────────────────────
    console.log(`\n⏳ 마감일 경과 대기 중... (10초)`);
    await new Promise((r) => setTimeout(r, 10_000));
    console.log(`🔓 release_funds 호출 중...`);
    const releaseTx = await program.methods
        .releaseFunds(LISTING_ID)
        .accounts({
            propertyToken,
            authority: payer.publicKey,
            fundingVault,
            authorityUsdcAccount: payerUsdcAccount.address,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
            systemProgram: SystemProgram.programId,
        })
        .rpc();
    console.log(`✓ 펀딩 완료  TX: ${releaseTx}`);

    // ── 9. activate_property (Funded → Active) ───────────────────────────────
    console.log(`\n⚡ activate_property 호출 중...`);
    const activateTx = await program.methods
        .activateProperty(LISTING_ID)
        .accounts({
            propertyToken,
            authority: payer.publicKey,
            tokenMint: tokenMintKp.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
    console.log(`✓ Active 전환  TX: ${activateTx}`);

    // ── 10. distribute_monthly_revenue (vault에 USDC 채우기) ─────────────────
    console.log(`\n📊 distribute_monthly_revenue 호출 중... (${TEST_REVENUE_USDC / 1_000_000} USDC)`);
    const distributeTx = await program.methods
        .distributeMonthlyRevenue(LISTING_ID, new BN(TEST_REVENUE_USDC))
        .accounts({
            propertyToken,
            authority: payer.publicKey,
            authorityUsdcAccount: payerUsdcAccount.address,
            usdcVault,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
            systemProgram: SystemProgram.programId,
        })
        .rpc();
    console.log(`✓ 배당 분배  TX: ${distributeTx}`);

    // ── 11. DB 업데이트 ──────────────────────────────────────────────────────
    console.log("\n💾 DB 업데이트 중...");
    const now = new Date();

    // 기존 스크립트 데이터 정리
    await db.delete(schema.rwaInvestments);
    await db.delete(schema.rwaDividends);
    await db.delete(schema.operatorSettlements);
    await db.delete(schema.localGovSettlements);
    console.log("✓ 기존 스크립트 데이터 정리 완료");

    // rwaTokens 업데이트
    await db.update(schema.rwaTokens)
        .set({
            tokenMint: tokenMintKp.publicKey.toBase58(),
            status: "active",
            tokensSold: PURCHASE_TOKEN_COUNT,
            fundingDeadline: new Date(fundingDeadlineTs * 1000),
            updatedAt: now,
        })
        .where(sql`${schema.rwaTokens.id} = ${RWA_TOKEN_DB_ID}`);
    console.log(`✓ rwaTokens → active`);

    // 투자 내역 저장
    const investedUsdc = PURCHASE_TOKEN_COUNT * PRICE_PER_TOKEN_USDC;
    await db.insert(schema.rwaInvestments).values({
        id: `local-inv-${Date.now()}`,
        walletAddress: investor.publicKey.toBase58(),
        rwaTokenId: RWA_TOKEN_DB_ID,
        tokenAmount: PURCHASE_TOKEN_COUNT,
        investedUsdc,
        purchaseTx,
    }).onConflictDoNothing();
    console.log(`✓ rwaInvestments 저장`);

    // 배당 기록 (미수령 상태로)
    const dividendUsdc = Math.floor((PURCHASE_TOKEN_COUNT / TOTAL_SUPPLY) * TEST_REVENUE_USDC);
    await db.insert(schema.rwaDividends).values({
        id: `div-${RWA_TOKEN_DB_ID}-test-${investor.publicKey.toBase58().slice(0, 8)}`,
        walletAddress: investor.publicKey.toBase58(),
        rwaTokenId: RWA_TOKEN_DB_ID,
        month: "2026-03",
        dividendUsdc,
        createdAt: now,
    }).onConflictDoNothing();
    console.log(`✓ rwaDividends 저장 (${(dividendUsdc / 1_000_000).toFixed(4)} USDC, 미수령)`);

    // ── 완료 ────────────────────────────────────────────────────────────────
    console.log("\n✅ 로컬 테스트 세팅 완료!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 온체인 정보:");
    console.log(`  USDC Mint:    ${usdcMint.toBase58()}`);
    console.log(`  Token Mint:   ${tokenMintKp.publicKey.toBase58()}`);
    console.log(`  Investor:     ${investor.publicKey.toBase58()}`);
    console.log(`  배당 (미수령): ${(dividendUsdc / 1_000_000).toFixed(4)} USDC`);
    console.log("\n🦊 Phantom 설정:");
    console.log(`  1. 네트워크 → Custom RPC → http://localhost:8899`);
    console.log(`  2. 지갑 임포트 → ${INVESTOR_KEYPAIR_PATH}`);
    console.log("\n🌏 앱 실행:");
    console.log(`  VITE_SOLANA_RPC=http://localhost:8899 VITE_USDC_MINT=${usdcMint.toBase58()} npm run dev`);
    console.log("\n🔍 Claim 페이지:");
    console.log(`  http://localhost:5173/my-investments?wallet=${investor.publicKey.toBase58()}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}

main().catch((err) => {
    console.error("\n❌ 에러:", err.message ?? err);
    process.exit(1);
});
