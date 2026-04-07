/**
 * seed-rwa-investments.ts — fill-funding 으로 온체인 구매된 투자자 rwaInvestments DB 삽입
 *
 * fill-funding.ts 가 온체인 purchaseTokens는 성공했으나 DB 기록을 빠뜨린 경우 사용.
 * investor-N-keypair.json 파일에서 주소를 읽어 직접 삽입.
 *
 * 실행: cd web && npx tsx scripts/seed-rwa-investments.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 설정: Silla Forest Hostel 기준 ──────────────────────────────────────────
const RWA_TOKEN_ID = "ea237f6a-673f-4c9b-a878-bc6b3d0f0904";
const PRICE_PER_TOKEN_USDC = 891; // micro-USDC (pricePerTokenUsdc 필드값)
const TOTAL_SUPPLY = 100_000_000;
const MAX_PER_INVESTOR = Math.floor(TOTAL_SUPPLY * 3 / 10); // 30,000,000

// investor-1,2,3-keypair.json 에서 실제 구매 수량 계산
// fill-funding 실행 시 tokensSold=16,600,001 이었으므로 remaining=83,399,999
// chunk: 30,000,000 / 30,000,000 / 23,399,999
const INVESTORS: { keypairFile: string; tokenAmount: number }[] = [
    { keypairFile: "investor-1-keypair.json", tokenAmount: 30_000_000 },
    { keypairFile: "investor-2-keypair.json", tokenAmount: 30_000_000 },
    { keypairFile: "investor-3-keypair.json", tokenAmount: 23_399_999 },
];

async function main() {
    const { db } = await import("../app/db/index.server.js");
    const { rwaInvestments } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");

    console.log(`RWA Token: ${RWA_TOKEN_ID}\n`);

    for (const inv of INVESTORS) {
        const kpPath = path.join(__dirname, inv.keypairFile);
        if (!fs.existsSync(kpPath)) {
            console.warn(`  키페어 없음: ${inv.keypairFile} (스킵)`);
            continue;
        }

        const kp = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf-8")))
        );
        const walletAddress = kp.publicKey.toBase58();

        // 이미 존재하는지 확인
        const existing = await db.select({ id: rwaInvestments.id })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.walletAddress, walletAddress));

        if (existing.length > 0) {
            console.log(`  이미 존재: ${walletAddress.slice(0, 12)}... (스킵)`);
            continue;
        }

        await db.insert(rwaInvestments).values({
            id: uuidv4(),
            walletAddress,
            rwaTokenId: RWA_TOKEN_ID,
            tokenAmount: inv.tokenAmount,
            investedUsdc: inv.tokenAmount * PRICE_PER_TOKEN_USDC,
            purchaseTx: null,
            createdAt: new Date(),
        });

        console.log(`  삽입: ${walletAddress.slice(0, 12)}... → ${inv.tokenAmount.toLocaleString()} 토큰`);
    }

    // tokensSold도 맞춰서 업데이트
    const { rwaTokens } = await import("../app/db/schema.js");
    const totalFromInvestors = INVESTORS.reduce((sum, i) => sum + i.tokenAmount, 0);

    // 기존 real 투자자(8nYw...) 가 이미 16,600,001 보유 중
    // + 우리가 방금 넣은 83,399,999 = 100,000,000
    console.log(`\n총 투자 (스크립트 추가분): ${totalFromInvestors.toLocaleString()} 토큰`);
    console.log(`완료!`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
