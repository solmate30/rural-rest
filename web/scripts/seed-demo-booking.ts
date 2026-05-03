/**
 * 정산 데모용 예약 시드 스크립트
 * 실행: cd web && npx tsx scripts/seed-demo-booking.ts
 * 선행 조건: seed-test-listing.ts 실행 완료 (listingId 3001~3005 필요)
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

import { randomUUID } from "crypto";

async function main() {
    const { db } = await import("../app/db/index.server");
    const { bookings, user, listings } = await import("../app/db/schema");

    const allUsers = await db.select({ id: user.id, name: user.name, role: user.role }).from(user);
    const guest = allUsers.find(u => u.role === "guest" && u.name === "한수연") ?? allUsers.find(u => u.role === "guest");
    if (!guest) { console.error("guest 계정 없음"); process.exit(1); }

    const allListings = await db.select({ id: listings.id, title: listings.title, pricePerNight: listings.pricePerNight }).from(listings);
    console.log("매물 목록:"); console.table(allListings);

    const DEMO_BOOKINGS = [
        { listingId: "3001", checkIn: "2026-03-01", nights: 5 },
        { listingId: "3001", checkIn: "2026-03-08", nights: 4 },
        { listingId: "3001", checkIn: "2026-03-15", nights: 6 },
        { listingId: "3002", checkIn: "2026-03-02", nights: 5 },
        { listingId: "3002", checkIn: "2026-03-10", nights: 7 },
        { listingId: "3003", checkIn: "2026-03-03", nights: 4 },
        { listingId: "3003", checkIn: "2026-03-20", nights: 5 },
        { listingId: "3004", checkIn: "2026-03-05", nights: 6 },
        { listingId: "3004", checkIn: "2026-03-18", nights: 4 },
        { listingId: "3005", checkIn: "2026-03-07", nights: 5 },
        { listingId: "3005", checkIn: "2026-03-22", nights: 6 },
    ];

    for (const b of DEMO_BOOKINGS) {
        const listing = allListings.find(l => l.id === b.listingId);
        if (!listing) { console.warn(`listing ${b.listingId} 없음 — 스킵`); continue; }

        const checkIn  = new Date(b.checkIn);
        const checkOut = new Date(b.checkIn);
        checkOut.setDate(checkOut.getDate() + b.nights);

        await db.insert(bookings).values({
            id: randomUUID(),
            listingId: b.listingId,
            guestId: guest.id,
            checkIn,
            checkOut,
            totalPrice: listing.pricePerNight * b.nights,
            status: "completed",
        }).onConflictDoNothing();

        console.log(`  추가: ${listing.title} × ${b.nights}박 (completed)`);
    }

    console.log("\n데모 예약 시드 완료!");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
