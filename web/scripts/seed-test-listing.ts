/**
 * 테스트 매물 시드 스크립트
 * 실행: cd web && npx tsx scripts/seed-test-listing.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

import { randomUUID } from "crypto";

const LISTINGS = [
    {
        id: "3001",
        nodeNumber: 3001,
        title: "Hwango Cheongsongjae",
        titleEn: "Hwango Cheongsongjae",
        description: "A restored 1960s hanok with a retro-modern sensibility. Just 8 minutes on foot from Hwangnidan-gil, with a traditional courtyard perfect for afternoon tea.",
        descriptionEn: "A restored 1960s hanok with a retro-modern sensibility. Just 8 minutes on foot from Hwangnidan-gil, with a traditional courtyard perfect for afternoon tea.",
        location: "Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 70_000,
        valuationKrw: 75_000_000, // ~$54K → $0.000543/token, $50 ≈ 92K tokens
        maxGuests: 4,
        lat: 35.8320,
        lng: 129.2150,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchenette", "Parking x1"],
        images: ["/hwango.webp"],
        renovationHistory: [
            { date: "2024.03", desc: "Roof tile replacement and waterproofing" },
            { date: "2024.06", desc: "Ondol heating system modernization" },
            { date: "2024.09", desc: "Interior retro-modern remodeling" },
            { date: "2025.01", desc: "Garden landscaping and exterior lighting" },
        ],
    },
    {
        id: "3002",
        nodeNumber: 3002,
        title: "Sunggeon Chungjae Manor",
        titleEn: "Sunggeon Chungjae Manor",
        description: "A century-old clan house lovingly restored. Traditional tea ceremony and hanbok rental included, just a 5-minute walk from Cheomseongdae Observatory.",
        descriptionEn: "A century-old clan house lovingly restored. Traditional tea ceremony and hanbok rental included, just a 5-minute walk from Cheomseongdae Observatory.",
        location: "Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 90_000,
        valuationKrw: 88_000_000, // ~$63.7K → $0.000637/token, $50 ≈ 78K tokens
        maxGuests: 4,
        lat: 35.8360,
        lng: 129.2270,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Shared Bathroom", "Parking x1"],
        images: ["/seonggon.webp"],
        renovationHistory: [
            { date: "2023.11", desc: "Structural safety inspection and reinforcement" },
            { date: "2024.02", desc: "Traditional hanok exterior restoration" },
            { date: "2024.05", desc: "Tea ceremony room and hanbok experience space" },
            { date: "2024.10", desc: "Bathroom modernization and amenity upgrades" },
        ],
    },
    {
        id: "3003",
        nodeNumber: 3003,
        title: "Dongcheon Silla Forest Hostel",
        titleEn: "Dongcheon Silla Forest Hostel",
        description: "Budget-friendly dormitory for backpackers and young explorers. Shared kitchen, bonfire corner, and complimentary bicycle rental included.",
        descriptionEn: "Budget-friendly dormitory for backpackers and young explorers. Shared kitchen, bonfire corner, and complimentary bicycle rental included.",
        location: "Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 25_000,
        valuationKrw: 69_000_000, // 50,000 USDC @ 1,380 KRW/USDC — token price 0.0005 USDC, 500 USDC = 1,000,000 tokens
        maxGuests: 4,
        lat: 35.8550,
        lng: 129.2100,
        amenities: ["Wi-Fi", "Air Conditioning", "Shared Shower", "Shared Kitchen", "Laundry", "Parking x3"],
        images: ["/dongcheon.webp"],
        renovationHistory: [
            { date: "2024.04", desc: "Demolished vacant building, new dormitory built" },
            { date: "2024.07", desc: "Shared kitchen and bonfire area constructed" },
            { date: "2024.11", desc: "Bicycle storage and laundry room installed" },
        ],
    },
    {
        id: "3004",
        nodeNumber: 3004,
        title: "Geoncheon Wolseong Farm Stay",
        titleEn: "Geoncheon Wolseong Farm Stay",
        description: "A renovated farmhouse with a kitchen garden and dedicated workation desk. The perfect retreat for digital nomads seeking slow living.",
        descriptionEn: "A renovated farmhouse with a kitchen garden and dedicated workation desk. The perfect retreat for digital nomads seeking slow living.",
        location: "Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 55_000,
        valuationKrw: 60_000_000, // ~$43.5K → $0.000435/token, $50 ≈ 115K tokens
        maxGuests: 4,
        lat: 35.9250,
        lng: 129.1980,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchen", "Work Desk", "Parking x2"],
        images: ["/geoncheon.webp"],
        renovationHistory: [
            { date: "2024.01", desc: "Structural reinforcement and insulation work" },
            { date: "2024.05", desc: "Dedicated workation workspace set up" },
            { date: "2024.08", desc: "Kitchen garden area landscaped" },
            { date: "2025.02", desc: "Ondol heating and air conditioning installed" },
        ],
    },
    {
        id: "3005",
        nodeNumber: 3005,
        title: "Angang Seokguljae Country House",
        titleEn: "Angang Seokguljae Country House",
        description: "A rural healing escape for families and seniors. Seasonal harvest activities, wholesome country breakfast, and backyard barbecue await.",
        descriptionEn: "A rural healing escape for families and seniors. Seasonal harvest activities, wholesome country breakfast, and backyard barbecue await.",
        location: "Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 65_000,
        valuationKrw: 95_000_000, // ~$68.8K → $0.000688/token, $50 ≈ 73K tokens
        maxGuests: 6,
        lat: 35.9500,
        lng: 129.1850,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchen", "BBQ Grill", "Parking x3"],
        images: ["/angang.webp"],
        renovationHistory: [
            { date: "2024.02", desc: "Farmhouse remodeling commenced" },
            { date: "2024.06", desc: "Backyard BBQ facility and landscaping" },
            { date: "2024.09", desc: "Interior finishing and furniture setup" },
            { date: "2025.01", desc: "Breakfast kitchen and harvest experience area completed" },
        ],
    },
];

async function main() {
    const { db } = await import("../app/db/index.server");
    const { listings, user } = await import("../app/db/schema");

    // admin 유저 찾기
    const allUsers = await db.select({ id: user.id, name: user.name, role: user.role, wallet: user.walletAddress }).from(user);
    if (allUsers.length === 0) {
        console.error("유저가 없습니다. 먼저 로그인해주세요.");
        process.exit(1);
    }
    console.log("DB 유저 목록:");
    console.table(allUsers);

    const admin = allUsers.find(u => u.role === "admin") ?? allUsers[0];
    console.log(`\nhostId: ${admin.name} (${admin.id})\n`);

    // 기존 데이터 삭제 후 재삽입 (FK 순서: 자식 → 부모)
    const { inArray } = await import("drizzle-orm");
    const {
        bookings, reviews, activities, messages, transportRequests,
        rwaTokens, rwaInvestments, rwaDividends,
        operatorSettlements, settlements, localGovSettlements,
    } = await import("../app/db/schema");
    const ids = LISTINGS.map(l => l.id);

    // rwaTokens의 id를 먼저 수집해서 rwaDividends/rwaInvestments 삭제
    // rwaTokens id 수집 → rwaDividends, rwaInvestments 삭제
    const tokenRows = await db.select({ id: rwaTokens.id }).from(rwaTokens).where(inArray(rwaTokens.listingId, ids));
    const tokenIds = tokenRows.map(r => r.id);
    if (tokenIds.length > 0) {
        await db.delete(rwaDividends).where(inArray(rwaDividends.rwaTokenId, tokenIds));
        await db.delete(rwaInvestments).where(inArray(rwaInvestments.rwaTokenId, tokenIds));
    }

    // bookings id 수집 → messages, transportRequests 삭제
    const bookingRows = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.listingId, ids));
    const bookingIds = bookingRows.map(r => r.id);
    if (bookingIds.length > 0) {
        await db.delete(transportRequests).where(inArray(transportRequests.bookingId, bookingIds));
        await db.delete(messages).where(inArray(messages.bookingId, bookingIds));
        await db.delete(reviews).where(inArray(reviews.bookingId, bookingIds));
    }

    await db.delete(localGovSettlements).where(inArray(localGovSettlements.listingId, ids));
    await db.delete(settlements).where(inArray(settlements.listingId, ids));
    await db.delete(operatorSettlements).where(inArray(operatorSettlements.listingId, ids));
    await db.delete(rwaTokens).where(inArray(rwaTokens.listingId, ids));
    await db.delete(activities).where(inArray(activities.listingId, ids));
    await db.delete(bookings).where(inArray(bookings.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
    console.log("기존 매물 및 연관 데이터 삭제 완료\n");

    for (const listing of LISTINGS) {
        await db.insert(listings).values({
            id: listing.id,
            nodeNumber: listing.nodeNumber,
            hostId: admin.id,
            title: listing.title,
            titleEn: listing.titleEn,
            description: listing.description,
            descriptionEn: listing.descriptionEn,
            location: listing.location,
            region: listing.region,
            pricePerNight: listing.pricePerNight,
            valuationKrw: listing.valuationKrw,
            maxGuests: listing.maxGuests,
            lat: listing.lat,
            lng: listing.lng,
            amenities: listing.amenities,
            images: listing.images,
            renovationHistory: listing.renovationHistory,
        }).onConflictDoNothing();
        console.log(`  추가: ${listing.title} (${listing.id})`);
    }

    console.log(`\n총 ${LISTINGS.length}개 매물 시드 완료!`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
