import { useLoaderData, useNavigate, Link } from "react-router";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import {
    listings, bookings, operatorSettlements, localGovSettlements, rwaDividends, rwaTokens,
} from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Route } from "./+types/admin.settlements.detail";
import { MonthlySettlementButton } from "~/components/admin/MonthlySettlementButton";
import { AdminNav } from "~/components/admin/AdminNav";

function defaultMonth() {
    const now = new Date();
    const m = now.getMonth();
    const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const pm = m === 0 ? 12 : m;
    return `${y}-${String(pm).padStart(2, "0")}`;
}

// 최근 N개월 목록 생성
function recentMonths(n = 12) {
    const months: string[] = [];
    let dt = DateTime.now().startOf("month");
    for (let i = 0; i < n; i++) {
        months.push(dt.toFormat("yyyy-MM"));
        dt = dt.minus({ months: 1 });
    }
    return months;
}

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const { listingId } = params;
    const url = new URL(request.url);
    const focusMonth = url.searchParams.get("month") ?? defaultMonth();

    // 매물 기본 정보
    const [listing] = await db
        .select({ id: listings.id, title: listings.title, location: listings.location, images: listings.images })
        .from(listings)
        .where(eq(listings.id, listingId));

    if (!listing) throw new Response("Not Found", { status: 404 });

    const months = recentMonths(12);

    // 해당 매물의 모든 월 데이터 조회
    const monthRows = await Promise.all(months.map(async (month) => {
        const [y, m] = month.split("-").map(Number);
        const startTs = DateTime.local(y, m, 1).startOf("month").toUnixInteger();
        const endTs = DateTime.local(y, m, 1).endOf("month").toUnixInteger();

        const [revenue] = await db
            .select({
                sum: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
                count: sql<number>`count(*)`,
            })
            .from(bookings)
            .where(and(
                eq(bookings.listingId, listingId),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkIn} >= ${startTs}`,
                sql`${bookings.checkIn} <= ${endTs}`,
            ));

        const [opRow] = await db
            .select({
                settlementUsdc: operatorSettlements.settlementUsdc,
                operatingCostKrw: operatorSettlements.operatingCostKrw,
                operatingProfitKrw: operatorSettlements.operatingProfitKrw,
                payoutTx: operatorSettlements.payoutTx,
            })
            .from(operatorSettlements)
            .where(and(eq(operatorSettlements.listingId, listingId), eq(operatorSettlements.month, month)));

        const [govRow] = await db
            .select({ settlementUsdc: localGovSettlements.settlementUsdc })
            .from(localGovSettlements)
            .where(and(eq(localGovSettlements.listingId, listingId), eq(localGovSettlements.month, month)));

        const [tokenRow] = await db
            .select({ id: rwaTokens.id })
            .from(rwaTokens)
            .where(eq(rwaTokens.listingId, listingId));

        let investorUsdc = 0;
        let investorCount = 0;
        let claimedCount = 0;
        if (tokenRow) {
            const [divRow] = await db
                .select({
                    total: sql<number>`coalesce(sum(${rwaDividends.dividendUsdc}), 0)`,
                    cnt: sql<number>`count(*)`,
                    claimed: sql<number>`sum(case when ${rwaDividends.claimTx} is not null then 1 else 0 end)`,
                })
                .from(rwaDividends)
                .where(and(eq(rwaDividends.rwaTokenId, tokenRow.id), eq(rwaDividends.month, month)));
            investorUsdc = Number(divRow?.total ?? 0);
            investorCount = Number(divRow?.cnt ?? 0);
            claimedCount = Number(divRow?.claimed ?? 0);
        }

        return {
            month,
            grossRevenueKrw: Number(revenue?.sum ?? 0),
            bookingCount: Number(revenue?.count ?? 0),
            operatingCostKrw: opRow ? Number(opRow.operatingCostKrw) : null,
            operatingProfitKrw: opRow ? Number(opRow.operatingProfitKrw) : null,
            operatorUsdc: opRow ? Number(opRow.settlementUsdc) : null,
            localGovUsdc: govRow ? Number(govRow.settlementUsdc) : null,
            investorUsdc: investorCount > 0 ? investorUsdc : null,
            investorCount,
            claimedCount,
            settled: !!opRow,
        };
    }));

    return { listing, monthRows, focusMonth };
}

function usdcFmt(v: number | null) {
    if (v == null) return "—";
    return `${(v / 1_000_000).toFixed(2)}`;
}

export default function AdminSettlementsDetail() {
    const { listing, monthRows, focusMonth } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    const images = Array.isArray(listing.images) ? listing.images as string[] : [];

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-24 pb-16 px-6 max-w-6xl">
                <AdminNav />

                {/* 뒤로가기 */}
                <Link
                    to={`/admin/settlements?month=${focusMonth}`}
                    className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-5"
                >
                    ← 목록으로
                </Link>

                {/* 매물 헤더 */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                        {images[0]
                            ? <img src={images[0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-stone-100" />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#4a3b2c]">{listing.title}</h1>
                        <p className="text-sm text-stone-400 mt-0.5">{listing.location}</p>
                    </div>
                </div>

                {/* 월별 정산 이력 테이블 */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-stone-100">
                        <h2 className="font-bold text-[#4a3b2c] text-sm">월별 정산 이력</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-100 bg-stone-50/50">
                                    <th className="py-3 px-5">월</th>
                                    <th className="py-3 px-5 text-right">예약</th>
                                    <th className="py-3 px-5 text-right">숙박 매출</th>
                                    <th className="py-3 px-5 text-right">운영비</th>
                                    <th className="py-3 px-5 text-right">영업이익</th>
                                    <th className="py-3 px-5 text-right">지자체 40%</th>
                                    <th className="py-3 px-5 text-right">운영자 30%</th>
                                    <th className="py-3 px-5 text-right">투자자 30%</th>
                                    <th className="py-3 px-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                                {monthRows.map((row) => (
                                    <tr
                                        key={row.month}
                                        className={`transition-colors ${row.month === focusMonth ? "bg-[#17cf54]/5" : "hover:bg-stone-50/40"}`}
                                    >
                                        <td className="py-3.5 px-5">
                                            <span className="text-sm font-semibold text-[#4a3b2c]">{row.month}</span>
                                            {row.month === focusMonth && (
                                                <span className="ml-2 text-[10px] text-[#17cf54] font-medium">이번 달</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-500">
                                            {row.bookingCount > 0 ? `${row.bookingCount}건` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-700">
                                            {row.grossRevenueKrw > 0 ? `${row.grossRevenueKrw.toLocaleString()}원` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-500">
                                            {row.operatingCostKrw != null ? `${row.operatingCostKrw.toLocaleString()}원` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-700 font-medium">
                                            {row.operatingProfitKrw != null ? `${row.operatingProfitKrw.toLocaleString()}원` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-600">
                                            {row.localGovUsdc != null ? `${usdcFmt(row.localGovUsdc)} USDC` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right text-sm text-stone-600">
                                            {row.operatorUsdc != null ? `${usdcFmt(row.operatorUsdc)} USDC` : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            {row.investorUsdc != null ? (
                                                <>
                                                    <p className="text-sm text-[#17cf54] font-medium">{usdcFmt(row.investorUsdc)} USDC</p>
                                                    <p className="text-[10px] text-stone-400">{row.claimedCount}/{row.investorCount}명 수령</p>
                                                </>
                                            ) : (
                                                <span className="text-sm text-stone-300">—</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            {!row.settled && row.grossRevenueKrw > 0 && (
                                                <MonthlySettlementButton listingId={listing.id} listingTitle={listing.title} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
