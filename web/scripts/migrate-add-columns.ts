/**
 * listings 테이블에 lat, lng, renovation_history, region 컬럼 수동 추가
 * 실행: npx tsx scripts/migrate-add-columns.ts
 *
 * drizzle-kit push 버그 workaround — 컬럼이 없을 때 pull 단계에서 에러 발생
 */

import { createClient } from "@libsql/client";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const migrations = [
    `ALTER TABLE listings ADD COLUMN region TEXT NOT NULL DEFAULT '기타'`,
    `ALTER TABLE listings ADD COLUMN lat REAL`,
    `ALTER TABLE listings ADD COLUMN lng REAL`,
    `ALTER TABLE listings ADD COLUMN renovation_history TEXT DEFAULT '[]'`,
];

async function run() {
    for (const sql of migrations) {
        try {
            await client.execute(sql);
            const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
            console.log(`✓ ${col} 컬럼 추가`);
        } catch (e: any) {
            if (e?.message?.includes("duplicate column")) {
                const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
                console.log(`- ${col} 이미 존재, 건너뜀`);
            } else {
                throw e;
            }
        }
    }
    console.log("\n완료");
}

run().catch(console.error);
