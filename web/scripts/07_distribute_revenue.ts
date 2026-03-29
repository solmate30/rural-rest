/**
 * 07_distribute_revenue.ts  —  [STEP 7]
 *
 * 월 영업이익(숙박 매출 - 운영비)을 3자에게 분배합니다:
 *
 *   영업이익 (net operating income, 운영비 차감 후)
 *     ├─ 40% → 지자체 (government-wallet.json) — 운영권 수수료 (USDC 이체)
 *     ├─ 30% → 마을운영자 (village-operator-wallet.json) — 운영 보상 (USDC 이체)
 *     └─ 30% → 투자자 풀 (usdc_vault PDA) — distribute_monthly_revenue 온체인 호출
 *
 * 투자자 30%만 온체인으로 처리됩니다.
 * 지자체/운영자 분배는 오프체인 USDC 이체로 시뮬레이션합니다.
 *
 * 전제조건:
 *   - STEP 6 완료 (매물이 Active 상태)
 *   - scripts/spv-wallet.json 에 충분한 USDC 잔액 (STEP 2 --fund-spv로 충전)
 *   - scripts/village-operator-wallet.json 존재 (01_generate_keypairs.ts로 생성)
 *   - scripts/government-wallet.json 존재 (01_generate_keypairs.ts로 생성)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/07_distribute_revenue.ts --listing-id gangreung-001 --revenue-usdc 333
 *
 * 옵션:
 *   --listing-id <id>       매물 ID (필수)
 *   --revenue-usdc <amount> 이번 달 영업이익 USDC (운영비 차감 후, 예: 333 = 333 USDC)
 *   --rpc <url>             RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 *
 * 예시: --revenue-usdc 333 이면 (영업이익 333 USDC, 운영비 제외)
 *   지자체:   333 * 40% = 133.2 USDC
 *   운영자:   333 * 30% = 99.9 USDC
 *   투자자:   333 * 30% = 99.9 USDC (온체인 분배)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    mintTo,
    transfer,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const SPV_KEYPAIR_PATH      = path.join(__dirname, "spv-wallet.json");
const OPERATOR_KEYPAIR_PATH = path.join(__dirname, "village-operator-wallet.json");
const GOVT_KEYPAIR_PATH     = path.join(__dirname, "government-wallet.json");
const PAYER_PATH            = path.join(__dirname, "test-payer.json");
const USDC_MINT_PATH        = path.join(__dirname, "test-usdc-mint.json");
const DB_PATH               = path.join(__dirname, "../local.db");

// 수익 분배 비율 (basis points)
const GOVT_BPS     = 4000; // 40%
const OPERATOR_BPS = 3000; // 30%
const INVESTOR_BPS = 3000; // 30%

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId:   get("--listing-id") ?? null,
        revenueUsdc: parseFloat(get("--revenue-usdc") ?? "0"),
        rpc:         get("--rpc") ?? DEFAULT_RPC,
    };
}

function loadKeypair(filePath: string, label: string): Keypair {
    if (!fs.existsSync(filePath)) {
        console.error(`  오류: ${label} 파일이 없습니다: ${filePath}`);
        console.error("  npx tsx scripts/01_generate_keypairs.ts 를 먼저 실행하세요.");
        process.exit(1);
    }
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
    );
}

async function main() {
    const { listingId, revenueUsdc, rpc } = parseArgs();
    if (!listingId || revenueUsdc <= 0) {
        console.error("Usage: npx tsx scripts/07_distribute_revenue.ts --listing-id <id> --revenue-usdc <amount>");
        process.exit(1);
    }

    // 분배 금액 계산 (micro-USDC)
    const grossMicro = BigInt(Math.round(revenueUsdc * 1_000_000));
    const govtAmount     = grossMicro * BigInt(GOVT_BPS) / 10_000n;
    const operatorAmount = grossMicro * BigInt(OPERATOR_BPS) / 10_000n;
    const investorAmount = grossMicro - govtAmount - operatorAmount; // 나머지는 투자자 (반올림 오차 방지)

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 7] distribute_revenue — ${listingId}`);
    console.log(`  총수익:   ${revenueUsdc} USDC`);
    console.log(`  지자체:   ${Number(govtAmount) / 1_000_000} USDC (${GOVT_BPS / 100}%)`);
    console.log(`  운영자:   ${Number(operatorAmount) / 1_000_000} USDC (${OPERATOR_BPS / 100}%)`);
    console.log(`  투자자:   ${Number(investorAmount) / 1_000_000} USDC (${INVESTOR_BPS / 100}%, 온체인)`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const authority = loadKeypair(SPV_KEYPAIR_PATH, "spv-wallet");
    const operator  = loadKeypair(OPERATOR_KEYPAIR_PATH, "village-operator-wallet");
    const govt      = loadKeypair(GOVT_KEYPAIR_PATH, "government-wallet");

    console.log(`\n  SPV(authority):  ${authority.publicKey.toBase58()}`);
    console.log(`  마을운영자:        ${operator.publicKey.toBase58()}`);
    console.log(`  지자체:           ${govt.publicKey.toBase58()}`);

    const connection = new Connection(rpc, "confirmed");

    // SPV SOL 잔액 확인
    const sol = await connection.getBalance(authority.publicKey);
    if (sol < 0.1 * LAMPORTS_PER_SOL) {
        const sig = await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
    }

    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const program = new Program(IDL as any, provider);

    // 온체인 상태 확인
    console.log("\n[ 1 ] 온체인 상태 확인");
    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const onchain: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const usdcMint = onchain.usdcMint as PublicKey;

    if (!onchain.status.active) {
        console.error(`  오류: 매물이 Active 상태가 아닙니다. 현재: ${JSON.stringify(onchain.status)}`);
        console.error("  STEP 6(activate_property)를 먼저 실행하세요.");
        process.exit(1);
    }
    console.log(`  상태: Active`);
    console.log(`  총 토큰 판매량: ${onchain.tokensSold.toString()}`);

    // SPV USDC ATA 확인 및 로컬넷 충전
    const payer = fs.existsSync(PAYER_PATH)
        ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_PATH, "utf8"))))
        : authority;
    const usdcMintKeypair = fs.existsSync(USDC_MINT_PATH)
        ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(USDC_MINT_PATH, "utf8"))))
        : null;

    const authorityUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, authority.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );

    // 로컬넷 테스트: SPV 잔액 부족 시 자동 충전
    const currentBalance = BigInt(authorityUsdcAccount.amount.toString());
    if (usdcMintKeypair && currentBalance < grossMicro) {
        console.log("\n[ 2 ] 로컬넷 — SPV 지갑 USDC 자동 충전");
        await mintTo(
            connection, payer, usdcMint, authorityUsdcAccount.address,
            payer, grossMicro, [], undefined, TOKEN_PROGRAM_ID
        );
        console.log(`  ${revenueUsdc} USDC 충전 완료`);
    }

    // 지자체 USDC ATA 준비
    const govtUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, govt.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );
    // 운영자 USDC ATA 준비
    const operatorUsdcAta = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, operator.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );

    // usdc_vault (투자자 배당 풀)
    const usdcVault = getAssociatedTokenAddressSync(
        usdcMint, propertyTokenPda, true, TOKEN_PROGRAM_ID
    );

    // ── 지자체 분배 ─────────────────────────────────────────────────────────
    console.log(`\n[ 3 ] 지자체 분배 — ${Number(govtAmount) / 1_000_000} USDC`);
    const govtTx = await transfer(
        connection,
        authority,
        authorityUsdcAccount.address,
        govtUsdcAta.address,
        authority.publicKey,
        govtAmount,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );
    console.log(`  TX: ${govtTx}`);
    const govtBalance = await connection.getTokenAccountBalance(govtUsdcAta.address);
    console.log(`  지자체 잔액: ${govtBalance.value.uiAmount} USDC`);

    // ── 운영자 분배 ─────────────────────────────────────────────────────────
    console.log(`\n[ 4 ] 마을운영자 분배 — ${Number(operatorAmount) / 1_000_000} USDC`);
    const operatorTx = await transfer(
        connection,
        authority,
        authorityUsdcAccount.address,
        operatorUsdcAta.address,
        authority.publicKey,
        operatorAmount,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );
    console.log(`  TX: ${operatorTx}`);
    const operatorBalance = await connection.getTokenAccountBalance(operatorUsdcAta.address);
    console.log(`  운영자 잔액: ${operatorBalance.value.uiAmount} USDC`);

    // ── 투자자 배당 (온체인) ─────────────────────────────────────────────────
    console.log(`\n[ 5 ] 투자자 배당 분배 (온체인) — ${Number(investorAmount) / 1_000_000} USDC`);
    const sig = await (program.methods as any)
        .distributeMonthlyRevenue(listingId, new BN(investorAmount.toString()))
        .accounts({
            propertyToken: propertyTokenPda,
            authority: authority.publicKey,
            authorityUsdcAccount: authorityUsdcAccount.address,
            usdcVault,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    console.log(`  TX: ${sig}`);

    // 배당 현황 조회
    const updated: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const accDps = BigInt(updated.accDividendPerShare.toString());
    const tokensSold = BigInt(updated.tokensSold.toString());
    const perToken = tokensSold > 0n
        ? Number(accDps * 1_000_000n / 10n ** 12n) / 1_000_000 / Number(tokensSold)
        : 0;

    console.log(`\n  acc_dividend_per_share: ${accDps}`);
    console.log(`  토큰 1개당 총 수령 가능: ${perToken.toFixed(6)} USDC`);

    // DB 기록
    console.log("\n[ 6 ] DB 정산 기록");
    const db = new Database(DB_PATH);
    const now = Math.floor(Date.now() / 1000);
    const month = new Date().toISOString().slice(0, 7); // "2026-03"
    const KRW_PER_USDC = 1350;
    const grossRevenueKrw = Math.round(revenueUsdc * KRW_PER_USDC);
    const operatingProfitKrw = grossRevenueKrw; // 스크립트 입력값 = 영업이익

    // 운영자 ID 조회 (listings.operator_id)
    const listingRow = db.prepare("SELECT operator_id FROM listings WHERE id = ?").get(listingId) as { operator_id: string | null } | undefined;
    const operatorId = listingRow?.operator_id;

    // 지자체 정산 기록
    db.prepare(`
        INSERT INTO local_gov_settlements (id, listing_id, month, gross_revenue_krw, operating_profit_krw, settlement_usdc, gov_wallet_address, payout_tx, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        uuidv4(), listingId, month,
        grossRevenueKrw, operatingProfitKrw,
        Number(govtAmount),
        govt.publicKey.toBase58(),
        govtTx, now, now
    );
    console.log(`  지자체 정산 기록: ${month} (${Number(govtAmount) / 1_000_000} USDC)`);

    // 운영자 정산 기록
    if (operatorId) {
        db.prepare(`
            INSERT INTO operator_settlements (id, operator_id, listing_id, month, gross_revenue_krw, operating_cost_krw, operating_profit_krw, settlement_usdc, payout_tx, paid_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            uuidv4(), operatorId, listingId, month,
            grossRevenueKrw, 0, operatingProfitKrw,
            Number(operatorAmount),
            operatorTx, now, now
        );
        console.log(`  운영자 정산 기록: ${month} (${Number(operatorAmount) / 1_000_000} USDC)`);
    } else {
        console.log("  운영자 미등록 — 정산 기록 생략");
    }

    // rwa_tokens 정산 시각 업데이트
    db.prepare(`
        UPDATE rwa_tokens
        SET last_settlement_at = ?, updated_at = ?
        WHERE listing_id = ?
    `).run(now, now, listingId);

    db.close();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 3자 분배 + DB 정산 기록 처리됐습니다.");
    console.log("  투자자들이 08_claim_dividend로 배당을 수령할 수 있습니다.");
    console.log("  다음: npx tsx scripts/08_claim_dividend.ts --listing-id " + listingId + " --all");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
