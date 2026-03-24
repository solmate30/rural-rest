/**
 * 예약 더미 데이터 시드
 * 실행: npx tsx scripts/seed-bookings.ts
 *
 * 삽입 순서:
 *   1. 게스트 유저 3명 (고정 ID, 재실행 시 중복 방지)
 *   2. 예약 13건 (completed 6, confirmed 3, pending 2, cancelled 2)
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../app/db/schema";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

// ── 고정 ID ──────────────────────────────────────────────────────────────────

const GUEST_IDS = {
    minJun: "seed-guest-001-minjun",
    sarah:  "seed-guest-002-sarah",
    seoYeon: "seed-guest-003-seoyeon",
};

const LISTING = {
    hwangO:    "gyeongju-3000",  // 황오동 청송재 · 70,000/박
    seongGeon: "gyeongju-3001",  // 성건동 충재댁 · 90,000/박
    dongCheon: "gyeongju-3002",  // 동천동 신라숲 · 25,000/박
    geonCheon: "gyeongju-3003",  // 건천읍 월성   · 55,000/박
    anGang:    "gyeongju-3004",  // 안강읍 석굴재 · 65,000/박
};

function d(str: string) { return new Date(str); }
function nights(checkIn: Date, checkOut: Date) {
    return Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
}

// ── 1. 게스트 유저 ────────────────────────────────────────────────────────────

const guestUsers: (typeof schema.user.$inferInsert)[] = [
    {
        id: GUEST_IDS.minJun,
        name: "김민준",
        email: "minjun.kim@example.com",
        emailVerified: false,
        role: "guest",
        preferredLang: "ko",
        createdAt: d("2025-10-01"),
        updatedAt: d("2025-10-01"),
    },
    {
        id: GUEST_IDS.sarah,
        name: "Sarah Johnson",
        email: "sarah.johnson@example.com",
        emailVerified: true,
        role: "guest",
        preferredLang: "en",
        createdAt: d("2025-11-15"),
        updatedAt: d("2025-11-15"),
    },
    {
        id: GUEST_IDS.seoYeon,
        name: "이서연",
        email: "seoyeon.lee@example.com",
        emailVerified: false,
        role: "guest",
        preferredLang: "ko",
        createdAt: d("2025-09-20"),
        updatedAt: d("2025-09-20"),
    },
];

// ── 2. 예약 데이터 ────────────────────────────────────────────────────────────

type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

interface BookingDef {
    id: string;
    listingId: string;
    guestId: string;
    checkIn: Date;
    checkOut: Date;
    pricePerNight: number;
    status: BookingStatus;
}

const bookingDefs: BookingDef[] = [
    // ── completed (과거 완료) ──────────────────────────────────────────────
    { id: "seed-bk-001", listingId: LISTING.hwangO,    guestId: GUEST_IDS.minJun,  checkIn: d("2025-11-01"), checkOut: d("2025-11-03"), pricePerNight: 70000,  status: "completed" },
    { id: "seed-bk-002", listingId: LISTING.seongGeon, guestId: GUEST_IDS.sarah,   checkIn: d("2025-12-15"), checkOut: d("2025-12-18"), pricePerNight: 90000,  status: "completed" },
    { id: "seed-bk-003", listingId: LISTING.dongCheon, guestId: GUEST_IDS.seoYeon, checkIn: d("2026-01-05"), checkOut: d("2026-01-07"), pricePerNight: 25000,  status: "completed" },
    { id: "seed-bk-004", listingId: LISTING.geonCheon, guestId: GUEST_IDS.minJun,  checkIn: d("2026-02-10"), checkOut: d("2026-02-13"), pricePerNight: 55000,  status: "completed" },
    { id: "seed-bk-005", listingId: LISTING.anGang,    guestId: GUEST_IDS.sarah,   checkIn: d("2026-03-01"), checkOut: d("2026-03-04"), pricePerNight: 65000,  status: "completed" },
    { id: "seed-bk-006", listingId: LISTING.hwangO,    guestId: GUEST_IDS.seoYeon, checkIn: d("2025-12-20"), checkOut: d("2025-12-23"), pricePerNight: 70000,  status: "completed" },
    // ── confirmed (승인된 예정) ───────────────────────────────────────────
    { id: "seed-bk-007", listingId: LISTING.seongGeon, guestId: GUEST_IDS.seoYeon, checkIn: d("2026-04-05"), checkOut: d("2026-04-07"), pricePerNight: 90000,  status: "confirmed" },
    { id: "seed-bk-008", listingId: LISTING.geonCheon, guestId: GUEST_IDS.sarah,   checkIn: d("2026-04-15"), checkOut: d("2026-04-18"), pricePerNight: 55000,  status: "confirmed" },
    { id: "seed-bk-009", listingId: LISTING.anGang,    guestId: GUEST_IDS.minJun,  checkIn: d("2026-05-02"), checkOut: d("2026-05-04"), pricePerNight: 65000,  status: "confirmed" },
    // ── pending (승인 대기) ────────────────────────────────────────────────
    { id: "seed-bk-010", listingId: LISTING.dongCheon, guestId: GUEST_IDS.minJun,  checkIn: d("2026-04-20"), checkOut: d("2026-04-23"), pricePerNight: 25000,  status: "pending" },
    { id: "seed-bk-011", listingId: LISTING.hwangO,    guestId: GUEST_IDS.sarah,   checkIn: d("2026-05-10"), checkOut: d("2026-05-12"), pricePerNight: 70000,  status: "pending" },
    // ── cancelled ────────────────────────────────────────────────────────
    { id: "seed-bk-012", listingId: LISTING.seongGeon, guestId: GUEST_IDS.minJun,  checkIn: d("2026-02-01"), checkOut: d("2026-02-03"), pricePerNight: 90000,  status: "cancelled" },
    { id: "seed-bk-013", listingId: LISTING.geonCheon, guestId: GUEST_IDS.seoYeon, checkIn: d("2025-12-25"), checkOut: d("2025-12-27"), pricePerNight: 55000,  status: "cancelled" },
];

const bookings: (typeof schema.bookings.$inferInsert)[] = bookingDefs.map((b) => ({
    id: b.id,
    listingId: b.listingId,
    guestId: b.guestId,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    totalPrice: b.pricePerNight * nights(b.checkIn, b.checkOut),
    status: b.status,
    createdAt: new Date(b.checkIn.getTime() - 7 * 86400000), // 체크인 1주 전 예약
}));

// ── 실행 ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("▶ 게스트 유저 3명 삽입...");
    for (const u of guestUsers) {
        await db.insert(schema.user)
            .values(u)
            .onConflictDoNothing();
    }

    console.log("▶ 예약 13건 삽입...");
    for (const b of bookings) {
        await db.insert(schema.bookings)
            .values(b)
            .onConflictDoNothing();
        console.log(`  ${b.id} | ${b.listingId} | ${b.status} | ₩${b.totalPrice.toLocaleString()}`);
    }

    console.log("\n완료.");

    const summary = bookingDefs.reduce((acc, b) => {
        acc[b.status] = (acc[b.status] ?? 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    console.log("상태별:", summary);

    const total = bookings.reduce((s, b) => s + (b.totalPrice as number), 0);
    console.log(`총 예약 금액: ₩${total.toLocaleString()}`);
}

main().catch(console.error).finally(() => process.exit(0));
