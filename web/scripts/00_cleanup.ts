/**
 * 00_cleanup.ts  —  [테스트 초기화]
 *
 * 테스트 데이터를 삭제하고 재테스트 환경을 초기화합니다.
 *
 * 삭제 대상:
 *   [DB]
 *   - rwa_dividends    (해당 listing)
 *   - rwa_investments  (해당 listing)
 *   - rwa_tokens       (해당 listing)
 *   - listings         (해당 listing)
 *   - user             (test-spv-host@rural-rest.local)
 *
 *   [파일] --files 옵션 시
 *   - bulk-investor-*.json  (투자자 키페어)
 *
 *   [파일] --all-keypairs 옵션 시
 *   - bulk-investor-*.json
 *   - test-payer.json / test-usdc-mint.json / spv-wallet.json 등
 *     (USDC 민트도 사라지므로 STEP 1~2 전체 재실행 필요)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/00_cleanup.ts --listing-id gangreung-001
 *   npx tsx scripts/00_cleanup.ts --listing-id gangreung-001 --files
 *   npx tsx scripts/00_cleanup.ts --listing-id gangreung-001 --all-keypairs
 *
 * 참고:
 *   온체인 상태(localnet)는 solana-test-validator 재시작으로 초기화됩니다.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../local.db");
const HOST_EMAIL = "test-spv-host@rural-rest.local";

const KEYPAIR_FILES = [
    "test-payer.json",
    "test-usdc-mint.json",
    "spv-wallet.json",
    "government-wallet.json",
    "village-operator-wallet.json",
];

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId:   get("--listing-id") ?? null,
        files:       args.includes("--files") || args.includes("--all-keypairs"),
        allKeypairs: args.includes("--all-keypairs"),
    };
}

function deleteFile(filePath: string, label: string) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  [삭제] ${label}`);
    }
}

function deleteBulkInvestors() {
    let i = 0;
    let count = 0;
    while (true) {
        const p = path.join(__dirname, `bulk-investor-${i}.json`);
        if (!fs.existsSync(p)) break;
        fs.unlinkSync(p);
        count++;
        i++;
    }
    if (count > 0) console.log(`  [삭제] bulk-investor-*.json (${count}개)`);
    else console.log(`  [스킵] bulk-investor-*.json (없음)`);
}

async function main() {
    const { listingId, files, allKeypairs } = parseArgs();

    if (!listingId) {
        console.error("Usage: npx tsx scripts/00_cleanup.ts --listing-id <id> [--files] [--all-keypairs]");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Cleanup] ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ── DB 삭제 ────────────────────────────────────────────────────────────────
    if (!fs.existsSync(DB_PATH)) {
        console.log("  [스킵] DB 파일 없음");
    } else {
        const db = new Database(DB_PATH);

        // rwa_dividends
        const d1 = db.prepare(`
            DELETE FROM rwa_dividends
            WHERE rwa_token_id IN (
                SELECT id FROM rwa_tokens WHERE listing_id = ?
            )
        `).run(listingId);
        if (d1.changes > 0) console.log(`  [삭제] rwa_dividends: ${d1.changes}건`);

        // rwa_investments
        const d2 = db.prepare(`
            DELETE FROM rwa_investments
            WHERE rwa_token_id IN (
                SELECT id FROM rwa_tokens WHERE listing_id = ?
            )
        `).run(listingId);
        if (d2.changes > 0) console.log(`  [삭제] rwa_investments: ${d2.changes}건`);

        // rwa_tokens
        const d3 = db.prepare("DELETE FROM rwa_tokens WHERE listing_id = ?").run(listingId);
        if (d3.changes > 0) console.log(`  [삭제] rwa_tokens: ${d3.changes}건`);

        // listings
        const d4 = db.prepare("DELETE FROM listings WHERE id = ?").run(listingId);
        if (d4.changes > 0) console.log(`  [삭제] listings: ${listingId}`);

        // 테스트 호스트 유저 (다른 listing에서 참조 안 할 때만)
        const remaining = db.prepare("SELECT COUNT(*) as cnt FROM listings WHERE host_id = (SELECT id FROM user WHERE email = ?)").get(HOST_EMAIL) as { cnt: number };
        if (remaining.cnt === 0) {
            const d5 = db.prepare("DELETE FROM user WHERE email = ?").run(HOST_EMAIL);
            if (d5.changes > 0) console.log(`  [삭제] user: ${HOST_EMAIL}`);
        } else {
            console.log(`  [유지] user: ${HOST_EMAIL} (다른 listing 참조 중)`);
        }

        db.close();
    }

    // ── 파일 삭제 ─────────────────────────────────────────────────────────────
    if (files) {
        console.log("");
        deleteBulkInvestors();

        if (allKeypairs) {
            for (const file of KEYPAIR_FILES) {
                deleteFile(path.join(__dirname, file), file);
            }
            console.log("\n  ⚠ 키페어 전체 삭제됨 — STEP 1~2 전체 재실행 필요");
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 온체인 상태는 solana-test-validator 재시작으로 초기화하세요.");
    console.log("  다음: npx tsx scripts/00_seed_listing.ts --listing-id " + listingId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
