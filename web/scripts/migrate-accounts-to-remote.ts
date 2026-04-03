/**
 * 원격 Turso DB 초기화 + 로컬 계정 마이그레이션
 *
 * 실행: cd web && npx tsx scripts/migrate-accounts-to-remote.ts
 *
 * 순서:
 *   1. 원격 DB 전체 데이터 삭제 (매물, 예약, 계정 등)
 *   2. 로컬 DB의 user, session, account, verification 복사
 */

import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../app/db/schema";

// .env 로드
config({ path: resolve(process.cwd(), ".env") });

const LOCAL_URL = "file:./local.db";
const REMOTE_URL = process.env.TURSO_DATABASE_URL?.startsWith("libsql")
    ? process.env.TURSO_DATABASE_URL
    : undefined;
const REMOTE_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!REMOTE_URL || !REMOTE_TOKEN) {
    console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN 환경변수 필요");
    process.exit(1);
}

const localDb = drizzle(createClient({ url: LOCAL_URL }), { schema });
const remoteDb = drizzle(createClient({ url: REMOTE_URL, authToken: REMOTE_TOKEN }), { schema });

async function main() {
    console.log("=== 원격 DB 마이그레이션 ===\n");
    console.log(`원격: ${REMOTE_URL}`);
    console.log(`로컬: ${LOCAL_URL}\n`);

    // ── Step 1: 원격 DB 전체 삭제 ─────────────────────────────────────────
    console.log("[ 1/2 ] 원격 DB 데이터 삭제...");
    const tables = [
        "bookings", "reviews", "activities", '"listings"',
        "rwa_tokens", "rwa_investments",
        "operator_settlements", "local_gov_settlements",
        "transport_requests",
        "verification", "session", "account", '"user"',
    ];
    for (const table of tables) {
        try {
            await remoteDb.run(`DELETE FROM ${table}` as any);
            console.log(`  삭제: ${table}`);
        } catch (e: any) {
            console.warn(`  스킵: ${table} — ${e.message}`);
        }
    }

    // ── Step 2: 로컬 계정 데이터 복사 ────────────────────────────────────
    console.log("\n[ 2/3 ] 로컬 계정 → 원격 복사...");

    const users = await localDb.select().from(schema.user);
    console.log(`  user: ${users.length}명`);
    for (const row of users) {
        await remoteDb.insert(schema.user).values(row).onConflictDoNothing();
    }

    const accounts = await localDb.select().from(schema.account);
    console.log(`  account: ${accounts.length}개`);
    for (const row of accounts) {
        await remoteDb.insert(schema.account).values(row).onConflictDoNothing();
    }

    const sessions = await localDb.select().from(schema.session);
    console.log(`  session: ${sessions.length}개`);
    for (const row of sessions) {
        await remoteDb.insert(schema.session).values(row).onConflictDoNothing();
    }

    const verifications = await localDb.select().from(schema.verification);
    console.log(`  verification: ${verifications.length}개`);
    for (const row of verifications) {
        await remoteDb.insert(schema.verification).values(row).onConflictDoNothing();
    }

    // ── Step 3: 로컬 매물 데이터 복사 ────────────────────────────────────
    console.log("\n[ 3/3 ] 로컬 매물 → 원격 복사...");

    const listingRows = await localDb.select().from(schema.listings);
    console.log(`  listings: ${listingRows.length}개`);
    for (const row of listingRows) {
        await remoteDb.insert(schema.listings).values(row).onConflictDoNothing();
    }

    console.log("\n==========================================");
    console.log("  마이그레이션 완료");
    console.log("==========================================");
    console.log("\n다음 단계:");
    console.log("  1. .env에서 TURSO_DATABASE_URL 주석 해제 (원격으로 전환)");
    console.log("  2. npm run dev 재시작");
}

main().catch(e => {
    console.error("\n마이그레이션 실패:", e.message ?? e);
    process.exit(1);
});
