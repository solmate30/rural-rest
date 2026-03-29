/**
 * 00_reset_rwa.ts  --  [RWA 초기화]
 *
 * RWA 발행/투자/배당 데이터를 전부 삭제하고
 * rwa_tokens를 발행 전 상태로 되돌립니다.
 * 매물 설정(감정가, 토큰 가격, 수익률 등)은 유지됩니다.
 *
 * 삭제 대상:
 *   - rwa_dividends (전체)
 *   - rwa_investments (전체)
 *   - rwa_tokens: token_mint, tokens_sold, status 초기화
 *
 * 옵션:
 *   --files    bulk-investor-*.json 키페어 파일도 삭제
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/00_reset_rwa.ts
 *   npx tsx scripts/00_reset_rwa.ts --files
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

function parseArgs() {
    const args = process.argv.slice(2);
    return {
        files: args.includes("--files"),
    };
}

async function main() {
    const { files } = parseArgs();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  [Reset RWA] 발행/투자/배당 데이터 전체 초기화");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fs.existsSync(DB_PATH)) {
        console.log("  [스킵] DB 파일 없음");
        return;
    }

    const db = new Database(DB_PATH);

    // rwa_dividends 전체 삭제
    const d1 = db.prepare("DELETE FROM rwa_dividends").run();
    console.log(`  [삭제] rwa_dividends: ${d1.changes}건`);

    // rwa_investments 전체 삭제
    const d2 = db.prepare("DELETE FROM rwa_investments").run();
    console.log(`  [삭제] rwa_investments: ${d2.changes}건`);

    // rwa_tokens 초기화 (매물 설정은 유지)
    const d3 = db.prepare(`
        UPDATE rwa_tokens
        SET token_mint = NULL,
            tokens_sold = 0,
            status = 'funding',
            updated_at = strftime('%s', 'now')
    `).run();
    console.log(`  [초기화] rwa_tokens: ${d3.changes}건 (status=funding, token_mint=NULL, tokens_sold=0)`);

    // 현재 상태 출력
    const rows = db.prepare("SELECT listing_id, status, token_mint, tokens_sold FROM rwa_tokens").all() as any[];
    if (rows.length > 0) {
        console.log("\n  현재 rwa_tokens:");
        for (const r of rows) {
            console.log(`    ${r.listing_id} | status=${r.status} | mint=${r.token_mint ?? "NULL"} | sold=${r.tokens_sold}`);
        }
    }

    db.close();

    // bulk-investor 키페어 삭제
    if (files) {
        console.log("");
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

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 매물 설정은 유지, 발행 데이터만 초기화됨.");
    console.log("  온체인: solana-test-validator 재시작으로 초기화");
    console.log("  다음: npx tsx scripts/02_setup_localnet.ts --setup");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
