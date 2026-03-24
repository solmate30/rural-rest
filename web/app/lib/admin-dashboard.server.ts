import { DateTime } from "luxon";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { db } from "../db/index.server";
import { listings, bookings, rwaTokens } from "../db/schema";

export interface DashboardStats {
    totalRevenueThisMonth: number;
    activeListings: number;
    pendingBookings: number;
    occupancyRatePercent: number;
    todayCheckIns: number;
}

export interface HostListingRow {
    id: string;
    title: string;
    location: string;
    pricePerNight: number;
    image: string;
    tokenStatus: string | null; // null = 미발행
    tokenMint: string | null;
}

/**
 * Revenue for current month: sum of totalPrice for confirmed/completed bookings
 * where checkIn falls in the current month (host timezone).
 */
export async function getDashboardStats(hostId: string): Promise<DashboardStats> {
    const now = DateTime.now();
    const startOfMonth = now.startOf("month").toUnixInteger();
    const endOfMonth = now.endOf("month").toUnixInteger() + 1;
    const startOfToday = now.startOf("day").toUnixInteger();
    const endOfToday = now.endOf("day").toUnixInteger() + 1;
    const thirtyDaysAgo = now.minus({ days: 30 }).startOf("day").toUnixInteger();

    const hostListingsResult = await db
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.hostId, hostId));
    const listingIds = hostListingsResult.map((r) => r.id);
    const activeListings = listingIds.length;

    if (listingIds.length === 0) {
        return {
            totalRevenueThisMonth: 0,
            activeListings: 0,
            pendingBookings: 0,
            occupancyRatePercent: 0,
            todayCheckIns: 0,
        };
    }

    const [revenueRow] = await db
        .select({
            sum: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
        })
        .from(bookings)
        .where(
            and(
                inArray(bookings.listingId, listingIds),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkIn} >= ${startOfMonth}`,
                sql`${bookings.checkIn} < ${endOfMonth}`
            )
        );

    const [pendingRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
            and(
                inArray(bookings.listingId, listingIds),
                eq(bookings.status, "pending")
            )
        );

    const [todayRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
            and(
                inArray(bookings.listingId, listingIds),
                eq(bookings.status, "confirmed"),
                sql`${bookings.checkIn} >= ${startOfToday}`,
                sql`${bookings.checkIn} < ${endOfToday}`
            )
        );

    const totalRevenueThisMonth = Number(revenueRow?.sum ?? 0);
    const pendingBookings = Number(pendingRow?.count ?? 0);
    const todayCheckIns = Number(todayRow?.count ?? 0);

    const recentBookings = await db
        .select({
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
        })
        .from(bookings)
        .where(
            and(
                inArray(bookings.listingId, listingIds),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkOut} > ${thirtyDaysAgo}`
            )
        );

    let bookedNights = 0;
    const periodStart = thirtyDaysAgo;
    const periodEnd = now.toUnixInteger();
    for (const b of recentBookings) {
        const checkIn = b.checkIn instanceof Date ? b.checkIn.getTime() / 1000 : Number(b.checkIn);
        const checkOut = b.checkOut instanceof Date ? b.checkOut.getTime() / 1000 : Number(b.checkOut);
        const overlapStart = Math.max(checkIn, periodStart);
        const overlapEnd = Math.min(checkOut, periodEnd);
        if (overlapEnd > overlapStart) {
            bookedNights += Math.ceil((overlapEnd - overlapStart) / 86400);
        }
    }
    const totalNights = activeListings * 30;
    const occupancyRatePercent = totalNights > 0 ? Math.round((bookedNights / totalNights) * 100) : 0;

    return {
        totalRevenueThisMonth,
        activeListings,
        pendingBookings,
        occupancyRatePercent,
        todayCheckIns,
    };
}

/**
 * Listings for dashboard.
 * admin → 전체 매물, host → 본인 매물만
 */
export async function getHostListings(hostId: string, role: string): Promise<HostListingRow[]> {
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            pricePerNight: listings.pricePerNight,
            images: listings.images,
            tokenStatus: rwaTokens.status,
            tokenMint: rwaTokens.tokenMint,
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(role === "admin" ? undefined : eq(listings.hostId, hostId))
        .orderBy(desc(listings.createdAt));

    return rows.map((r) => {
        const imgs = r.images as string[] | null;
        const image = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : "";
        return {
            id: r.id,
            title: r.title,
            location: r.location,
            pricePerNight: r.pricePerNight,
            image,
            tokenStatus: r.tokenStatus ?? null,
            tokenMint: r.tokenMint ?? null,
        };
    });
}
