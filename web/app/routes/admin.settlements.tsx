import { useLoaderData, useNavigate } from "react-router";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { listings, bookings, operatorSettlements, localGovSettlements, rwaDividends, rwaTokens } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Route } from "./+types/admin.settlements";
import { AdminNav } from "~/components/admin/AdminNav";

function defaultMonth() {
    const now = new Date();
    const m = now.getMonth();
    const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const pm = m === 0 ? 12 : m;
    return `${y}-${String(pm).padStart(2, "0")}`;
}

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? defaultMonth();

    const [y, m] = month.split("-").map(Number);
    const startTs = DateTime.local(y, m, 1).startOf("month").toUnixInteger();
    const endTs = DateTime.local(y, m, 1).endOf("month").toUnixInteger();

    const allListings = await db
        .select({ id: listings.id, title: listings.title, location: listings.location, images: listings.images })
        .from(listings);

    const revenueRows = await db
        .select({
            listingId: bookings.listingId,
            grossRevenueKrw: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
            bookingCount: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(and(
            sql`${bookings.status} in ('confirmed', 'completed')`,
            sql`${bookings.checkIn} >= ${startTs}`,
            sql`${bookings.checkIn} <= ${endTs}`,
        ))
        .groupBy(bookings.listingId);

    const revenueMap = Object.fromEntries(
        revenueRows.map((r) => [r.listingId, { grossRevenueKrw: Number(r.grossRevenueKrw), bookingCount: Number(r.bookingCount) }])
    );

    const settledRows = await db
        .select({ listingId: operatorSettlements.listingId })
        .from(operatorSettlements)
        .where(eq(operatorSettlements.month, month));

    const settledSet = new Set(settledRows.map((r) => r.listingId));

    const tokenRows = await db.select({ listingId: rwaTokens.listingId, id: rwaTokens.id }).from(rwaTokens);

    const dividendRows = await db
        .select({
            rwaTokenId: rwaDividends.rwaTokenId,
            totalUsdc: sql<number>`coalesce(sum(${rwaDividends.dividendUsdc}), 0)`,
        })
        .from(rwaDividends)
        .where(eq(rwaDividends.month, month))
        .groupBy(rwaDividends.rwaTokenId);

    const investorUsdcByListing = Object.fromEntries(
        dividendRows.map((d) => {
            const listingId = tokenRows.find((t) => t.id === d.rwaTokenId)?.listingId;
            return listingId ? [listingId, Number(d.totalUsdc)] : [];
        }).filter((e) => e.length === 2) as [string, number][]
    );

    // 지자체 분배
    const govRows = await db
        .select({ listingId: localGovSettlements.listingId, settlementUsdc: localGovSettlements.settlementUsdc })
        .from(localGovSettlements)
        .where(eq(localGovSettlements.month, month));
    const govUsdcByListing = Object.fromEntries(govRows.map((r) => [r.listingId, Number(r.settlementUsdc)]));

    // 운영자 분배
    const opRows = await db
        .select({ listingId: operatorSettlements.listingId, settlementUsdc: operatorSettlements.settlementUsdc })
        .from(operatorSettlements)
        .where(eq(operatorSettlements.month, month));
    const opUsdcByListing = Object.fromEntries(opRows.map((r) => [r.listingId, Number(r.settlementUsdc)]));

    const rows = allListings.map((l) => ({
        id: l.id,
        title: l.title,
        location: l.location,
        images: l.images,
        grossRevenueKrw: revenueMap[l.id]?.grossRevenueKrw ?? 0,
        bookingCount: revenueMap[l.id]?.bookingCount ?? 0,
        settled: settledSet.has(l.id),
        totalUsdc: (govUsdcByListing[l.id] ?? 0) + (opUsdcByListing[l.id] ?? 0) + (investorUsdcByListing[l.id] ?? 0),
    }));

    const pendingCount = rows.filter((r) => !r.settled).length;
    const doneCount = rows.filter((r) => r.settled).length;
    const totalSettlementUsdc = rows.reduce((sum, r) => sum + r.totalUsdc, 0);

    return { month, rows, pendingCount, doneCount, totalSettlementUsdc };
}

export default function AdminSettlements() {
    const { month, rows, pendingCount, doneCount, totalSettlementUsdc } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-24 pb-16 px-6 max-w-6xl">
                <AdminNav />

                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-[#4a3b2c]">정산 관리</h1>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => navigate(`/admin/settlements?month=${e.target.value}`)}
                        className="border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 bg-white"
                    />
                </div>

                {/* 요약 카드 */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
                        <p className="text-xs text-stone-400 mb-1">미정산</p>
                        <p className="text-2xl font-bold text-[#4a3b2c]">{pendingCount}<span className="text-sm font-normal text-stone-400 ml-1">건</span></p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
                        <p className="text-xs text-stone-400 mb-1">정산 완료</p>
                        <p className="text-2xl font-bold text-[#4a3b2c]">{doneCount}<span className="text-sm font-normal text-stone-400 ml-1">건</span></p>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
                        <p className="text-xs text-stone-400 mb-1">이번 달 총 분배액</p>
                        <p className="text-2xl font-bold text-[#4a3b2c]">{(totalSettlementUsdc / 1_000_000).toFixed(2)}<span className="text-sm font-normal text-stone-400 ml-1">USDC</span></p>
                    </div>
                </div>

                {/* 매물 목록 */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-100 bg-stone-50/50">
                                <th className="py-3 px-5">매물</th>
                                <th className="py-3 px-5 text-right">이번 달 매출</th>
                                <th className="py-3 px-5 text-right">정산 상태</th>
                                <th className="py-3 px-5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => navigate(`/admin/settlements/${row.id}?month=${month}`)}
                                    className="group hover:bg-stone-100/70 transition-colors cursor-pointer"
                                >
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-20 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                                                {Array.isArray(row.images) && row.images[0]
                                                    ? <img src={row.images[0] as string} alt="" className="w-full h-full object-cover" />
                                                    : <div className="w-full h-full bg-stone-100" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-stone-800 group-hover:text-[#4a3b2c]">{row.title}</p>
                                                <p className="text-xs text-stone-400 mt-0.5">{row.location}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        {row.grossRevenueKrw > 0 ? (
                                            <>
                                                <p className="text-sm text-stone-700">{row.grossRevenueKrw.toLocaleString()}원</p>
                                                <p className="text-[10px] text-stone-400">{row.bookingCount}건</p>
                                            </>
                                        ) : (
                                            <span className="text-sm text-stone-300">—</span>
                                        )}
                                    </td>
                                    <td className="py-3.5 px-5 text-right">
                                        {row.settled ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#17cf54] bg-[#17cf54]/10 border border-[#17cf54]/20 px-3 py-1.5 rounded-lg">
                                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                                완료
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">미정산</span>
                                        )}
                                    </td>
                                    <td className="py-3.5 px-4 text-stone-300 group-hover:text-stone-500 transition-colors text-right">
                                        →
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
