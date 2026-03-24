import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

await db.run(sql`
    UPDATE rwa_tokens
    SET estimated_apy_bps = CAST(ROUND(
        (SELECT price_per_night FROM listings WHERE listings.id = rwa_tokens.listing_id)
        * 365.0 * 0.55 * 0.30 / valuation_krw * 10000
    ) AS INTEGER)
    WHERE estimated_apy_bps = 0
`);

const rows = await db.run(sql`
    SELECT listing_id, estimated_apy_bps FROM rwa_tokens
`);
console.log("업데이트 결과:");
for (const row of rows.rows) {
    console.log(`  ${row.listing_id}: ${Number(row.estimated_apy_bps) / 100}%`);
}
process.exit(0);
