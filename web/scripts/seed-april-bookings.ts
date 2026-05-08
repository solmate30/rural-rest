/**
 * 4월 예약 시드 스크립트 — listing 3003 / 3004
 * 실행: cd web && npx tsx scripts/seed-april-bookings.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

import { randomUUID } from "crypto";

function apr(day: number) {
    return new Date(2026, 3, day); // month 3 = April (0-indexed)
}

const BOOKINGS_3003 = [
    // pricePerNight: 25,000 KRW
    { checkIn: apr(1),  checkOut: apr(3),  nights: 2 },
    { checkIn: apr(3),  checkOut: apr(6),  nights: 3 },
    { checkIn: apr(7),  checkOut: apr(9),  nights: 2 },
    { checkIn: apr(9),  checkOut: apr(12), nights: 3 },
    { checkIn: apr(13), checkOut: apr(15), nights: 2 },
    { checkIn: apr(16), checkOut: apr(19), nights: 3 },
    { checkIn: apr(19), checkOut: apr(21), nights: 2 },
    { checkIn: apr(22), checkOut: apr(25), nights: 3 },
    { checkIn: apr(25), checkOut: apr(27), nights: 2 },
    { checkIn: apr(28), checkOut: apr(30), nights: 2 },
];

const BOOKINGS_3004 = [
    // pricePerNight: 55,000 KRW
    { checkIn: apr(1),  checkOut: apr(4),  nights: 3 },
    { checkIn: apr(5),  checkOut: apr(8),  nights: 3 },
    { checkIn: apr(9),  checkOut: apr(13), nights: 4 },
    { checkIn: apr(14), checkOut: apr(17), nights: 3 },
    { checkIn: apr(18), checkOut: apr(22), nights: 4 },
    { checkIn: apr(23), checkOut: apr(26), nights: 3 },
    { checkIn: apr(27), checkOut: apr(30), nights: 3 },
];

async function main() {
    const { db } = await import("../app/db/index.server");
    const { listings, bookings, user } = await import("../app/db/schema");
    const { eq, inArray } = await import("drizzle-orm");

    // 게스트 유저 가져오기 (시드된 투자자 혹은 기존 guest)
    const guests = await db
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(inArray(user.role, ["guest"]));

    if (guests.length === 0) {
        console.error("guest 유저가 없습니다. seed-investors.ts 먼저 실행하세요.");
        process.exit(1);
    }

    // listing UUID 조회
    const listingRows = await db
        .select({ id: listings.id, nodeNumber: listings.nodeNumber, pricePerNight: listings.pricePerNight })
        .from(listings)
        .where(inArray(listings.nodeNumber, [3003, 3004]));

    const l3003 = listingRows.find(r => r.nodeNumber === 3003);
    const l3004 = listingRows.find(r => r.nodeNumber === 3004);

    if (!l3003 || !l3004) {
        console.error("listing 3003 또는 3004 없음. seed-test-listing.ts 먼저 실행하세요.");
        process.exit(1);
    }



    let total = 0;

    async function insertBookings(
        listingId: string,
        pricePerNight: number,
        plans: typeof BOOKINGS_3003,
        label: string,
    ) {
        console.log(`[${label}] pricePerNight: ${pricePerNight.toLocaleString()} KRW`);
        for (const plan of plans) {
            const guest = guests[total % guests.length];
            const totalPrice = pricePerNight * plan.nights;
            await db.insert(bookings).values({
                id: randomUUID(),
                listingId,
                guestId: guest.id,
                checkIn: plan.checkIn,
                checkOut: plan.checkOut,
                totalPrice,
                status: "completed",
            });
            console.log(
                `  ✓ ${plan.checkIn.toISOString().slice(5, 10)} ~ ${plan.checkOut.toISOString().slice(5, 10)}` +
                ` (${plan.nights}박, ${totalPrice.toLocaleString()} KRW) — ${guest.email}`
            );
            total++;
        }
        console.log();
    }

    await insertBookings(l3003.id, l3003.pricePerNight, BOOKINGS_3003, "3003 Dongcheon Hostel");
    await insertBookings(l3004.id, l3004.pricePerNight, BOOKINGS_3004, "3004 Wolseong Farm Stay");

    console.log(`✅ 총 ${total}개 예약 완료 (전부 completed 상태)`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
