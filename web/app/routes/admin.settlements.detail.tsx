import { useLoaderData, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import {
    listings, bookings, operatorSettlements, localGovSettlements,
    rwaDividends, rwaTokens, rwaInvestments,
} from "../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Route } from "./+types/admin.settlements.detail";
import { MonthlySettlementButton } from "~/components/admin/MonthlySettlementButton";
import { syncFundingStatuses } from "~/lib/rwa.server";
import { formatKrwLabel } from "~/lib/formatters";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "~/components/ui/table";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

/* ------------------------------------------------------------------ */
/*  Loader (unchanged)                                                 */
/* ------------------------------------------------------------------ */

function defaultMonth() {
    const now = new Date();
    const m = now.getMonth();
    const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const pm = m === 0 ? 12 : m;
    return `${y}-${String(pm).padStart(2, "0")}`;
}

function recentMonths(n = 12) {
    const months: string[] = [];
    let dt = DateTime.now().startOf("month");
    for (let i = 0; i < n; i++) {
        months.push(dt.toFormat("yyyy-MM"));
        dt = dt.minus({ months: 1 });
    }
    return months;
}

interface InvestorRow {
    walletAddress: string;
    tokenAmount: number;
    sharePercent: number;
    dividendUsdc: number | null;
    claimed: boolean;
    claimTx: string | null;
}

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    // 온체인 상태와 DB 동기화 (funded→active 전환 자동 반영)
    await syncFundingStatuses().catch(() => {});

    const url = new URL(request.url);
    const { listingId } = params;

    const [listing] = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            images: listings.images,
            hostId: listings.hostId,
        })
        .from(listings)
        .where(eq(listings.id, listingId));

    if (!listing) throw new Response("Not Found", { status: 404 });

    const currentMonth = DateTime.now().toFormat("yyyy-MM");
    const months = recentMonths(12).filter((m) => m <= currentMonth);

    const explicitMonth = url.searchParams.get("month");
    let selectedMonth = explicitMonth
        ? (explicitMonth > currentMonth ? currentMonth : explicitMonth)
        : defaultMonth();

    if (!explicitMonth) {
        const [latestSettled] = await db
            .select({ month: operatorSettlements.month })
            .from(operatorSettlements)
            .where(eq(operatorSettlements.listingId, listingId))
            .orderBy(sql`${operatorSettlements.month} desc`)
            .limit(1);
        if (latestSettled) {
            selectedMonth = latestSettled.month;
        }
    }

    const [tokenRow] = await db
        .select({
            id: rwaTokens.id,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            status: rwaTokens.status,
        })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, listingId));

    const [sy, sm] = selectedMonth.split("-").map(Number);
    const startTs = DateTime.local(sy, sm, 1).startOf("month").toUnixInteger();
    const endTs = DateTime.local(sy, sm, 1).endOf("month").toUnixInteger();

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
        .where(and(eq(operatorSettlements.listingId, listingId), eq(operatorSettlements.month, selectedMonth)));

    const [govRow] = await db
        .select({
            settlementUsdc: localGovSettlements.settlementUsdc,
            payoutTx: localGovSettlements.payoutTx,
        })
        .from(localGovSettlements)
        .where(and(eq(localGovSettlements.listingId, listingId), eq(localGovSettlements.month, selectedMonth)));

    let investors: InvestorRow[] = [];
    let investorTotalUsdc = 0;
    let investorCount = 0;
    let claimedCount = 0;

    if (tokenRow) {
        // 지갑별 보유 토큰 합산 (동일 지갑의 여러 구매 내역을 합쳐서 비율 계산)
        const investmentRows = await db
            .select({
                walletAddress: rwaInvestments.walletAddress,
                tokenAmount: sql<number>`sum(${rwaInvestments.tokenAmount})`,
            })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.rwaTokenId, tokenRow.id))
            .groupBy(rwaInvestments.walletAddress);

        const dividendRows = await db
            .select({
                walletAddress: rwaDividends.walletAddress,
                dividendUsdc: rwaDividends.dividendUsdc,
                claimTx: rwaDividends.claimTx,
            })
            .from(rwaDividends)
            .where(and(
                eq(rwaDividends.rwaTokenId, tokenRow.id),
                eq(rwaDividends.month, selectedMonth),
            ));

        const dividendMap = new Map(dividendRows.map((d) => [d.walletAddress, d]));

        const [divAgg] = await db
            .select({
                total: sql<number>`coalesce(sum(${rwaDividends.dividendUsdc}), 0)`,
                cnt: sql<number>`count(*)`,
                claimed: sql<number>`sum(case when ${rwaDividends.claimTx} is not null then 1 else 0 end)`,
            })
            .from(rwaDividends)
            .where(and(eq(rwaDividends.rwaTokenId, tokenRow.id), eq(rwaDividends.month, selectedMonth)));

        investorTotalUsdc = Number(divAgg?.total ?? 0);
        investorCount = Number(divAgg?.cnt ?? 0);
        claimedCount = Number(divAgg?.claimed ?? 0);

        // 비율 기준: 실제 투자자 보유 토큰 합산 기준 (항상 합이 100%)
        const totalTokensSold = investmentRows.reduce((sum, r) => sum + r.tokenAmount, 0) || 1;
        investors = investmentRows.map((inv) => {
            const div = dividendMap.get(inv.walletAddress);
            return {
                walletAddress: inv.walletAddress,
                tokenAmount: inv.tokenAmount,
                sharePercent: (inv.tokenAmount / totalTokensSold) * 100,
                dividendUsdc: div ? Number(div.dividendUsdc) : null,
                claimed: !!div?.claimTx,
                claimTx: div?.claimTx ?? null,
            };
        }).sort((a, b) => b.tokenAmount - a.tokenAmount);
    }

    // N+1 방지: 모든 달의 매출/정산 여부를 2번 쿼리로 한 번에 조회
    const firstMonth = months[months.length - 1]; // 가장 오래된 달
    const [fy, fm] = firstMonth.split("-").map(Number);
    const [cy, cm] = months[0].split("-").map(Number);
    const rangeStartTs = DateTime.local(fy, fm, 1).startOf("month").toUnixInteger();
    const rangeEndTs = DateTime.local(cy, cm, 1).endOf("month").toUnixInteger();

    const [revenueByMonth, settledMonths] = await Promise.all([
        db
            .select({
                month: sql<string>`strftime('%Y-%m', datetime(${bookings.checkIn}, 'unixepoch'))`,
                sum: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
            })
            .from(bookings)
            .where(and(
                eq(bookings.listingId, listingId),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkIn} >= ${rangeStartTs}`,
                sql`${bookings.checkIn} <= ${rangeEndTs}`,
            ))
            .groupBy(sql`strftime('%Y-%m', datetime(${bookings.checkIn}, 'unixepoch'))`),
        db
            .select({ month: operatorSettlements.month })
            .from(operatorSettlements)
            .where(and(
                eq(operatorSettlements.listingId, listingId),
                inArray(operatorSettlements.month, months),
            )),
    ]);

    const revenueMap = new Map(revenueByMonth.map((r) => [r.month, Number(r.sum)]));
    const settledSet = new Set(settledMonths.map((s) => s.month));

    const monthSummaries = months.map((month) => ({
        month,
        grossRevenueKrw: revenueMap.get(month) ?? 0,
        settled: settledSet.has(month),
    }));

    const filteredMonthSummaries = monthSummaries.filter((r) => r.grossRevenueKrw > 0 || r.settled);

    const selectedData = {
        grossRevenueKrw: Number(revenue?.sum ?? 0),
        bookingCount: Number(revenue?.count ?? 0),
        operatingCostKrw: opRow ? Number(opRow.operatingCostKrw) : null,
        operatingProfitKrw: opRow ? Number(opRow.operatingProfitKrw) : null,
        operatorUsdc: opRow ? Number(opRow.settlementUsdc) : null,
        operatorPayoutTx: opRow?.payoutTx ?? null,
        localGovUsdc: govRow ? Number(govRow.settlementUsdc) : null,
        localGovPayoutTx: govRow?.payoutTx ?? null,
        investorTotalUsdc: investorCount > 0 ? investorTotalUsdc : null,
        investorCount,
        claimedCount,
        settled: !!opRow,
    };

    return {
        listing,
        selectedMonth,
        currentMonth,
        monthSummaries: filteredMonthSummaries,
        selectedData,
        investors,
        tokenInfo: tokenRow ? { totalSupply: tokenRow.totalSupply, tokensSold: tokenRow.tokensSold, status: tokenRow.status } : null,
    };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function usdcFmt(v: number | null) {
    if (v == null) return "--";
    return `${(v / 1_000_000).toFixed(2)}`;
}

function shortenWallet(addr: string) {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function shortenTx(tx: string) {
    if (tx.length <= 16) return tx;
    return `${tx.slice(0, 8)}...${tx.slice(-8)}`;
}

const statusBadgeClass: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10",
    funded: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
    funding: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminSettlementsDetail() {
    const { t, i18n } = useTranslation("admin");
    const {
        listing, selectedMonth, currentMonth,
        monthSummaries, selectedData, investors, tokenInfo,
    } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    const images = Array.isArray(listing.images) ? listing.images as string[] : [];
    const totalDistributedUsdc =
        (selectedData.localGovUsdc ?? 0) +
        (selectedData.operatorUsdc ?? 0) +
        (selectedData.investorTotalUsdc ?? 0);

    return (
        <div className="font-sans">
            <main className="pb-16">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                    <Link
                        to="/admin"
                        aria-label="어드민 대시보드로 돌아가기"
                        className="shrink-0 w-11 h-11 rounded-xl border border-stone-200 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    </Link>
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                        {images[0]
                            ? <img src={images[0]} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-stone-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-[#4a3b2c] truncate">{listing.title}</h1>
                        <p className="text-sm text-stone-400 mt-0.5">{listing.location}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                        {tokenInfo && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-xs font-bold rounded-full",
                                    statusBadgeClass[tokenInfo.status] ?? "bg-stone-100 text-stone-500 border-stone-200"
                                )}
                            >
                                {t(`settlements.status.${tokenInfo.status}` as any) ?? tokenInfo.status}
                            </Badge>
                        )}
                        {monthSummaries.length > 0 && (
                            <Select
                                value={selectedMonth}
                                onValueChange={(v) => navigate(`/admin/settlements/${listing.id}?month=${v}`)}
                            >
                                <SelectTrigger className="w-44 rounded-xl h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthSummaries.map((ms) => (
                                        <SelectItem key={ms.month} value={ms.month}>
                                            {ms.month}{ms.settled ? ` (${t("settlements.status.settled")})` : ms.grossRevenueKrw > 0 ? ` (${t("settlements.status.unsettled")})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-5 pb-5">
                                <p className="text-[11px] text-stone-400 mb-1">{t("settlements.revenue")}</p>
                                <p className="text-lg font-bold text-[#4a3b2c]">
                                    {selectedData.grossRevenueKrw > 0
                                        ? <>{formatKrwLabel(selectedData.grossRevenueKrw, i18n.language as "ko" | "en")}</>
                                        : <span className="text-stone-300">--</span>}
                                </p>
                                {selectedData.bookingCount > 0 && (
                                    <p className="text-[10px] text-stone-400 mt-0.5">{t("settlements.bookingCount", { count: selectedData.bookingCount })}</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-5 pb-5">
                                <p className="text-[11px] text-stone-400 mb-1">{t("settlements.operatingProfit")}</p>
                                <p className="text-lg font-bold text-[#4a3b2c]">
                                    {selectedData.operatingProfitKrw != null
                                        ? <>{formatKrwLabel(selectedData.operatingProfitKrw, i18n.language as "ko" | "en")}</>
                                        : <span className="text-stone-300">--</span>}
                                </p>
                                {selectedData.operatingCostKrw != null && (
                                    <p className="text-[10px] text-stone-400 mt-0.5">{t("settlements.operatingCost", { amount: selectedData.operatingCostKrw.toLocaleString() })}</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-5 pb-5">
                                <p className="text-[11px] text-stone-400 mb-1">{t("settlements.totalDistributed")}</p>
                                <p className="text-lg font-bold text-[#4a3b2c]">
                                    {totalDistributedUsdc > 0
                                        ? <>{usdcFmt(totalDistributedUsdc)}<span className="text-xs font-normal text-stone-400 ml-0.5">USDC</span></>
                                        : <span className="text-stone-300">--</span>}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-5 pb-5">
                                <p className="text-[11px] text-stone-400 mb-1">{t("settlements.settlementStatus")}</p>
                                {selectedData.settled ? (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-[#17cf54]" />
                                        <span className="text-sm font-semibold text-[#17cf54]">{t("settlements.status.settled")}</span>
                                    </div>
                                ) : selectedData.grossRevenueKrw > 0 && selectedMonth < currentMonth ? (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                        <span className="text-sm font-semibold text-amber-500">{t("settlements.status.unsettled")}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="w-2 h-2 rounded-full bg-stone-200" />
                                        <span className="text-sm font-medium text-stone-400">{t("settlements.status.na")}</span>
                                    </div>
                                )}
                                {!selectedData.settled && selectedData.grossRevenueKrw > 0 && selectedMonth < currentMonth && (
                                    <div className="mt-2">
                                        <MonthlySettlementButton listingId={listing.id} listingTitle={listing.title} month={selectedMonth} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Distribution breakdown */}
                    {selectedData.settled && (
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("settlements.distributionDetail")}</CardTitle>
                                    <span className="text-xs text-stone-400">{selectedMonth}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-0 divide-y divide-stone-100">
                                {/* Local gov */}
                                <div className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-blue-500 text-[18px]">account_balance</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-stone-700">{t("settlements.municipality")}</p>
                                            <p className="text-[10px] text-stone-400">{t("settlements.municipalityShare")}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-stone-800">{usdcFmt(selectedData.localGovUsdc)} USDC</p>
                                        {selectedData.localGovPayoutTx && (
                                            <a
                                                href={`https://explorer.solana.com/tx/${selectedData.localGovPayoutTx}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 text-[10px] text-[#17cf54] hover:underline mt-0.5"
                                            >
                                                {t("settlements.explorerLink")}
                                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {/* Operator */}
                                <div className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-amber-500 text-[18px]">person</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-stone-700">{t("settlements.operator")}</p>
                                            <p className="text-[10px] text-stone-400">{t("settlements.operatorShare")}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-stone-800">{usdcFmt(selectedData.operatorUsdc)} USDC</p>
                                        {selectedData.operatorPayoutTx && (
                                            <a
                                                href={`https://explorer.solana.com/tx/${selectedData.operatorPayoutTx}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-0.5 text-[10px] text-[#17cf54] hover:underline mt-0.5"
                                            >
                                                {t("settlements.explorerLink")}
                                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {/* Investors */}
                                <div className="py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#17cf54]/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[#17cf54] text-[18px]">groups</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-stone-700">{t("settlements.investorDividend")}</p>
                                            <p className="text-[10px] text-stone-400">{t("settlements.investorShare", { count: selectedData.investorCount })}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-stone-800">{usdcFmt(selectedData.investorTotalUsdc)} USDC</p>
                                        <p className="text-[10px] text-stone-400 mt-0.5">
                                            {t("settlements.claimedCount", { claimed: selectedData.claimedCount, total: selectedData.investorCount })}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Investor table */}
                    {investors.length > 0 && (
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("settlements.investorDetail")}</CardTitle>
                                    <span className="text-xs text-stone-400">{t("settlements.investorCount", { count: investors.length })}</span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-stone-100">
                                                <TableHead className="pl-6">{t("settlements.tableWallet")}</TableHead>
                                                <TableHead className="text-right hidden sm:table-cell">{t("settlements.tableTokens")}</TableHead>
                                                <TableHead className="text-right hidden sm:table-cell">{t("settlements.tableRatio")}</TableHead>
                                                <TableHead className="text-right">{t("settlements.tableDividend")}</TableHead>
                                                <TableHead className="text-center pr-6">{t("settlements.tableStatus")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {investors.map((inv) => (
                                                <TableRow key={inv.walletAddress}>
                                                    <TableCell className="pl-6">
                                                        <span className="font-mono text-xs text-stone-600" title={inv.walletAddress}>
                                                            {shortenWallet(inv.walletAddress)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-stone-700 hidden sm:table-cell">
                                                        {inv.tokenAmount.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-stone-500 hidden sm:table-cell">
                                                        {inv.sharePercent.toFixed(1)}%
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {inv.dividendUsdc != null ? (
                                                            <span className="text-sm font-medium text-stone-700">{usdcFmt(inv.dividendUsdc)} USDC</span>
                                                        ) : (
                                                            <span className="text-sm text-stone-300">--</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center pr-6">
                                                        {inv.dividendUsdc == null ? (
                                                            <span className="text-xs text-stone-300">--</span>
                                                        ) : inv.claimed ? (
                                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 text-xs font-bold rounded-full">
                                                                {t("settlements.claimed")}
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10 text-xs font-bold rounded-full">
                                                                {t("settlements.unclaimed")}
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Unsettled notice */}
                    {!selectedData.settled && selectedData.grossRevenueKrw > 0 && selectedMonth < currentMonth && investors.length === 0 && (
                        <Card className="rounded-3xl border-amber-200/60 bg-amber-50/50 shadow-sm">
                            <CardContent className="py-8 text-center">
                                <p className="text-sm text-amber-700 font-medium">{t("settlements.notSettledYet")}</p>
                                <p className="text-xs text-amber-500 mt-1">{t("settlements.notSettledHint")}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* No data */}
                    {selectedData.grossRevenueKrw === 0 && !selectedData.settled && (
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="py-12 text-center">
                                <p className="text-sm text-stone-400">{t("settlements.noRevenue")}</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
