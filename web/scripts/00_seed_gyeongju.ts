/**
 * 00_seed_gyeongju.ts — 경주 파일럿 5채 DB 시드
 *
 * 실행 (로컬 DB):
 *   cd web
 *   npx tsx scripts/00_seed_gyeongju.ts
 *
 * 실행 (Turso 원격):
 *   cd web
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/00_seed_gyeongju.ts
 */

import { createClient } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// .env 파일 로드
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

const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({
    url: dbUrl,
    authToken: dbUrl.startsWith("file:") ? undefined : authToken,
});

const PROGRAM_ID = "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const TOTAL_SUPPLY = 100_000_000;
const KRW_PER_USDC = 1350;

const HOST_EMAIL = "admin@rural-rest.dev";

const LISTINGS = [
    {
        id: "3000",
        title: "황오동 청송재",
        description: "1960년대 한옥을 리모델링한 뉴트로 감성 숙소입니다. 황리단길까지 도보 8분 거리로 편리하며, 마당에서 황남빵 티타임을 즐기실 수 있습니다.",
        location: "경상북도 경주시 황오동",
        region: "경상",
        pricePerNight: 70_000,
        valuationKrw: 150_000_000,
        maxGuests: 4,
        lat: 35.8320,
        lng: 129.2150,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "간이 주방", "주차 1대"],
        images: ["/hwango.png"],
        renovationHistory: [
            { date: "2024.03", desc: "지붕 기와 교체 및 방수 처리" },
            { date: "2024.06", desc: "온돌 난방 시스템 현대화" },
            { date: "2024.09", desc: "내부 인테리어 뉴트로 감성 리모델링" },
            { date: "2025.01", desc: "마당 조경 및 외부 조명 설치" },
        ],
    },
    {
        id: "3001",
        title: "성건동 충재댁",
        description: "100년 된 종택을 리모델링한 전통 한옥 숙소입니다. 전통 다도 체험과 한복 대여가 포함되어 있으며, 첨성대까지 도보 5분 거리입니다.",
        location: "경상북도 경주시 성건동",
        region: "경상",
        pricePerNight: 90_000,
        valuationKrw: 200_000_000,
        maxGuests: 4,
        lat: 35.8360,
        lng: 129.2270,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "공용 화장실", "주차 1대"],
        images: ["/seonggon.png"],
        renovationHistory: [
            { date: "2023.11", desc: "종택 구조 안전 진단 및 보강" },
            { date: "2024.02", desc: "전통 한옥 외관 복원" },
            { date: "2024.05", desc: "다도실 및 한복 체험 공간 조성" },
            { date: "2024.10", desc: "화장실 현대화 및 편의시설 보강" },
        ],
    },
    {
        id: "3002",
        title: "동천동 신라숲",
        description: "배낭족과 청년 여행자를 위한 저가 도미토리입니다. 공용 주방과 불멍존, 자전거 무료 대여 등 편의시설이 갖춰져 있습니다.",
        location: "경상북도 경주시 동천동",
        region: "경상",
        pricePerNight: 25_000,
        valuationKrw: 120_000_000,
        maxGuests: 4,
        lat: 35.8550,
        lng: 129.2100,
        amenities: ["Wi-Fi", "에어컨", "공용 샤워실", "공용 주방", "세탁기", "주차 3대"],
        images: ["/dongcheon.png"],
        renovationHistory: [
            { date: "2024.04", desc: "빈집 철거 후 도미토리 신축" },
            { date: "2024.07", desc: "공용 주방 및 불멍존 시공" },
            { date: "2024.11", desc: "자전거 보관소 및 세탁실 설치" },
        ],
    },
    {
        id: "3003",
        title: "건천읍 월성",
        description: "농가주택을 리모델링한 농촌 체험 숙소입니다. 텃밭 체험과 워케이션 전용 책상이 마련되어 있어 디지털 노마드에게 적합합니다.",
        location: "경상북도 경주시 건천읍",
        region: "경상",
        pricePerNight: 55_000,
        valuationKrw: 100_000_000,
        maxGuests: 4,
        lat: 35.9250,
        lng: 129.1980,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "작업 책상", "주차 2대"],
        images: ["/geoncheon.png"],
        renovationHistory: [
            { date: "2024.01", desc: "농가주택 구조 보강 및 단열 공사" },
            { date: "2024.05", desc: "워케이션 전용 작업 공간 조성" },
            { date: "2024.08", desc: "텃밭 체험 구역 정비" },
            { date: "2025.02", desc: "온돌 난방 및 에어컨 설치" },
        ],
    },
    {
        id: "3004",
        title: "안강읍 석굴재",
        description: "가족 여행객과 시니어를 위한 농촌 힐링 숙소입니다. 계절별 농작물 수확 체험과 시골 밥상 조식, 마당 바베큐를 즐길 수 있습니다.",
        location: "경상북도 경주시 안강읍",
        region: "경상",
        pricePerNight: 65_000,
        valuationKrw: 130_000_000,
        maxGuests: 6,
        lat: 35.9500,
        lng: 129.1850,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "바베큐 그릴", "주차 3대"],
        images: ["/angang.png"],
        renovationHistory: [
            { date: "2024.02", desc: "농가주택 리모델링 착공" },
            { date: "2024.06", desc: "마당 바베큐 시설 및 조경 공사" },
            { date: "2024.09", desc: "객실 내부 마감 및 가구 배치" },
            { date: "2025.01", desc: "조식 주방 설비 및 수확 체험장 완공" },
        ],
    },
];

async function main() {
    const isRemote = dbUrl.startsWith("libsql://");
    const now = Math.floor(Date.now() / 1000);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Seed] 경주 파일럿 5채 (${isRemote ? "Turso 원격" : "로컬 DB"})`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 1. 호스트 유저
    const hostResult = await db.execute({ sql: "SELECT id FROM user WHERE email = ?", args: [HOST_EMAIL] });
    let hostId: string;

    if (hostResult.rows.length > 0) {
        hostId = hostResult.rows[0].id as string;
        await db.execute({ sql: "UPDATE user SET name = ? WHERE id = ?", args: ["마을지기", hostId] });
        console.log(`\n  [업데이트] 호스트: ${hostId} → 마을지기`);
    } else {
        hostId = uuidv4();
        await db.execute({
            sql: `INSERT INTO user (id, name, email, email_verified, role, preferred_lang, kyc_verified, created_at, updated_at)
                  VALUES (?, ?, ?, 1, 'host', 'ko', 1, ?, ?)`,
            args: [hostId, "마을지기", HOST_EMAIL, now, now],
        });
        console.log(`\n  [신규] 호스트: ${hostId}`);
    }

    // 2. listings + rwa_tokens
    for (const l of LISTINGS) {
        const existing = await db.execute({ sql: "SELECT id FROM listings WHERE id = ?", args: [l.id] });

        if (existing.rows.length > 0) {
            await db.execute({
                sql: `UPDATE listings SET
                        title = ?, description = ?,
                        price_per_night = ?, valuation_krw = ?, max_guests = ?,
                        location = ?, region = ?, amenities = ?, images = ?,
                        lat = ?, lng = ?, renovation_history = ?
                      WHERE id = ?`,
                args: [
                    l.title, l.description,
                    l.pricePerNight, l.valuationKrw, l.maxGuests,
                    l.location, l.region,
                    JSON.stringify(l.amenities), JSON.stringify(l.images),
                    l.lat, l.lng, JSON.stringify(l.renovationHistory),
                    l.id,
                ],
            });
            console.log(`  [업데이트] listing: ${l.id} ${l.title}`);
        } else {
            await db.execute({
                sql: `INSERT INTO listings (
                        id, host_id, title, description,
                        price_per_night, valuation_krw, max_guests,
                        location, region, amenities, images,
                        lat, lng, renovation_history, created_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    l.id, hostId, l.title, l.description,
                    l.pricePerNight, l.valuationKrw, l.maxGuests,
                    l.location, l.region,
                    JSON.stringify(l.amenities), JSON.stringify(l.images),
                    l.lat, l.lng, JSON.stringify(l.renovationHistory), now,
                ],
            });
            console.log(`  [신규] listing: ${l.id} ${l.title}`);
        }

        const existingToken = await db.execute({ sql: "SELECT id FROM rwa_tokens WHERE listing_id = ?", args: [l.id] });
        if (existingToken.rows.length > 0) {
            const pricePerTokenUsdc = Math.max(1, Math.round((l.valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000));
            await db.execute({
                sql: `UPDATE rwa_tokens SET
                        status = 'draft', valuation_krw = ?, price_per_token_usdc = ?, updated_at = ?
                      WHERE listing_id = ?`,
                args: [l.valuationKrw, pricePerTokenUsdc, now, l.id],
            });
            console.log(`         rwa_tokens: draft로 업데이트`);
        } else {
            const tokenId = uuidv4();
            const pricePerTokenUsdc = Math.max(1, Math.round((l.valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000));
            const fundingDeadline = now + 60 * 24 * 60 * 60;
            const symbol = `RURAL-${l.id}`;

            await db.execute({
                sql: `INSERT INTO rwa_tokens (
                        id, listing_id, symbol, total_supply, tokens_sold,
                        valuation_krw, price_per_token_usdc,
                        status, funding_deadline, estimated_apy_bps,
                        min_funding_bps, program_id, created_at, updated_at
                      ) VALUES (?, ?, ?, ?, 0, ?, ?, 'draft', ?, 0, 6000, ?, ?, ?)`,
                args: [
                    tokenId, l.id, symbol, TOTAL_SUPPLY,
                    l.valuationKrw, pricePerTokenUsdc,
                    fundingDeadline, PROGRAM_ID, now, now,
                ],
            });
            console.log(`         rwa_tokens: ${symbol}, price=${pricePerTokenUsdc} micro-USDC`);
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 경주 파일럿 5채 시드 완료");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
