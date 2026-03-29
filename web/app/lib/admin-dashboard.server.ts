import { DateTime } from "luxon";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { db } from "../db/index.server";
import { listings, bookings, rwaTokens, user as userTable, operatorSettlements } from "../db/schema";
import { fetchPropertiesOnchain } from "./rwa.onchain.server";

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
    tokenStatus: string | null;
    tokenMint: string | null;
    rwaTokenId: string | null;
    operatorId: string | null;
    valuationKrw: number;
    tokensSold: number;
    totalSupply: number;
    fundingDeadline: string | null;
    minFundingBps: number;
    pricePerTokenUsdc: number;
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
            operatorId: listings.operatorId,
            valuationKrw: listings.valuationKrw,
            tokenStatus: rwaTokens.status,
            tokenMint: rwaTokens.tokenMint,
            rwaTokenId: rwaTokens.id,
            tokensSold: rwaTokens.tokensSold,
            totalSupply: rwaTokens.totalSupply,
            fundingDeadline: rwaTokens.fundingDeadline,
            minFundingBps: rwaTokens.minFundingBps,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(role === "admin" ? undefined : eq(listings.hostId, hostId))
        .orderBy(
            sql`CASE WHEN ${rwaTokens.tokenMint} IS NOT NULL THEN 0 ELSE 1 END`,
            desc(listings.createdAt)
        );

    const initializedIds = rows.filter(r => r.tokenMint).map(r => r.id);
    const onchainMap = await fetchPropertiesOnchain(initializedIds);

    return rows.map((r) => {
        const imgs = r.images as string[] | null;
        const image = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : "";
        const onchain = onchainMap.get(r.id);
        return {
            id: r.id,
            title: r.title,
            location: r.location,
            pricePerNight: r.pricePerNight,
            image,
            operatorId: r.operatorId ?? null,
            valuationKrw: r.valuationKrw ?? 0,
            tokenStatus: onchain?.status ?? r.tokenStatus ?? null,
            tokenMint: r.tokenMint ?? null,
            rwaTokenId: r.rwaTokenId ?? null,
            tokensSold: onchain?.tokensSold ?? r.tokensSold ?? 0,
            totalSupply: r.totalSupply ?? 0,
            fundingDeadline: r.fundingDeadline ? new Date(r.fundingDeadline).toISOString() : null,
            minFundingBps: r.minFundingBps ?? 6000,
            pricePerTokenUsdc: r.pricePerTokenUsdc ?? 0,
        };
    });
}

export interface OperatorBookingRow {
    id: string;
    listingId: string;
    listingTitle: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    totalPrice: number;
    status: string;
}

/** operator가 담당하는 매물 목록 (operatorId 기준) */
export async function getOperatorListings(operatorId: string): Promise<HostListingRow[]> {
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            pricePerNight: listings.pricePerNight,
            images: listings.images,
            operatorId: listings.operatorId,
            tokenStatus: rwaTokens.status,
            tokenMint: rwaTokens.tokenMint,
            rwaTokenId: rwaTokens.id,
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(eq(listings.operatorId, operatorId))
        .orderBy(desc(listings.createdAt));

    const initializedIds = rows.filter(r => r.tokenMint).map(r => r.id);
    const onchainMap = await fetchPropertiesOnchain(initializedIds);

    return rows.map((r) => {
        const imgs = r.images as string[] | null;
        const image = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : "";
        const onchain = onchainMap.get(r.id);
        return {
            id: r.id,
            title: r.title,
            location: r.location,
            pricePerNight: r.pricePerNight,
            image,
            operatorId: r.operatorId ?? null,
            tokenStatus: onchain?.status ?? r.tokenStatus ?? null,
            tokenMint: r.tokenMint ?? null,
            rwaTokenId: r.rwaTokenId ?? null,
        };
    });
}

/** operator 담당 매물의 예약 목록 (pending + 오늘 이후 confirmed) */
export async function getOperatorBookings(operatorId: string): Promise<OperatorBookingRow[]> {
    const operatorListings = await db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(eq(listings.operatorId, operatorId));

    if (operatorListings.length === 0) return [];

    const listingIds = operatorListings.map((l) => l.id);
    const titleMap = Object.fromEntries(operatorListings.map((l) => [l.id, l.title]));

    const now = DateTime.now().startOf("day").toUnixInteger();

    const rows = await db
        .select({
            id: bookings.id,
            listingId: bookings.listingId,
            guestName: userTable.name,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            totalPrice: bookings.totalPrice,
            status: bookings.status,
        })
        .from(bookings)
        .innerJoin(userTable, eq(bookings.guestId, userTable.id))
        .where(
            and(
                inArray(bookings.listingId, listingIds),
                sql`(${bookings.status} = 'pending' OR (${bookings.status} = 'confirmed' AND ${bookings.checkIn} >= ${now}))`,
            )
        )
        .orderBy(bookings.checkIn);

    return rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        listingTitle: titleMap[r.listingId] ?? "",
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        totalPrice: r.totalPrice,
        status: r.status,
    }));
}

export interface OperatorSettlementRow {
    id: string;
    listingId: string;
    listingTitle: string;
    month: string;
    grossRevenueKrw: number;
    operatingProfitKrw: number;
    settlementUsdc: number;
    payoutTx: string | null; // 어드민 push tx 서명 (null = 미전송)
}

/** operator 정산 내역 */
export async function getOperatorSettlements(operatorId: string): Promise<OperatorSettlementRow[]> {
    const opListings = await db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(eq(listings.operatorId, operatorId));

    if (opListings.length === 0) return [];

    const titleMap = Object.fromEntries(opListings.map((l) => [l.id, l.title]));
    const listingIds = opListings.map((l) => l.id);

    const rows = await db
        .select({
            id: operatorSettlements.id,
            listingId: operatorSettlements.listingId,
            month: operatorSettlements.month,
            grossRevenueKrw: operatorSettlements.grossRevenueKrw,
            operatingProfitKrw: operatorSettlements.operatingProfitKrw,
            settlementUsdc: operatorSettlements.settlementUsdc,
            payoutTx: operatorSettlements.payoutTx,
        })
        .from(operatorSettlements)
        .where(inArray(operatorSettlements.listingId, listingIds))
        .orderBy(desc(operatorSettlements.month));

    return rows.map((r) => ({
        ...r,
        listingTitle: titleMap[r.listingId] ?? "",
    }));
}
