/**
 * seed-chat-demo.ts — 자동 번역 채팅 테스트용 데이터 생성
 *
 * 전제:
 *   - js7122420@gmail.com 계정이 Privy 로그인으로 이미 DB에 존재해야 함
 *   - 해당 계정을 게스트로 사용하고, 더미 호스트 유저 + 리스팅 + confirmed 예약 생성
 *
 * 실행:
 *   cd web && npx tsx scripts/seed-chat-demo.ts
 *
 * 테스트:
 *   - js7122420@gmail.com 계정으로 로그인 → /my/bookings
 *   - confirmed 예약 카드 → "Open chat" 클릭 → 메시지 전송
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

import { DateTime } from "luxon";

const GUEST_EMAIL = "js7122420@gmail.com";
const HOST_ID     = "chat-demo-host-001";
const LISTING_ID  = "chat-demo-listing-001";
const BOOKING_ID  = "chat-demo-booking-001";

async function main() {
    const { db } = await import("../app/db/index.server.js");
    const { listings, bookings, user } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");

    const now = new Date();

    // ── 1. Privy 게스트 계정 조회 ────────────────────────────────────────────
    const guest = await db
        .select({ id: user.id, name: user.name, preferredLang: user.preferredLang })
        .from(user)
        .where(eq(user.email, GUEST_EMAIL))
        .get();

    if (!guest) {
        console.error(`유저를 찾을 수 없습니다: ${GUEST_EMAIL}`);
        console.error("Privy로 먼저 로그인해서 계정을 생성해주세요.");
        process.exit(1);
    }
    console.log(`게스트 계정 확인: ${guest.name} (${guest.id}) — preferredLang: ${guest.preferredLang}`);

    // preferredLang이 "en"이 아니면 업데이트 (번역 테스트를 위해)
    if (guest.preferredLang !== "en") {
        await db.update(user)
            .set({ preferredLang: "en", updatedAt: now })
            .where(eq(user.id, guest.id));
        console.log(`  preferredLang: ${guest.preferredLang} → en (번역 테스트용)`);
    }

    // ── 2. 더미 호스트 upsert (ko) ──────────────────────────────────────────
    const existingHost = await db.select({ id: user.id }).from(user).where(eq(user.id, HOST_ID));
    if (existingHost.length === 0) {
        await db.insert(user).values({
            id: HOST_ID,
            name: "김철수 (호스트)",
            email: "chat-demo-host@rural-rest.test",
            emailVerified: true,
            role: "spv",
            preferredLang: "ko",
            kycVerified: true,
            kycVerifiedAt: now.toISOString(),
            createdAt: now,
            updatedAt: now,
        });
        console.log("더미 호스트 생성: 김철수 (ko)");
    } else {
        console.log("더미 호스트 기존 사용:", HOST_ID);
    }

    // ── 3. 리스팅 upsert ────────────────────────────────────────────────────
    const existingListing = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, LISTING_ID));
    if (existingListing.length === 0) {
        await db.insert(listings).values({
            id: LISTING_ID,
            title: "황오동 청송재 (채팅 테스트)",
            description: "1960년대 한옥을 리모델링한 뉴트로 감성 숙소. 채팅 기능 테스트용입니다.",
            location: "경상북도 경주시 황오동",
            region: "경상",
            pricePerNight: 70_000,
            maxGuests: 4,
            amenities: JSON.stringify(["Wi-Fi", "에어컨", "온돌 난방"]),
            images: JSON.stringify(["/hwango.webp"]),
            hostId: HOST_ID,
            lat: 35.8320,
            lng: 129.2150,
            createdAt: now,
        });
        console.log("리스팅 생성:", LISTING_ID);
    } else {
        console.log("리스팅 기존 사용:", LISTING_ID);
    }

    // ── 4. confirmed 예약 생성 ───────────────────────────────────────────────
    const existingBooking = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, BOOKING_ID));

    if (existingBooking.length === 0) {
        const checkIn  = DateTime.fromISO("2026-05-10", { zone: "Asia/Seoul" }).toJSDate();
        const checkOut = DateTime.fromISO("2026-05-13", { zone: "Asia/Seoul" }).toJSDate();

        await db.insert(bookings).values({
            id: BOOKING_ID,
            listingId: LISTING_ID,
            guestId: guest.id,
            checkIn,
            checkOut,
            totalPrice: 210_000,    // 70,000 × 3박
            totalPriceUsdc: null,
            status: "confirmed",
            paymentIntentId: "demo-paypal-auth-chat-001",
            createdAt: now,
        });
        console.log("예약 생성: 2026-05-10 ~ 2026-05-13 (confirmed)");
    } else {
        // 기존 예약의 guestId가 다르면 업데이트
        const existing = await db.select({ guestId: bookings.guestId }).from(bookings).where(eq(bookings.id, BOOKING_ID)).get();
        if (existing && existing.guestId !== guest.id) {
            await db.update(bookings)
                .set({ guestId: guest.id })
                .where(eq(bookings.id, BOOKING_ID));
            console.log(`예약 guestId 업데이트: ${existing.guestId} → ${guest.id}`);
        } else {
            console.log("예약 기존 사용:", BOOKING_ID);
        }
    }

    console.log(`
완료!

  계정:   ${GUEST_EMAIL} (guestId: ${guest.id})
  예약:   ${BOOKING_ID} (confirmed, 2026-05-10 ~ 05-13)
  리스팅: 황오동 청송재 (채팅 테스트)

테스트 방법:
  1. ${GUEST_EMAIL}으로 로그인
  2. /my/bookings → "황오동 청송재 (채팅 테스트)" 카드
  3. "Open chat" 클릭 → 메시지 입력 후 전송
  4. GEMINI_API_KEY가 .env.local에 설정되어 있어야 번역됨
`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
