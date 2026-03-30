import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const email = "admin@rural-rest.dev";

const target = await db.execute({ sql: "SELECT id FROM user WHERE email=?", args: [email] });
if (!target.rows.length) { console.log("유저 없음"); process.exit(0); }
const userId = target.rows[0].id as string;
console.log("삭제 대상:", email, userId);

// 1. listings 조회
const listingsRes = await db.execute({ sql: "SELECT id FROM listings WHERE host_id=?", args: [userId] });
const listingIds = listingsRes.rows.map(r => r.id as string);
console.log("listings:", listingIds.length, "개");

for (const lid of listingIds) {
    // bookings 조회
    const bookingsRes = await db.execute({ sql: "SELECT id FROM bookings WHERE listing_id=?", args: [lid] });
    const bookingIds = bookingsRes.rows.map(r => r.id as string);

    for (const bid of bookingIds) {
        await db.execute({ sql: "DELETE FROM messages WHERE booking_id=?", args: [bid] });
        await db.execute({ sql: "DELETE FROM transport_requests WHERE booking_id=?", args: [bid] });
        await db.execute({ sql: "DELETE FROM reviews WHERE booking_id=?", args: [bid] });
    }
    await db.execute({ sql: "DELETE FROM bookings WHERE listing_id=?", args: [lid] });
    await db.execute({ sql: "DELETE FROM activities WHERE listing_id=?", args: [lid] });
    await db.execute({ sql: "DELETE FROM rwa_tokens WHERE listing_id=?", args: [lid] });
}
await db.execute({ sql: "DELETE FROM listings WHERE host_id=?", args: [userId] });

// 2. ai_chat_threads
const threadsRes = await db.execute({ sql: "SELECT id FROM ai_chat_threads WHERE user_id=?", args: [userId] });
for (const t of threadsRes.rows) {
    await db.execute({ sql: "DELETE FROM ai_chat_messages WHERE thread_id=?", args: [t.id as string] });
}
await db.execute({ sql: "DELETE FROM ai_chat_threads WHERE user_id=?", args: [userId] });

// 3. Better Auth 테이블
await db.execute({ sql: "DELETE FROM session WHERE user_id=?", args: [userId] });
await db.execute({ sql: "DELETE FROM account WHERE user_id=?", args: [userId] });
await db.execute({ sql: "DELETE FROM verification WHERE identifier=?", args: [email] });
await db.execute({ sql: "DELETE FROM user WHERE id=?", args: [userId] });

console.log("완료. /auth 에서 동일 이메일로 회원가입하세요.");
