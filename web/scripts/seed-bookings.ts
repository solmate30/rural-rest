/**
 * seed-bookings.ts — Silla Forest Hostel 예약 데이터 + active 상태 세팅 (localnet 데모용)
 *
 * 동작:
 *   1. 테스트 게스트 유저 upsert
 *   2. Silla Forest Hostel (listingId: 3002) 에 3월 완료 예약 3건 삽입
 *   3. rwaTokens 상태를 "active"로 업데이트 (투자자 배당 활성화)
 *
 * 실행:
 *   cd web && npx tsx scripts/seed-bookings.ts
 *
 * 이후: admin 대시보드 → 정산하기 → 2026-03 선택
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";

async function main() {
    const { db } = await import("../app/db/index.server.js");
    const { listings, bookings, rwaTokens, user } = await import("../app/db/schema.js");
    const { eq, like } = await import("drizzle-orm");

    // ── Silla Forest Hostel 조회 ──────────────────────────────────────────────
    const [listing] = await db
        .select({ id: listings.id, title: listings.title, pricePerNight: listings.pricePerNight })
        .from(listings)
        .where(eq(listings.id, "3002"));

    if (!listing) {
        console.error("Silla Forest Hostel (id: 3002) not found in DB");
        process.exit(1);
    }
    console.log(`매물: ${listing.title} (${listing.id})`);

    // ── RWA 토큰 조회 ──────────────────────────────────────────────────────────
    const [token] = await db
        .select({ id: rwaTokens.id, status: rwaTokens.status })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, "3002"));

    if (!token) {
        console.error("RWA Token not found for listing 3002");
        process.exit(1);
    }
    console.log(`RWA Token: ${token.id} (status: ${token.status})\n`);

    // ── 테스트 게스트 유저 upsert ──────────────────────────────────────────────
    const GUEST_ID = "test-guest-demo-001";
    const now = new Date();

    const existingGuest = await db.select({ id: user.id }).from(user).where(eq(user.id, GUEST_ID));
    if (existingGuest.length === 0) {
        await db.insert(user).values({
            id: GUEST_ID,
            name: "Demo Guest",
            email: "demo-guest@rural-rest.test",
            emailVerified: true,
            role: "guest",
            preferredLang: "en",
            kycVerified: true,
            kycVerifiedAt: now.toISOString(),
            createdAt: now,
            updatedAt: now,
        });
        console.log(`게스트 유저 생성: ${GUEST_ID}`);
    } else {
        console.log(`게스트 유저 기존 사용: ${GUEST_ID}`);
    }

    // ── 3월 예약 3건 삽입 ─────────────────────────────────────────────────────
    // 2026-03 기간의 체크인 날짜들
    const bookingData = [
        { checkIn: "2026-03-05", checkOut: "2026-03-08", nights: 3 },
        { checkIn: "2026-03-12", checkOut: "2026-03-15", nights: 3 },
        { checkIn: "2026-03-20", checkOut: "2026-03-23", nights: 3 },
    ];

    const pricePerNight = listing.pricePerNight; // KRW
    const KRW_PER_USDC = 1400;

    for (const b of bookingData) {
        const checkInTs = DateTime.fromISO(b.checkIn, { zone: "Asia/Seoul" }).toJSDate();
        const checkOutTs = DateTime.fromISO(b.checkOut, { zone: "Asia/Seoul" }).toJSDate();
        const totalPrice = pricePerNight * b.nights;
        const totalPriceUsdc = Math.floor((totalPrice / KRW_PER_USDC) * 1_000_000);

        const existing = await db.select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.checkIn, checkInTs));

        if (existing.length > 0) {
            console.log(`  예약 이미 존재 (체크인: ${b.checkIn}) 스킵`);
            continue;
        }

        const bookingId = uuidv4();
        await db.insert(bookings).values({
            id: bookingId,
            listingId: listing.id,
            guestId: GUEST_ID,
            checkIn: checkInTs,
            checkOut: checkOutTs,
            totalPrice,
            totalPriceUsdc,
            status: "completed",
            createdAt: now,
        });
        console.log(`  예약 생성: ${b.checkIn}~${b.checkOut} ₩${totalPrice.toLocaleString()} (${(totalPriceUsdc / 1_000_000).toFixed(2)} USDC)`);
    }

    // ── RWA 상태 active로 업데이트 ──────────────────────────────────────────────
    if (token.status !== "active") {
        await db.update(rwaTokens)
            .set({ status: "active", updatedAt: now })
            .where(eq(rwaTokens.id, token.id));
        console.log(`\nRWA Token 상태: ${token.status} → active (투자자 배당 활성화)`);
    } else {
        console.log(`\nRWA Token 이미 active`);
    }

    const totalRevenue = bookingData.reduce((sum, b) => sum + pricePerNight * b.nights, 0);
    const totalUsdc = Math.floor((totalRevenue / KRW_PER_USDC) * 1_000_000);

    console.log(`\n완료! 2026-03 예약 3건 (총 매출: ₩${totalRevenue.toLocaleString()} ≈ ${(totalUsdc / 1_000_000).toFixed(2)} USDC)`);
    console.log(`\n다음 단계:`);
    console.log(`  1. admin 대시보드 접속`);
    console.log(`  2. Silla Forest Hostel → 정산하기`);
    console.log(`  3. 월 선택: 2026-03`);
    console.log(`  4. 어드민 지갑에 USDC 충분한지 확인 (gov 40% + operator 30% 전송 필요)`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
