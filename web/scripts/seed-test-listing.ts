/**
 * 테스트용 저렴한 매물 추가
 * 실행: cd web && npx tsx scripts/seed-test-listing.ts
 */
// 강제 local DB 사용
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = ""; // 로컬DB는 토큰 불필요

import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

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

    // admin 우선, 없으면 첫번째 유저
    const admin = allUsers.find(u => u.role === "admin") ?? allUsers[0];
    console.log(`\nhostId: ${admin.name} (${admin.id})`);

    const id = randomUUID().replace(/-/g, "");
    await db.insert(listings).values({
        id,
        hostId: admin.id,
        operatorId: admin.id,
        title: "테스트 한옥 (저렴)",
        description: "RWA 펀딩 테스트용 저렴한 매물입니다. 토큰 가격 0.01 USDC.",
        pricePerNight: 30000,       // 1박 3만원
        valuationKrw: 100000,      // 감정가 10만원
        maxGuests: 4,
        location: "경주시 테스트동",
        region: "경상",
        amenities: ["WiFi", "주차"],
        images: ["/house.png"],
        lat: 35.8562,
        lng: 129.2247,
    });

    console.log(`\n매물 추가 완료!`);


    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
