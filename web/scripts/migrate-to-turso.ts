/**
 * 로컬 SQLite → Turso 마이그레이션 스크립트
 *
 * 마이그레이션 대상: user, account, listings, rwa_tokens
 * (bookings, session 등 임시 데이터 제외)
 *
 * 실행:
 *   TURSO_DATABASE_URL=libsql://rural-rest-solmate.aws-ap-northeast-1.turso.io \
 *   TURSO_AUTH_TOKEN=<token> \
 *   npx ts-node scripts/migrate-to-turso.ts
 */

import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DB = path.resolve(__dirname, "../local.db");
const TURSO_URL = process.env.TURSO_DATABASE_URL!;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || TURSO_URL.startsWith("file:")) {
    console.error("❌ TURSO_DATABASE_URL을 원격 libsql:// URL로 설정하세요.");
    process.exit(1);
}

const local = new Database(LOCAL_DB, { readonly: true });
const remote = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function upsertAll(table: string, rows: Record<string, any>[]) {
    if (rows.length === 0) {
        console.log(`  ${table}: 0건 (스킵)`);
        return;
    }
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;

    for (const row of rows) {
        const args = cols.map((c) => row[c] ?? null);
        await remote.execute({ sql, args });
    }
    console.log(`  ${table}: ${rows.length}건 완료`);
}

async function main() {
    console.log(`Local : ${LOCAL_DB}`);
    console.log(`Remote: ${TURSO_URL}\n`);

    await remote.execute("PRAGMA foreign_keys = OFF");

    const tables: string[] = ["user", "account", "listings", "rwa_tokens"];

    for (const table of tables) {
        const rows = local.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
        await upsertAll(table, rows);
    }

    await remote.execute("PRAGMA foreign_keys = ON");

    console.log("\n✅ 마이그레이션 완료.");
    local.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
