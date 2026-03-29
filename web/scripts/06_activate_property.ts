/**
 * 06_activate_property.ts  —  [STEP 6]
 *
 * 펀딩 완료된 매물을 Active 상태로 전환합니다.
 * activate_property 호출 시 RWA 토큰 mint authority가 영구 소각되어
 * 이후 추가 토큰 발행이 불가능해집니다.
 *
 * Active 상태 이후:
 *   - distribute_monthly_revenue 호출 가능 (배당 풀 입금)
 *   - claim_dividend 호출 가능 (투자자 배당 수령)
 *
 * 전제조건:
 *   - STEP 5 완료 (release_funds로 매물이 Funded 상태)
 *   - scripts/spv-wallet.json 이 STEP 3에서 사용한 authority여야 합니다.
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/06_activate_property.ts --listing-id gangreung-001
 *
 * 옵션:
 *   --listing-id <id>  매물 ID (필수)
 *   --rpc <url>        RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
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
const SPV_KEYPAIR_PATH = path.join(__dirname, "spv-wallet.json");
const DB_PATH          = path.join(__dirname, "../local.db");

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId: get("--listing-id") ?? null,
        rpc: get("--rpc") ?? DEFAULT_RPC,
    };
}

async function main() {
    const { listingId, rpc } = parseArgs();
    if (!listingId) {
        console.error("Usage: npx tsx scripts/06_activate_property.ts --listing-id <id>");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 6] activate_property — ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fs.existsSync(SPV_KEYPAIR_PATH)) {
        console.error("  오류: spv-wallet.json 이 없습니다. STEP 1을 먼저 실행하세요.");
        process.exit(1);
    }
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(SPV_KEYPAIR_PATH, "utf8")))
    );
    console.log(`  SPV(authority): ${authority.publicKey.toBase58()}`);

    const connection = new Connection(rpc, "confirmed");

    // SOL 잔액 확인
    const sol = await connection.getBalance(authority.publicKey);
    if (sol < 0.1 * LAMPORTS_PER_SOL) {
        console.log("  SOL 부족 — 에어드롭 중...");
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
    const tokenMint = onchain.tokenMint as PublicKey;

    console.log(`  현재 상태: ${JSON.stringify(onchain.status)}`);

    if (!onchain.status.funded) {
        console.error("  오류: 매물이 Funded 상태가 아닙니다.");
        console.error("  STEP 5(release_funds)를 먼저 실행하세요.");
        process.exit(1);
    }

    // activate_property 호출
    console.log("\n[ 2 ] activate_property 트랜잭션 전송");
    console.log("  (mint authority가 영구 소각됩니다 — 되돌릴 수 없음)");
    const sig = await (program.methods as any)
        .activateProperty(listingId)
        .accounts({
            propertyToken: propertyTokenPda,
            authority: authority.publicKey,
            tokenMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    console.log(`  TX: ${sig}`);

    // DB 업데이트 (이미 release_funds에서 active로 변경됐지만, 명시적으로 확인)
    const db = new Database(DB_PATH);
    db.prepare(
        "UPDATE rwa_tokens SET status = 'active', updated_at = strftime('%s','now') WHERE listing_id = ?"
    ).run(listingId);
    db.close();

    // 상태 재확인
    const updated: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    console.log(`\n  전환 후 상태: ${JSON.stringify(updated.status)}`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 매물이 Active 상태로 전환됐습니다.");
    console.log("  이제 배당 분배가 가능합니다.");
    console.log("  다음: npx tsx scripts/07_distribute_revenue.ts --listing-id " + listingId + " --revenue-usdc 333");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
