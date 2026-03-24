/**
 * 경주 파일럿 시드 데이터
 * 실행: npx tsx scripts/seed.ts
 *
 * 삽입 순서:
 *   1. SPV host 5개 (법적 주체)
 *   2. 마을 운영자 5명 (실제 운영·정산 수령)
 *   3. listings 5채 (hostId=SPV, operatorId=마을운영자)
 *   4. rwaTokens 5개
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import * as schema from "../app/db/schema";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// ── 고정 ID (재실행 시 중복 삽입 방지) ────────────────────────────────────

// SPV host 계정 (1 집 = 1 SPV)
const SPV_IDS = {
    hwangO:    "seed-spv-3000-hwango",
    seongGeon: "seed-spv-3001-seonggon",
    dongCheon: "seed-spv-3002-dongcheon",
    geonCheon: "seed-spv-3003-geoncheon",
    anGang:    "seed-spv-3004-angang",
};

// 마을 운영자 계정
const OPERATOR_IDS = {
    hwangO:    "seed-op-3000-hwango",
    seongGeon: "seed-op-3001-seonggon",
    dongCheon: "seed-op-3002-dongcheon",
    geonCheon: "seed-op-3003-geoncheon",
    anGang:    "seed-op-3004-angang",
};

const LISTING_IDS = {
    hwangO:    "seed-listing-gyeongju-3000",
    seongGeon: "seed-listing-gyeongju-3001",
    dongCheon: "seed-listing-gyeongju-3002",
    geonCheon: "seed-listing-gyeongju-3003",
    anGang:    "seed-listing-gyeongju-3004",
};

const RWA_IDS = {
    hwangO:    "seed-rwa-gyeongju-3000",
    seongGeon: "seed-rwa-gyeongju-3001",
    dongCheon: "seed-rwa-gyeongju-3002",
    geonCheon: "seed-rwa-gyeongju-3003",
    anGang:    "seed-rwa-gyeongju-3004",
};

// 개발용 더미 Solana Token Mint 주소
const DUMMY_MINTS = {
    hwangO:    "GYEJchsReH1aW3oWqrPhUVotajCQNdUHaijWRbB3000A",
    seongGeon: "GYEJchsReH1aW3oWqrPhUVotajCQNdUHaijWRbB3001A",
    dongCheon: "GYEJchsReH1aW3oWqrPhUVotajCQNdUHaijWRbB3002A",
    geonCheon: "GYEJchsReH1aW3oWqrPhUVotajCQNdUHaijWRbB3003A",
    anGang:    "GYEJchsReH1aW3oWqrPhUVotajCQNdUHaijWRbB3004A",
};

const PROGRAM_ID_PLACEHOLDER = "RuRaLrEsTpRoGrAmXXXXXXXXXXXXXXXXXXXXXXXXX";

const fundingDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
const now = new Date();

async function seed() {
    console.log("시드 데이터 삽입 시작...\n");

    // ── 1. SPV host 계정 5개 ───────────────────────────────────────────────
    await db
        .insert(schema.user)
        .values([
            {
                id: SPV_IDS.hwangO,
                name: "SPV-3000 주식회사 (황오동 청송재)",
                email: "spv-3000@rural-rest.dev",
                emailVerified: true,
                role: "host",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: SPV_IDS.seongGeon,
                name: "SPV-3001 주식회사 (성건동 충재댁)",
                email: "spv-3001@rural-rest.dev",
                emailVerified: true,
                role: "host",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: SPV_IDS.dongCheon,
                name: "SPV-3002 주식회사 (동천동 신라숲)",
                email: "spv-3002@rural-rest.dev",
                emailVerified: true,
                role: "host",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: SPV_IDS.geonCheon,
                name: "SPV-3003 주식회사 (건천읍 월성)",
                email: "spv-3003@rural-rest.dev",
                emailVerified: true,
                role: "host",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: SPV_IDS.anGang,
                name: "SPV-3004 주식회사 (안강읍 석굴재)",
                email: "spv-3004@rural-rest.dev",
                emailVerified: true,
                role: "host",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
        ])
        .onConflictDoNothing();

    console.log("✓ SPV host 계정 5개 삽입");

    // ── 2. 마을 운영자 계정 5명 ────────────────────────────────────────────
    // 실제 운영(체크인·청소·유지보수)을 담당, 영업이익의 30% 정산 수령
    await db
        .insert(schema.user)
        .values([
            {
                id: OPERATOR_IDS.hwangO,
                name: "김황오 (황오동 청송재 운영자)",
                email: "op-hwango@rural-rest.dev",
                emailVerified: true,
                role: "operator",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: OPERATOR_IDS.seongGeon,
                name: "이성건 (성건동 충재댁 운영자)",
                email: "op-seonggon@rural-rest.dev",
                emailVerified: true,
                role: "operator",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: OPERATOR_IDS.dongCheon,
                name: "박동천 (동천동 신라숲 운영자)",
                email: "op-dongcheon@rural-rest.dev",
                emailVerified: true,
                role: "operator",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: OPERATOR_IDS.geonCheon,
                name: "최건천 (건천읍 월성 운영자)",
                email: "op-geoncheon@rural-rest.dev",
                emailVerified: true,
                role: "operator",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
            {
                id: OPERATOR_IDS.anGang,
                name: "정안강 (안강읍 석굴재 운영자)",
                email: "op-angang@rural-rest.dev",
                emailVerified: true,
                role: "operator",
                preferredLang: "ko",
                createdAt: now,
                updatedAt: now,
            },
        ])
        .onConflictDoNothing();

    console.log("✓ 마을 운영자 계정 5명 삽입");

    // ── 3. 매물 5채 ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
        .insert(schema.listings)
        .values([
            {
                id: LISTING_IDS.hwangO,
                hostId: SPV_IDS.hwangO,
                operatorId: OPERATOR_IDS.hwangO,
                title: "황오동 청송재",
                description:
                    "황리단길 도보 8분, 경주 구도심 골목 안쪽에 자리한 레트로 감성 게스트하우스. " +
                    "1970년대 단층 한옥을 되살려 낮에는 마당 평상에서 황남빵 티타임을, 밤에는 옥상 테라스에서 별을 볼 수 있습니다. " +
                    "혼자 또는 둘이 오기 딱 좋은 아늑한 두 평 마당이 있어요.",
                pricePerNight: 70000,
                maxGuests: 2,
                location: "경상북도 경주시 황오동 일대",
                region: "경상",
                lat: 35.8320,
                lng: 129.2150,
                amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "간이 주방", "주차 1대", "옥상 테라스"],
                images: ["/hwango.png"],
                renovationHistory: [
                    { date: "2023.09", desc: "기초 구조 진단 — 담장·기단 원형 보존 결정" },
                    { date: "2024.03", desc: "기와지붕 복원 및 목구조 보강 완료" },
                    { date: "2024.09", desc: "황토 미장 인테리어·옥상 테라스 조성, Rural Rest 등록" },
                ],
                transportSupport: false,
                smartLockEnabled: false,
            },
            {
                id: LISTING_IDS.seongGeon,
                hostId: SPV_IDS.seongGeon,
                operatorId: OPERATOR_IDS.seongGeon,
                title: "성건동 충재댁",
                description:
                    "성건동 오래된 단독주택을 리모델링한 전통 감성 숙소. 첨성대 도보 5분, 대릉원 도보 8분. " +
                    "전통 다도 체험 및 한복 무료 대여 포함, 아침 죽 조식 제공.",
                pricePerNight: 90000,
                maxGuests: 2,
                location: "경상북도 경주시 성건동 일대",
                region: "경상",
                lat: 35.8345,
                lng: 129.2245,
                amenities: ["Wi-Fi", "에어컨", "온돌 난방", "공용 화장실", "주차 1대", "한복 대여", "조식 포함"],
                images: ["/seonggon.png"],
                renovationHistory: [
                    { date: "2024.01", desc: "외벽 방수 처리 및 전통 문양 복원" },
                    { date: "2024.06", desc: "온돌 시스템 교체 및 내부 한옥 인테리어 완성" },
                    { date: "2024.10", desc: "다도실·한복 보관실 조성 완료, Rural Rest 등록" },
                ],
                transportSupport: false,
                smartLockEnabled: false,
            },
            {
                id: LISTING_IDS.dongCheon,
                hostId: SPV_IDS.dongCheon,
                operatorId: OPERATOR_IDS.dongCheon,
                title: "동천동 신라숲",
                description:
                    "경주 시내와 보문관광단지 사이, 신라 고분군을 걸어서 닿을 수 있는 4인 도미토리. " +
                    "배낭 여행자·청년 여행객을 위한 저가 베이스캠프로, 자전거 무료 대여·불멍존·공용 주방이 갖춰져 있습니다. " +
                    "하루 2만 원대로 경주를 온몸으로 즐기세요.",
                pricePerNight: 25000,
                maxGuests: 4,
                location: "경상북도 경주시 동천동 일대",
                region: "경상",
                lat: 35.8550,
                lng: 129.2100,
                amenities: ["Wi-Fi", "에어컨", "공용 샤워실", "공용 주방", "세탁기", "자전거 무료 대여", "주차 3대"],
                images: ["/dongcheon.png"],
                renovationHistory: [
                    { date: "2025.02", desc: "기초 구조 진단 및 안전 보강 설계 완료" },
                    { date: "2025.06", desc: "도미토리 4인실 구조 설계 및 공용 주방 증축" },
                    { date: "2025.10", desc: "자전거 보관소·불멍존 조성, Rural Rest 등록" },
                ],
                transportSupport: false,
                smartLockEnabled: false,
            },
            {
                id: LISTING_IDS.geonCheon,
                hostId: SPV_IDS.geonCheon,
                operatorId: OPERATOR_IDS.geonCheon,
                title: "건천읍 월성",
                description:
                    "경주 외곽 건천 들녘 한가운데 자리한 농가주택 독채. 디지털 디톡스·워케이션에 특화된 공간으로, " +
                    "작업 전용 책상과 고속 인터넷, 텃밭 체험, 전통 장 담그기 프로그램이 포함되어 있습니다. " +
                    "도심 소음과 완전히 단절된 곳에서 집중하고 싶다면 여기로 오세요.",
                pricePerNight: 55000,
                maxGuests: 2,
                location: "경상북도 경주시 건천읍 일대",
                region: "경상",
                lat: 35.9250,
                lng: 129.1980,
                amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "작업 책상", "텃밭 체험", "주차 2대"],
                images: ["/geoncheon.png"],
                renovationHistory: [
                    { date: "2024.03", desc: "농가주택 구조 보강 및 외벽 단열 공사 완료" },
                    { date: "2024.08", desc: "워케이션 특화 내부 설계 — 작업 책상·고속 인터넷 설치" },
                    { date: "2024.12", desc: "텃밭 조성 및 전통 장 담그기 체험 공간 완성, Rural Rest 등록" },
                ],
                transportSupport: false,
                smartLockEnabled: false,
            },
            {
                id: LISTING_IDS.anGang,
                hostId: SPV_IDS.anGang,
                operatorId: OPERATOR_IDS.anGang,
                title: "안강읍 석굴재",
                description:
                    "불국사 차량 20분, 안강 너른 들판이 마당 끝까지 펼쳐지는 농가 독채. " +
                    "봄엔 딸기·봄나물, 가을엔 사과·고구마 직접 수확하고, 저녁엔 마당 바베큐·불멍. " +
                    "아침은 직접 지은 경주 쌀밥 시골 밥상으로 시작됩니다.",
                pricePerNight: 65000,
                maxGuests: 4,
                location: "경상북도 경주시 안강읍 일대",
                region: "경상",
                lat: 35.9500,
                lng: 129.1850,
                amenities: ["Wi-Fi", "에어컨", "온돌 난방", "개별 화장실", "주방", "바베큐 그릴", "조식 포함", "주차 3대"],
                images: ["/angang.png"],
                renovationHistory: [
                    { date: "2023.11", desc: "농가주택 매입 및 기초 구조 진단 완료" },
                    { date: "2024.05", desc: "주택 구조 보강 및 전통 마당 석축 복원" },
                    { date: "2024.11", desc: "바베큐 시설·농작물 수확 체험장 조성, Rural Rest 등록" },
                ],
                transportSupport: false,
                smartLockEnabled: false,
            },
        ] as any)
        .onConflictDoUpdate({
            target: schema.listings.id,
            set: {
                lat: sql`excluded.lat`,
                lng: sql`excluded.lng`,
                images: sql`excluded.images`,
                renovationHistory: sql`excluded.renovation_history`,
                region: sql`excluded.region`,
                amenities: sql`excluded.amenities`,
                description: sql`excluded.description`,
            },
        });

    console.log("✓ 매물 5채 삽입");

    // ── 4. RWA 토큰 5개 ────────────────────────────────────────────────────
    // pricePerTokenUsdc: micro-USDC (소수점 6자리), 기준 1 USDC ≈ 1,350 KRW
    await db
        .insert(schema.rwaTokens)
        .values([
            {
                id: RWA_IDS.hwangO,
                listingId: LISTING_IDS.hwangO,
                tokenMint: DUMMY_MINTS.hwangO,
                totalSupply: 10000,
                tokensSold: 7800,            // 78% 모집 진행 중
                estimatedApyBps: 820,        // 8.2%
                valuationKrw: 50_000_000,
                pricePerTokenUsdc: 3_700_000, // ~3.7 USDC
                status: "funding",
                fundingDeadline,
                minFundingBps: 6000,
                programId: PROGRAM_ID_PLACEHOLDER,
            },
            {
                id: RWA_IDS.seongGeon,
                listingId: LISTING_IDS.seongGeon,
                tokenMint: DUMMY_MINTS.seongGeon,
                totalSupply: 10000,
                tokensSold: 4500,            // 45%
                estimatedApyBps: 950,        // 9.5%
                valuationKrw: 80_000_000,
                pricePerTokenUsdc: 5_900_000, // ~5.9 USDC
                status: "funding",
                fundingDeadline,
                minFundingBps: 6000,
                programId: PROGRAM_ID_PLACEHOLDER,
            },
            {
                id: RWA_IDS.dongCheon,
                listingId: LISTING_IDS.dongCheon,
                tokenMint: DUMMY_MINTS.dongCheon,
                totalSupply: 10000,
                tokensSold: 2800,            // 28%
                estimatedApyBps: 780,        // 7.8%
                valuationKrw: 45_000_000,
                pricePerTokenUsdc: 3_300_000, // ~3.3 USDC
                status: "funding",
                fundingDeadline,
                minFundingBps: 6000,
                programId: PROGRAM_ID_PLACEHOLDER,
            },
            {
                id: RWA_IDS.geonCheon,
                listingId: LISTING_IDS.geonCheon,
                tokenMint: DUMMY_MINTS.geonCheon,
                totalSupply: 10000,
                tokensSold: 10000,           // 100% → 운영 중
                estimatedApyBps: 880,        // 8.8%
                valuationKrw: 35_000_000,
                pricePerTokenUsdc: 2_600_000, // ~2.6 USDC
                status: "active",
                fundingDeadline,
                minFundingBps: 6000,
                programId: PROGRAM_ID_PLACEHOLDER,
            },
            {
                id: RWA_IDS.anGang,
                listingId: LISTING_IDS.anGang,
                tokenMint: DUMMY_MINTS.anGang,
                totalSupply: 10000,
                tokensSold: 1200,            // 12%
                estimatedApyBps: 920,        // 9.2%
                valuationKrw: 40_000_000,
                pricePerTokenUsdc: 3_000_000, // 3.0 USDC
                status: "funding",
                fundingDeadline,
                minFundingBps: 6000,
                programId: PROGRAM_ID_PLACEHOLDER,
            },
        ])
        .onConflictDoNothing();

    console.log("✓ RWA 토큰 5개 삽입");
    console.log("\n시드 완료.");
    process.exit(0);
}

seed().catch((err) => {
    console.error("시드 실패:", err);
    process.exit(1);
});
