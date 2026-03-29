/**
 * 08_claim_dividend.ts  —  [STEP 8]
 *
 * 투자자가 누적된 배당금을 수령합니다.
 * bulk-investor-{n}.json 키페어를 로드하여 claimDividend를 호출합니다.
 *
 * 배당 계산 공식:
 *   gross = floor(position.amount * acc_dividend_per_share / PRECISION)
 *   pending = gross - reward_debt
 *
 * 전제조건:
 *   - STEP 7 완료 (distribute_revenue로 acc_dividend_per_share > 0)
 *   - 해당 투자자의 bulk-investor-{n}.json 파일이 존재 (STEP 4에서 생성됨)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/08_claim_dividend.ts --listing-id gangreung-001 --investor-index 0
 *   npx tsx scripts/08_claim_dividend.ts --listing-id gangreung-001 --all
 *
 * 옵션:
 *   --listing-id <id>        매물 ID (필수)
 *   --investor-index <n>     특정 투자자 인덱스 (bulk-investor-n.json)
 *   --all                    모든 bulk-investor-*.json 투자자 일괄 청구
 *   --rpc <url>              RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
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
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../local.db");
const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const PAYER_PATH = path.join(__dirname, "test-payer.json");

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId:     get("--listing-id") ?? null,
        investorIndex: get("--investor-index") !== undefined ? parseInt(get("--investor-index")!) : null,
        all:           args.includes("--all"),
        rpc:           get("--rpc") ?? DEFAULT_RPC,
    };
}

function loadKeypair(filePath: string): Keypair | null {
    if (!fs.existsSync(filePath)) return null;
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
    );
}

function findAllInvestorFiles(): number[] {
    const indices: number[] = [];
    let i = 0;
    while (fs.existsSync(path.join(__dirname, `bulk-investor-${i}.json`))) {
        indices.push(i);
        i++;
    }
    return indices;
}

async function claimForInvestor(
    investor: Keypair,
    index: number,
    listingId: string,
    connection: Connection,
    payer: Keypair
) {
    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    const investorProvider = new AnchorProvider(
        connection,
        new Wallet(investor),
        { commitment: "confirmed" }
    );
    const program = new Program(IDL as any, investorProvider);

    // onchain 조회
    const onchain: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const usdcMint = onchain.usdcMint as PublicKey;

    // investor_position PDA
    const [investorPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyTokenPda.toBuffer(), investor.publicKey.toBuffer()],
        PROGRAM_ID
    );

    // 포지션 조회 (pending 배당 확인)
    let position: any;
    try {
        position = await (program.account as any).investorPosition.fetch(investorPosition);
    } catch {
        console.log(`  [${index}] 포지션 없음 — 이 투자자는 해당 매물에 투자하지 않았습니다.`);
        return;
    }

    const amount = BigInt(position.amount.toString());
    if (amount === 0n) {
        console.log(`  [${index}] 토큰 보유량 0 — 환불됐거나 투자 기록 없음`);
        return;
    }

    // 미청구 배당 계산
    const accDps = BigInt(onchain.accDividendPerShare.toString());
    const rewardDebt = BigInt(position.rewardDebt.toString());
    const PRECISION = 1_000_000_000_000n;
    const gross = amount * accDps / PRECISION;
    const pending = gross - rewardDebt;

    console.log(`\n  [투자자 ${index}] ${investor.publicKey.toBase58().slice(0, 16)}...`);
    console.log(`    보유 토큰:    ${amount}`);
    console.log(`    미청구 배당:  ${Number(pending) / 1_000_000} USDC`);

    if (pending === 0n) {
        console.log(`    청구 스킵 (미청구 배당 없음)`);
        return;
    }

    // SOL 보충
    const sol = await connection.getBalance(investor.publicKey);
    if (sol < 0.1 * LAMPORTS_PER_SOL) {
        const airdropSig = await connection.requestAirdrop(investor.publicKey, 0.5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, "confirmed");
    }

    // investor USDC ATA 준비
    const investorUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, investor.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );

    const beforeBalance = await connection.getTokenAccountBalance(investorUsdcAccount.address);

    // usdc_vault ATA
    const usdcVault = getAssociatedTokenAddressSync(
        usdcMint, propertyTokenPda, true, TOKEN_PROGRAM_ID
    );

    // claim_dividend 호출
    const sig = await (program.methods as any)
        .claimDividend(listingId)
        .accounts({
            investor: investor.publicKey,
            propertyToken: propertyTokenPda,
            investorPosition,
            usdcVault,
            investorUsdcAccount: investorUsdcAccount.address,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([investor])
        .rpc();

    const afterBalance = await connection.getTokenAccountBalance(investorUsdcAccount.address);
    const received = (afterBalance.value.uiAmount ?? 0) - (beforeBalance.value.uiAmount ?? 0);

    console.log(`    TX:           ${sig}`);
    console.log(`    수령 금액:    +${received.toFixed(6)} USDC`);
    console.log(`    USDC 잔액:    ${afterBalance.value.uiAmount} USDC`);

    // DB 기록: rwa_dividends INSERT
    const db = new Database(DB_PATH);
    const token = db.prepare("SELECT id FROM rwa_tokens WHERE listing_id = ?").get(listingId) as any;
    if (token) {
        const month = new Date().toISOString().slice(0, 7); // "2026-03"
        const dividendUsdc = Math.round(received * 1_000_000);
        db.prepare(`
            INSERT INTO rwa_dividends (id, wallet_address, rwa_token_id, month, dividend_usdc, claim_tx, claimed_at, created_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, strftime('%s','now'), strftime('%s','now'))
        `).run(investor.publicKey.toBase58(), token.id, month, dividendUsdc, sig);
        console.log(`    DB 기록:      rwa_dividends (month: ${month}, ${received.toFixed(6)} USDC)`);
    }
    db.close();
}

async function main() {
    const { listingId, investorIndex, all, rpc } = parseArgs();
    if (!listingId || (investorIndex === null && !all)) {
        console.error("Usage:");
        console.error("  npx tsx scripts/08_claim_dividend.ts --listing-id <id> --investor-index <n>");
        console.error("  npx tsx scripts/08_claim_dividend.ts --listing-id <id> --all");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 8] claim_dividend — ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const connection = new Connection(rpc, "confirmed");

    const payer = loadKeypair(PAYER_PATH);
    if (!payer) {
        console.error("  오류: test-payer.json 이 없습니다. STEP 1을 먼저 실행하세요. (01_generate_keypairs.ts)");
        process.exit(1);
    }

    // 처리할 투자자 목록 결정
    const indices = all ? findAllInvestorFiles() : [investorIndex!];

    if (indices.length === 0) {
        console.error("  오류: bulk-investor-*.json 파일을 찾을 수 없습니다. STEP 4를 먼저 실행하세요.");
        process.exit(1);
    }

    console.log(`  처리할 투자자: ${indices.length}명 (인덱스: ${indices.join(", ")})`);

    for (const idx of indices) {
        const investorPath = path.join(__dirname, `bulk-investor-${idx}.json`);
        const investor = loadKeypair(investorPath);
        if (!investor) {
            console.log(`  [${idx}] 파일 없음 — 스킵`);
            continue;
        }

        try {
            await claimForInvestor(investor, idx, listingId, connection, payer);
        } catch (err: any) {
            console.log(`  [${idx}] 오류: ${err.message?.slice(0, 100)}`);
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료!");
    console.log("  상태 확인: npx tsx scripts/99_check_state.ts --listing-id " + listingId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
