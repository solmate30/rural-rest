/**
 * 00_seed_gyeongju.ts — 경주 파일럿 5채 DB 시드
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/00_seed_gyeongju.ts
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../local.db");
const PROGRAM_ID = "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const TOTAL_SUPPLY = 100_000_000;
const KRW_PER_USDC = 1350;

const HOST_EMAIL = "admin@rural-rest.dev";

const LISTINGS = [
    {
        id: "3000",
        title: "황오동 청송재",
        description: "뉴트로 감성 한옥스테이, 황리단길 도보 8분",
        about: "1960년대 한옥을 리모델링한 뉴트로 감성 숙소입니다. 황리단길까지 도보 8분 거리로 편리하며, 마당에서 황남빵 티타임을 즐기실 수 있습니다.",
        location: "경상북도 경주시 황오동",
        region: "경상",
        pricePerNight: 70_000,
        valuationKrw: 150_000_000,
        maxGuests: 4,
        lat: 35.8320,
        lng: 129.2150,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "간이 주방", "주차 1대"],
        images: ["/hwango.png"],
    },
    {
        id: "3001",
        title: "성건동 충재댁",
        description: "100년 전통 한옥 체험, 첨성대 도보 5분",
        about: "100년 된 종택을 리모델링한 전통 한옥 숙소입니다. 전통 다도 체험과 한복 대여가 포함되어 있으며, 첨성대까지 도보 5분 거리입니다.",
        location: "경상북도 경주시 성건동",
        region: "경상",
        pricePerNight: 90_000,
        valuationKrw: 200_000_000,
        maxGuests: 4,
        lat: 35.8360,
        lng: 129.2270,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "공용 화장실", "주차 1대"],
        images: ["/seonggon.png"],
    },
    {
        id: "3002",
        title: "동천동 신라숲",
        description: "저가 도미토리, 경주역 도보 10분",
        about: "배낭족과 청년 여행자를 위한 저가 도미토리입니다. 공용 주방과 불멍존, 자전거 무료 대여 등 편의시설이 갖춰져 있습니다.",
        location: "경상북도 경주시 동천동",
        region: "경상",
        pricePerNight: 25_000,
        valuationKrw: 120_000_000,
        maxGuests: 4,
        lat: 35.8550,
        lng: 129.2100,
        amenities: ["Wi-Fi", "에어컨", "공용 샤워실", "공용 주방", "세탁기", "주차 3대"],
        images: ["/dongcheon.png"],
    },
    {
        id: "3003",
        title: "건천읍 월성",
        description: "농촌 체험 한옥, 디지털 디톡스",
        about: "농가주택을 리모델링한 농촌 체험 숙소입니다. 텃밭 체험과 워케이션 전용 책상이 마련되어 있어 디지털 노마드에게 적합합니다.",
        location: "경상북도 경주시 건천읍",
        region: "경상",
        pricePerNight: 55_000,
        valuationKrw: 100_000_000,
        maxGuests: 4,
        lat: 35.9250,
        lng: 129.1980,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "작업 책상", "주차 2대"],
        images: ["/geoncheon.png"],
    },
    {
        id: "3004",
        title: "안강읍 석굴재",
        description: "농촌 힐링 숙소, 가족 여행 최적",
        about: "가족 여행객과 시니어를 위한 농촌 힐링 숙소입니다. 계절별 농작물 수확 체험과 시골 밥상 조식, 마당 바베큐를 즐길 수 있습니다.",
        location: "경상북도 경주시 안강읍",
        region: "경상",
        pricePerNight: 65_000,
        valuationKrw: 130_000_000,
        maxGuests: 6,
        lat: 35.9500,
        lng: 129.1850,
        amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "바베큐 그릴", "주차 3대"],
        images: ["/angang.png"],
    },
];

async function main() {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`오류: DB 파일이 없습니다: ${DB_PATH}`);
        console.error("npm run dev 를 한 번 실행하면 DB가 초기화됩니다.");
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    const now = Math.floor(Date.now() / 1000);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  [Seed] 경주 파일럿 5채");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // 1. 호스트 유저
    let hostRow = db.prepare("SELECT id FROM user WHERE email = ?").get(HOST_EMAIL) as { id: string } | undefined;
    if (hostRow) {
        console.log(`\n  [재사용] 호스트: ${hostRow.id}`);
    } else {
        const hostId = uuidv4();
        db.prepare(`
            INSERT INTO user (id, name, email, email_verified, role, preferred_lang, kyc_verified, created_at, updated_at)
            VALUES (?, ?, ?, 1, 'host', 'ko', 1, ?, ?)
        `).run(hostId, "Rural Rest 경주팀", HOST_EMAIL, now, now);
        hostRow = { id: hostId };
        console.log(`\n  [신규] 호스트: ${hostId}`);
    }

    // 2. listings + rwa_tokens
    for (const l of LISTINGS) {
        const existingListing = db.prepare("SELECT id FROM listings WHERE id = ?").get(l.id);
        if (existingListing) {
            console.log(`  [재사용] listing: ${l.id} ${l.title}`);
        } else {
            db.prepare(`
                INSERT INTO listings (
                    id, host_id, title, description,
                    price_per_night, valuation_krw, max_guests,
                    location, region, amenities, images,
                    lat, lng, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                l.id, hostRow.id, l.title, l.description,
                l.pricePerNight, l.valuationKrw, l.maxGuests,
                l.location, l.region,
                JSON.stringify(l.amenities), JSON.stringify(l.images),
                l.lat, l.lng, now
            );
            console.log(`  [신규] listing: ${l.id} ${l.title}`);
        }

        const existingToken = db.prepare("SELECT id FROM rwa_tokens WHERE listing_id = ?").get(l.id);
        if (existingToken) {
            console.log(`         rwa_tokens: 재사용`);
        } else {
            const tokenId = uuidv4();
            const pricePerTokenUsdc = Math.max(1, Math.round((l.valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000));
            const fundingDeadline = now + 60 * 24 * 60 * 60; // 60일 후
            const symbol = `RURAL-${l.id}`;

            db.prepare(`
                INSERT INTO rwa_tokens (
                    id, listing_id, symbol, total_supply, tokens_sold,
                    valuation_krw, price_per_token_usdc,
                    status, funding_deadline, estimated_apy_bps,
                    min_funding_bps, program_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 0, ?, ?, 'funding', ?, 0, 6000, ?, ?, ?)
            `).run(
                tokenId, l.id, symbol, TOTAL_SUPPLY,
                l.valuationKrw, pricePerTokenUsdc,
                fundingDeadline, PROGRAM_ID, now, now
            );
            console.log(`         rwa_tokens: ${symbol}, price=${pricePerTokenUsdc} micro-USDC`);
        }
    }

    db.close();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 경주 파일럿 5채 시드 완료");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
