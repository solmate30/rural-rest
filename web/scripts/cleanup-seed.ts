/**
 * cleanup-seed.ts
 * seed-* 패턴으로 삽입된 더미 데이터를 DB에서 전부 삭제.
 * 실제 발행된 데이터(건천읍 월성 등)는 보존됨.
 *
 * 실행: npx tsx scripts/cleanup-seed.ts
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { like, or, inArray } from "drizzle-orm";
import * as schema from "../app/db/schema";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

async function main() {
    console.log("더미 데이터 정리 시작...\n");

    // seed 유저 ID 목록 먼저 수집
    const seedUsers = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(like(schema.user.id, "seed-%"));
    const seedUserIds = seedUsers.map((u) => u.id);

    // seed listing ID 목록 수집
    const seedListings = await db
        .select({ id: schema.listings.id })
        .from(schema.listings)
        .where(like(schema.listings.id, "seed-listing-%"));
    const seedListingIds = seedListings.map((l) => l.id);

    // seed rwa token ID 목록 수집
    const seedRwaTokens = await db
        .select({ id: schema.rwaTokens.id })
        .from(schema.rwaTokens)
        .where(like(schema.rwaTokens.id, "seed-rwa-%"));
    const seedRwaTokenIds = seedRwaTokens.map((t) => t.id);

    console.log(`삭제 대상: 유저 ${seedUserIds.length}명, 매물 ${seedListingIds.length}개, RWA 토큰 ${seedRwaTokenIds.length}개`);

    // 1. rwa_dividends (seed rwa token 연관)
    if (seedRwaTokenIds.length > 0) {
        const { rowsAffected: d1 } = await client.execute({
            sql: `DELETE FROM rwa_dividends WHERE rwa_token_id IN (${seedRwaTokenIds.map(() => "?").join(",")})`,
            args: seedRwaTokenIds,
        });
        console.log(`  rwa_dividends 삭제: ${d1}행`);
    }

    // 2. rwa_investments (seed rwa token 연관)
    if (seedRwaTokenIds.length > 0) {
        const { rowsAffected: d2 } = await client.execute({
            sql: `DELETE FROM rwa_investments WHERE rwa_token_id IN (${seedRwaTokenIds.map(() => "?").join(",")})`,
            args: seedRwaTokenIds,
        });
        console.log(`  rwa_investments 삭제: ${d2}행`);
    }

    // 3. operator_settlements (seed listing 연관)
    if (seedListingIds.length > 0) {
        const { rowsAffected: d3 } = await client.execute({
            sql: `DELETE FROM operator_settlements WHERE listing_id IN (${seedListingIds.map(() => "?").join(",")})`,
            args: seedListingIds,
        });
        console.log(`  operator_settlements 삭제: ${d3}행`);
    }

    // 4. local_gov_settlements (seed listing 연관)
    if (seedListingIds.length > 0) {
        const { rowsAffected: d4 } = await client.execute({
            sql: `DELETE FROM local_gov_settlements WHERE listing_id IN (${seedListingIds.map(() => "?").join(",")})`,
            args: seedListingIds,
        });
        console.log(`  local_gov_settlements 삭제: ${d4}행`);
    }

    // 5. bookings (seed listing 또는 seed guest 연관)
    if (seedListingIds.length > 0 || seedUserIds.length > 0) {
        const listingPart = seedListingIds.length > 0
            ? `listing_id IN (${seedListingIds.map(() => "?").join(",")})`
            : null;
        const guestPart = seedUserIds.length > 0
            ? `guest_id IN (${seedUserIds.map(() => "?").join(",")})`
            : null;
        const where = [listingPart, guestPart].filter(Boolean).join(" OR ");
        const { rowsAffected: d5 } = await client.execute({
            sql: `DELETE FROM bookings WHERE ${where}`,
            args: [...seedListingIds, ...seedUserIds],
        });
        console.log(`  bookings 삭제: ${d5}행`);
    }

    // 6. rwa_tokens (seed-rwa-*)
    if (seedRwaTokenIds.length > 0) {
        const { rowsAffected: d6 } = await client.execute({
            sql: `DELETE FROM rwa_tokens WHERE id IN (${seedRwaTokenIds.map(() => "?").join(",")})`,
            args: seedRwaTokenIds,
        });
        console.log(`  rwa_tokens 삭제: ${d6}행`);
    }

    // 7. listings (seed-listing-*)
    if (seedListingIds.length > 0) {
        const { rowsAffected: d7 } = await client.execute({
            sql: `DELETE FROM listings WHERE id IN (${seedListingIds.map(() => "?").join(",")})`,
            args: seedListingIds,
        });
        console.log(`  listings 삭제: ${d7}행`);
    }

    // 7-1. 실데이터 listings에서 seed 유저 참조 해제 (operator_id, host_id)
    if (seedUserIds.length > 0) {
        const inClause = seedUserIds.map(() => "?").join(",");
        await client.execute({
            sql: `UPDATE listings SET operator_id = NULL WHERE operator_id IN (${inClause})`,
            args: seedUserIds,
        });
        // host_id 는 NOT NULL 이므로 NULL 업데이트 불가 — FK off로 처리
        // seed 유저가 operator인 operator_settlements 삭제 (실데이터 listing 연관 포함)
        const { rowsAffected: dOp } = await client.execute({
            sql: `DELETE FROM operator_settlements WHERE operator_id IN (${inClause})`,
            args: seedUserIds,
        });
        if (dOp > 0) console.log(`  operator_settlements (operator 기준) 추가 삭제: ${dOp}행`);
    }

    // 8-10. account / session / user 삭제 (FK 일시 해제)
    if (seedUserIds.length > 0) {
        const inClause2 = seedUserIds.map(() => "?").join(",");
        await client.execute({ sql: "PRAGMA foreign_keys = OFF", args: [] });

        const { rowsAffected: d8 } = await client.execute({
            sql: `DELETE FROM account WHERE user_id IN (${inClause2})`,
            args: seedUserIds,
        });
        console.log(`  account 삭제: ${d8}행`);

        const { rowsAffected: d9 } = await client.execute({
            sql: `DELETE FROM session WHERE user_id IN (${inClause2})`,
            args: seedUserIds,
        });
        console.log(`  session 삭제: ${d9}행`);

        const { rowsAffected: d10 } = await client.execute({
            sql: `DELETE FROM user WHERE id IN (${inClause2})`,
            args: seedUserIds,
        });
        console.log(`  user 삭제: ${d10}행`);

        await client.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
    }

    console.log("\n정리 완료.");
    console.log("남아있는 매물:");
    const remaining = await db.select({ id: schema.listings.id, title: schema.listings.title }).from(schema.listings);
    if (remaining.length === 0) {
        console.log("  (없음)");
    } else {
        for (const r of remaining) {
            console.log(`  - ${r.title} (${r.id})`);
        }
    }

    await client.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
