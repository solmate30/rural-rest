/**
 * 04b_cancel_position.ts  —  [STEP 4.5 선택]
 *
 * Funding 상태에서 투자자가 포지션을 취소합니다.
 *   - 투자자 RWA 토큰 소각
 *   - funding_vault → 투자자 USDC 반환
 *   - tokens_sold 감소
 *
 * 쿨링오프 없음 — Funding 상태이면 언제든 호출 가능.
 * Funded / Active 이후에는 호출 불가 (InvalidStatus 에러).
 *
 * 전제조건:
 *   - STEP 4 완료 (bulk-investor-{n}.json 존재)
 *   - 매물이 온체인에서 Funding 상태
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/04b_cancel_position.ts --listing-id gangreung-001 --investor-index 0
 *   npx tsx scripts/04b_cancel_position.ts --listing-id gangreung-001 --all
 *
 * 옵션:
 *   --listing-id <id>        매물 ID (필수)
 *   --investor-index <n>     특정 투자자 인덱스 (bulk-investor-n.json)
 *   --all                    모든 bulk-investor-*.json 투자자 일괄 취소
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
    TOKEN_2022_PROGRAM_ID,
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

async function cancelForInvestor(
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

    // 온체인 PropertyToken 조회
    const onchain: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const usdcMint = onchain.usdcMint as PublicKey;
    const tokenMint = onchain.tokenMint as PublicKey;
    const status = Object.keys(onchain.status)[0]; // "funding" | "funded" | ...

    const now = Math.floor(Date.now() / 1000);
    const deadline = onchain.fundingDeadline?.toNumber?.() ?? 0;
    const canCancel = (status === "funding" || status === "funded") && now <= deadline;
    if (!canCancel) {
        const reason = now > deadline ? "기한 만료 (deadline 경과)" : `취소 불가 상태: ${status}`;
        console.log(`  [${index}] 스킵 — ${reason}`);
        return;
    }

    // investor_position PDA
    const [investorPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyTokenPda.toBuffer(), investor.publicKey.toBuffer()],
        PROGRAM_ID
    );

    // 포지션 조회
    let position: any;
    try {
        position = await (program.account as any).investorPosition.fetch(investorPosition);
    } catch {
        console.log(`  [${index}] 포지션 없음 — 이 투자자는 해당 매물에 투자하지 않았습니다.`);
        return;
    }

    const amount = BigInt(position.amount.toString());
    if (amount === 0n) {
        console.log(`  [${index}] 보유 토큰 없음 — 이미 취소됐거나 투자 기록 없음`);
        return;
    }

    const refundUsdc = amount * BigInt(onchain.pricePerTokenUsdc.toString());
    console.log(`\n  [투자자 ${index}] ${investor.publicKey.toBase58().slice(0, 16)}...`);
    console.log(`    보유 토큰:    ${amount}`);
    console.log(`    반환 USDC:    ${Number(refundUsdc) / 1_000_000} USDC`);

    // SOL 보충
    const sol = await connection.getBalance(investor.publicKey);
    if (sol < 0.1 * LAMPORTS_PER_SOL) {
        const sig = await connection.requestAirdrop(investor.publicKey, 0.5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
    }

    // funding_vault PDA
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    // 투자자 Token-2022 RWA ATA
    const investorRwaAccount = getAssociatedTokenAddressSync(
        tokenMint, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // 투자자 USDC ATA (없으면 생성)
    const investorUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, investor.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );

    const beforeUsdc = await connection.getTokenAccountBalance(investorUsdcAccount.address);

    // cancel_position 호출
    const sig = await (program.methods as any)
        .cancelPosition(listingId)
        .accounts({
            investor:             investor.publicKey,
            propertyToken:        propertyTokenPda,
            investorPosition,
            tokenMint,
            investorRwaAccount,
            fundingVault,
            investorUsdcAccount:  investorUsdcAccount.address,
            usdcMint,
            tokenProgram:         TOKEN_2022_PROGRAM_ID,
            usdcTokenProgram:     TOKEN_PROGRAM_ID,
        })
        .signers([investor])
        .rpc();

    const afterUsdc = await connection.getTokenAccountBalance(investorUsdcAccount.address);
    const received = (afterUsdc.value.uiAmount ?? 0) - (beforeUsdc.value.uiAmount ?? 0);

    console.log(`    TX:           ${sig}`);
    console.log(`    반환 완료:    +${received.toFixed(6)} USDC`);
    console.log(`    USDC 잔액:    ${afterUsdc.value.uiAmount} USDC`);

    // DB 동기화: tokens_sold 감소 + status 복귀
    const db = new Database(DB_PATH);
    const token = db.prepare("SELECT id, tokens_sold, total_supply FROM rwa_tokens WHERE listing_id = ?").get(listingId) as any;
    if (token) {
        const newSold = Math.max(0, (token.tokens_sold ?? 0) - Number(amount));
        const newStatus = newSold < token.total_supply ? "funding" : "funded";
        db.prepare("UPDATE rwa_tokens SET tokens_sold = ?, status = ? WHERE id = ?")
            .run(newSold, newStatus, token.id);
        console.log(`    DB 업데이트: tokens_sold ${token.tokens_sold} → ${newSold} (status: ${newStatus})`);
    }
    db.close();
}

async function main() {
    const { listingId, investorIndex, all, rpc } = parseArgs();

    if (!listingId || (investorIndex === null && !all)) {
        console.error("Usage:");
        console.error("  npx tsx scripts/04b_cancel_position.ts --listing-id <id> --investor-index <n>");
        console.error("  npx tsx scripts/04b_cancel_position.ts --listing-id <id> --all");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 4.5] cancel_position — ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const connection = new Connection(rpc, "confirmed");

    const payer = loadKeypair(PAYER_PATH);
    if (!payer) {
        console.error("  오류: test-payer.json이 없습니다. STEP 1을 먼저 실행하세요. (01_generate_keypairs.ts)");
        process.exit(1);
    }

    const indices = all ? findAllInvestorFiles() : [investorIndex!];

    if (indices.length === 0) {
        console.error("  오류: bulk-investor-*.json 파일을 찾을 수 없습니다. STEP 4를 먼저 실행하세요.");
        process.exit(1);
    }

    console.log(`  처리할 투자자: ${indices.length}명 (인덱스: ${indices.join(", ")})`);

    let success = 0;
    for (const idx of indices) {
        const investorPath = path.join(__dirname, `bulk-investor-${idx}.json`);
        const investor = loadKeypair(investorPath);
        if (!investor) {
            console.log(`  [${idx}] 파일 없음 — 스킵`);
            continue;
        }
        try {
            await cancelForInvestor(investor, idx, listingId, connection, payer);
            success++;
        } catch (err: any) {
            console.log(`  [${idx}] 오류: ${err.message?.slice(0, 120)}`);
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  완료! 성공: ${success}명 / 요청: ${indices.length}명`);
    console.log("  상태 확인: npx tsx scripts/99_check_state.ts --listing-id " + listingId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
