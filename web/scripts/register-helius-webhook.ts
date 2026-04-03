/**
 * register-helius-webhook.ts — Helius devnet webhook 등록
 *
 * 실행:
 *   cd web && npx tsx scripts/register-helius-webhook.ts
 *
 * 필요한 .env:
 *   HELIUS_API_KEY=...
 *   HELIUS_WEBHOOK_SECRET=...  (선택, authorization 헤더 검증용)
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });

const API_KEY = process.env.HELIUS_API_KEY;
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET ?? "";
const WEBHOOK_URL = "https://rural-rest.vercel.app/api/webhooks/helius";
const RWA_PROGRAM_ID = process.env.VITE_RWA_PROGRAM_ID ?? "BAJ2fSZGZMkt6dFs4Rn5u8CCSsaVtgKbr5Jfca659iZr";

if (!API_KEY) {
    console.error("HELIUS_API_KEY가 .env에 없습니다");
    process.exit(1);
}

async function main() {
    console.log("=== Helius Webhook 등록 ===\n");
    console.log(`Webhook URL: ${WEBHOOK_URL}`);
    console.log(`Program ID:  ${RWA_PROGRAM_ID}`);
    console.log();

    // 기존 webhook 목록 조회
    const listRes = await fetch(
        `https://api-devnet.helius.xyz/v0/webhooks?api-key=${API_KEY}`
    );
    const existing: any[] = await listRes.json();
    console.log(`기존 webhook: ${existing.length}개`);

    // 동일 URL 중복 방지
    const duplicate = existing.find((w: any) => w.webhookURL === WEBHOOK_URL);
    if (duplicate) {
        console.log(`이미 등록됨: ${duplicate.webhookID}`);
        console.log("  → 삭제 후 재등록하려면 아래 ID로 DELETE 요청:");
        console.log(`  curl -X DELETE "https://api-devnet.helius.xyz/v0/webhooks/${duplicate.webhookID}?api-key=${API_KEY}"`);
        return;
    }

    // 새 webhook 등록
    const body: any = {
        webhookURL: WEBHOOK_URL,
        transactionTypes: ["Any"],
        accountAddresses: [RWA_PROGRAM_ID],
        webhookType: "enhanced",
    };
    if (WEBHOOK_SECRET) {
        body.authHeader = WEBHOOK_SECRET;
    }

    const res = await fetch(
        `https://api-devnet.helius.xyz/v0/webhooks?api-key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    );

    const data = await res.json();
    if (!res.ok) {
        console.error("등록 실패:", data);
        process.exit(1);
    }

    console.log("✓ Webhook 등록 완료!");
    console.log(`  ID:  ${data.webhookID}`);
    console.log(`  URL: ${data.webhookURL}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
