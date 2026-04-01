import { useState, useMemo } from "react";
import { Link, useLoaderData } from "react-router";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { getHostListings, type HostListingRow } from "../lib/admin-dashboard.server";
import { db } from "../db/index.server";
import { rwaInvestments, user as userTable, bookings, operatorSettlements } from "../db/schema";
import { sql, eq, and, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Route } from "./+types/admin.dashboard";
import { InitializePropertyButton } from "~/components/rwa/InitializePropertyButton";
import { ReleaseFundsButton } from "~/components/rwa/ReleaseFundsButton";
import { syncFundingStatuses } from "~/lib/rwa.server";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { Separator } from "~/components/ui/separator";
import { Input } from "~/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "~/components/ui/sheet";
import { fmtKrw, fmtUsdc, formatKrwLabel } from "~/lib/formatters";
import { cn } from "~/lib/utils";
import { TOTAL_SUPPLY, KRW_PER_USDC } from "~/lib/constants";

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    // 데드라인 지난 funding 매물 상태 동기화 (온체인 기준)
    await syncFundingStatuses().catch((e) =>
        console.warn("[admin.dashboard] syncFundingStatuses 실패:", e?.message)
    );

    const allListings = await getHostListings("", "admin");

    const [investorCountRow] = await db
        .select({ count: sql<number>`count(distinct ${rwaInvestments.userId})` })
        .from(rwaInvestments);

    const [totalInvestedRow] = await db
        .select({
            sum: sql<number>`coalesce(sum(${rwaInvestments.investedUsdc}), 0)`,
        })
        .from(rwaInvestments);

    const [userCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userTable);

    // 데드라인 경과 시 목표 달성 여부에 따라 표시 상태 보정 (DB 업데이트와 별개)
    const now = Date.now();
    for (const l of allListings) {
        if (l.tokenMint && l.tokenStatus === "funding" && l.fundingDeadline) {
            const deadlineMs = new Date(l.fundingDeadline).getTime();
            if (now > deadlineMs) {
                const progress = l.totalSupply > 0
                    ? (l.tokensSold / l.totalSupply) * 10000
                    : 0;
                if (progress < l.minFundingBps) {
                    l.tokenStatus = "failed";
                } else {
                    // 목표 달성 + 기간 종료 → funded로 표시 (DB sync는 syncFundingStatuses가 처리)
                    l.tokenStatus = "funded";
                }
            }
        }
    }

    const tokenizedCount = allListings.filter((l) => l.tokenMint).length;
    const fundingCount = allListings.filter(
        (l) => l.tokenMint && l.tokenStatus === "funding"
    ).length;
    const activeCount = allListings.filter(
        (l) => l.tokenMint && l.tokenStatus === "active"
    ).length;

    // 미정산 체크: active 매물 중 직전 월에 매출은 있는데 정산이 안 된 매물
    const activeListingIds = allListings
        .filter((l) => l.tokenStatus === "active")
        .map((l) => l.id);

    const unsettledSet = new Set<string>();

    if (activeListingIds.length > 0) {
        const now = DateTime.now();
        const prevMonth = now.minus({ months: 1 });
        const prevMonthStr = prevMonth.toFormat("yyyy-MM");
        const startTs = prevMonth.startOf("month").toUnixInteger();
        const endTs = prevMonth.endOf("month").toUnixInteger();

        // 직전 월에 매출이 있는 매물
        const revenueRows = await db
            .select({
                listingId: bookings.listingId,
                revenue: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)`,
            })
            .from(bookings)
            .where(and(
                inArray(bookings.listingId, activeListingIds),
                sql`${bookings.status} in ('confirmed', 'completed')`,
                sql`${bookings.checkIn} >= ${startTs}`,
                sql`${bookings.checkIn} <= ${endTs}`,
            ))
            .groupBy(bookings.listingId);

        const hasRevenueIds = revenueRows
            .filter((r) => Number(r.revenue) > 0)
            .map((r) => r.listingId);

        if (hasRevenueIds.length > 0) {
            // 직전 월에 정산 완료된 매물
            const settledRows = await db
                .select({ listingId: operatorSettlements.listingId })
                .from(operatorSettlements)
                .where(and(
                    inArray(operatorSettlements.listingId, hasRevenueIds),
                    eq(operatorSettlements.month, prevMonthStr),
                ));
            const settledIds = new Set(settledRows.map((r) => r.listingId));

            for (const id of hasRevenueIds) {
                if (!settledIds.has(id)) unsettledSet.add(id);
            }
        }
    }

    return {
        allListings,
        unsettledIds: Array.from(unsettledSet),
        stats: {
            totalListings: allListings.length,
            tokenizedCount,
            fundingCount,
            activeCount,
            totalUsers: Number(userCountRow?.count ?? 0),
            totalInvestors: Number(investorCountRow?.count ?? 0),
            totalInvestedUsdc: Number(totalInvestedRow?.sum ?? 0) / 1_000_000,
        },
    };
}

/* ------------------------------------------------------------------ */
/*  Status maps                                                        */
/* ------------------------------------------------------------------ */

const statusLabel: Record<string, string> = {
    funding: "펀딩중",
    funded: "펀딩 완료",
    active: "운영중",
    failed: "펀딩 실패",
};

const statusBadgeClass: Record<string, string> = {
    funding:
        "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10",
    funded: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10",
    failed: "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10",
};

/* ------------------------------------------------------------------ */
/*  Helper: StatItem                                                   */
/* ------------------------------------------------------------------ */

function StatItem({
    icon,
    iconBg,
    label,
    value,
    large,
}: {
    icon: string;
    iconBg: string;
    label: string;
    value: string | number;
    large?: boolean;
}) {
    return (
        <div className={cn("flex items-center gap-3", large && "mb-1")}>
            <div
                className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    iconBg
                )}
            >
                <span className="material-symbols-outlined text-[20px]">
                    {icon}
                </span>
            </div>
            <div>
                <p className="text-xs text-stone-400 font-medium">{label}</p>
                <p
                    className={cn(
                        "font-bold text-[#4a3b2c]",
                        large ? "text-3xl" : "text-xl"
                    )}
                >
                    {value}
                </p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Helper: PipelineStep                                               */
/* ------------------------------------------------------------------ */

const pipelineColors: Record<
    string,
    { bg: string; text: string; ring: string }
> = {
    stone: {
        bg: "bg-stone-100",
        text: "text-stone-500",
        ring: "ring-stone-200",
    },
    amber: {
        bg: "bg-amber-500/10",
        text: "text-amber-600",
        ring: "ring-amber-300",
    },
    blue: {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        ring: "ring-blue-300",
    },
    emerald: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600",
        ring: "ring-emerald-300",
    },
};

function PipelineStep({
    label,
    count,
    color,
}: {
    label: string;
    count: number;
    color: string;
}) {
    const c = pipelineColors[color] ?? pipelineColors.stone;
    const hasItems = count > 0;
    return (
        <div className="flex flex-col items-center gap-1.5 min-w-[72px]">
            <div
                className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ring-2",
                    hasItems
                        ? cn(c.bg, c.text, c.ring)
                        : "bg-stone-50 text-stone-300 ring-stone-100"
                )}
            >
                {count}
            </div>
            <span className="text-xs font-medium text-stone-500">{label}</span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Helper: ListingSheet (right slide panel)                           */
/* ------------------------------------------------------------------ */

function ListingSheet({
    listing,
    open,
    onOpenChange,
    isUnsettled,
}: {
    listing: HostListingRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isUnsettled: boolean;
}) {
    const [forceFundStatus, setForceFundStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [forceFundError, setForceFundError] = useState("");

    async function handleForceFund() {
        if (!listing?.rwaTokenId) return;
        setForceFundStatus("loading");
        setForceFundError("");
        try {
            const res = await fetch("/api/admin/force-fund", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId: listing.rwaTokenId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "전환 실패");
            setForceFundStatus("done");
            setTimeout(() => window.location.reload(), 800);
        } catch (e: any) {
            setForceFundError(e.message);
            setForceFundStatus("error");
        }
    }

    const [minFundingPct, setMinFundingPct] = useState(60);
    const [deadlineStr, setDeadlineStr] = useState("");

    // Reset state when listing changes
    const toDatetimeLocal = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    // Initialize deadline when sheet opens with a new listing
    const listingId = listing?.id ?? "";
    useState(() => {
        setDeadlineStr(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    });

    if (!listing) return null;

    const isTokenized = !!listing.tokenMint;
    const valuationKrw = listing.valuationKrw;

    // Pre-tokenization calculations
    const tokenPriceKrw = valuationKrw > 0 ? valuationKrw / TOTAL_SUPPLY : 0;
    const tokenPriceUsdc = tokenPriceKrw / KRW_PER_USDC;
    const targetKrw = valuationKrw * (minFundingPct / 100);
    const previewApyBps = valuationKrw > 0
        ? Math.round((listing.pricePerNight * 365 * 0.55 * 0.55 * 0.30) / valuationKrw * 10000)
        : 0;
    const previewApyPct = previewApyBps / 100;
    const apyLevel: "normal" | "high" | "warn" =
        previewApyBps > 50_000 ? "warn" :
        previewApyBps > 3_000  ? "high" :
        "normal";

    const minDatetime = toDatetimeLocal(new Date(Date.now() + 10 * 60 * 1000));
    const maxDatetime = toDatetimeLocal(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    const isDeadlineValid = !!deadlineStr && deadlineStr >= minDatetime;
    const deadlineTs = deadlineStr ? Math.floor(new Date(deadlineStr).getTime() / 1000) : 0;

    const quickSet = (hours: number) => {
        setDeadlineStr(toDatetimeLocal(new Date(Date.now() + hours * 60 * 60 * 1000)));
    };

    // Post-tokenization calculations
    const soldPct = listing.totalSupply > 0
        ? Math.min(100, (listing.tokensSold / listing.totalSupply) * 100)
        : 0;
    const minPct = listing.minFundingBps / 100;
    const deadline = listing.fundingDeadline ? new Date(listing.fundingDeadline) : null;
    const daysLeft = deadline
        ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-lg overflow-y-auto bg-[#fcfaf7] p-0"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#fcfaf7] border-b border-stone-100 px-6 py-4">
                    <SheetHeader className="space-y-0">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-9 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                                {listing.image ? (
                                    <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-stone-300 text-[14px]">home</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <SheetTitle className="text-base font-bold text-[#4a3b2c] truncate">
                                    {listing.title}
                                </SheetTitle>
                                <SheetDescription className="text-xs text-stone-400 mt-0">
                                    {listing.location}
                                </SheetDescription>
                            </div>
                            {isTokenized && (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[11px] font-bold rounded-full shrink-0",
                                        statusBadgeClass[listing.tokenStatus ?? ""] ?? "bg-stone-100 text-stone-500 border-stone-200"
                                    )}
                                >
                                    {statusLabel[listing.tokenStatus ?? ""] ?? listing.tokenStatus}
                                </Badge>
                            )}
                        </div>
                    </SheetHeader>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                    {isTokenized ? (
                        /* ---- Post-tokenization content ---- */
                        <>
                            {/* Funding progress */}
                            {(listing.tokenStatus === "funding" || listing.tokenStatus === "funded") && (
                                <div>
                                    <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                                        <span>판매 진행률</span>
                                        <span className="font-semibold text-[#4a3b2c]">{soldPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#17cf54] rounded-full transition-all"
                                            style={{ width: `${soldPct}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1.5">
                                        <span>{listing.tokensSold.toLocaleString()} / {listing.totalSupply.toLocaleString()} 토큰</span>
                                        <span>최소 목표 {minPct}%</span>
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">감정가</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(listing.valuationKrw)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">1박 요금</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{fmtKrw(listing.pricePerNight)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">
                                        {listing.tokenStatus === "funding" ? "마감까지" : "마감일"}
                                    </p>
                                    {daysLeft !== null && listing.tokenStatus === "funding" ? (
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            {daysLeft}<span className="text-[10px] font-normal text-stone-400 ml-0.5">일</span>
                                        </p>
                                    ) : deadline ? (
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            {deadline.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-stone-300">--</p>
                                    )}
                                </div>
                            </div>

                            {/* On-chain info */}
                            <div>
                                <p className="text-xs text-stone-400 mb-1.5">Token Mint</p>
                                <p className="text-[11px] font-mono text-stone-600 break-all bg-white border border-stone-100 px-3 py-2 rounded-xl">
                                    {listing.tokenMint}
                                </p>
                                <a
                                    href={`https://explorer.solana.com/address/${listing.tokenMint}?cluster=devnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-[#17cf54] hover:underline mt-1.5"
                                >
                                    Explorer에서 보기
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            </div>

                            <Separator />

                            {/* Actions */}
                            {listing.tokenStatus === "funding" && listing.rwaTokenId && (
                                <div className="space-y-2">
                                    <p className="text-xs text-stone-400 font-medium">관리자 수동 전환</p>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                                        온체인 validator 없이 DB 상태만 강제로 <span className="font-bold">펀딩 완료</span>로 전환합니다.
                                        이후 지갑 연결 후 "운영 시작" 버튼으로 on-chain 처리하세요.
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={handleForceFund}
                                        disabled={forceFundStatus === "loading" || forceFundStatus === "done"}
                                    >
                                        {forceFundStatus === "loading" ? "처리 중..." :
                                         forceFundStatus === "done" ? "완료 — 새로고침 중..." :
                                         "펀딩 완료로 수동 전환"}
                                    </Button>
                                    {forceFundStatus === "error" && (
                                        <p className="text-xs text-red-500">{forceFundError}</p>
                                    )}
                                </div>
                            )}

                            {listing.tokenStatus === "funded" && (
                                <div>
                                    <p className="text-sm font-semibold text-[#4a3b2c] mb-1">운영 전환</p>
                                    <p className="text-xs text-stone-400 mb-3">
                                        펀딩이 완료된 매물입니다. 투자금을 수령하고 예약·배당을 시작하세요.
                                    </p>
                                    <ReleaseFundsButton
                                        listingId={listing.id}
                                        rwaTokenId={listing.rwaTokenId!}
                                        tokenMint={listing.tokenMint!}
                                        authorityWallet={null}
                                    />
                                </div>
                            )}

                            {listing.tokenStatus === "active" && (
                                <div className={cn(
                                    "rounded-xl p-4 flex items-center justify-between border",
                                    isUnsettled
                                        ? "bg-red-500/5 border-red-500/20"
                                        : "bg-[#17cf54]/5 border-[#17cf54]/20"
                                )}>
                                    <div>
                                        <p className="text-sm font-semibold text-[#4a3b2c]">
                                            {isUnsettled ? "미정산 매출 있음" : "운영 중"}
                                        </p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {isUnsettled ? "직전 월 정산이 필요합니다." : "월정산에서 수익을 분배하세요."}
                                        </p>
                                    </div>
                                    <Button variant={isUnsettled ? "destructive" : "success"} size="sm" asChild>
                                        <Link to={`/admin/settlements/${listing.id}`}>
                                            {isUnsettled ? "정산하기" : "정산 관리"}
                                        </Link>
                                    </Button>
                                </div>
                            )}

                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <Link to={`/invest/${listing.id}`}>
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    투자 페이지 보기
                                </Link>
                            </Button>
                        </>
                    ) : (
                        /* ---- Pre-tokenization content ---- */
                        <>
                            {/* Valuation */}
                            <div>
                                <p className="text-xs text-stone-400 mb-1">매물 감정가</p>
                                <p className="text-2xl font-bold text-[#4a3b2c]">{valuationKrw.toLocaleString()}원</p>
                            </div>

                            <Separator />

                            {/* Settings */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-stone-500 mb-1.5 block">최소 모집 비율</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={minFundingPct}
                                            onChange={(e) => setMinFundingPct(Number(e.target.value))}
                                            min={1}
                                            max={100}
                                            step={1}
                                            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 bg-white pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-stone-500 mb-1.5 block">모집 마감</label>
                                    <input
                                        type="datetime-local"
                                        value={deadlineStr}
                                        onChange={(e) => setDeadlineStr(e.target.value)}
                                        min={minDatetime}
                                        max={maxDatetime}
                                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30 bg-white"
                                    />
                                    <div className="flex gap-1.5 mt-2">
                                        {[1, 6, 24, 72].map((h) => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => quickSet(h)}
                                                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
                                            >
                                                {h}시간
                                            </button>
                                        ))}
                                    </div>
                                    {!isDeadlineValid && deadlineStr && (
                                        <p className="text-[11px] text-red-500 mt-1">10분 이후로 설정해주세요</p>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Preview */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">발행 미리보기</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">총 발행량</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">1억 개</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">토큰 1개</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            ₩{tokenPriceKrw < 1 ? tokenPriceKrw.toFixed(4) : tokenPriceKrw.toFixed(1)}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">목표 모집액</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(targetKrw)}</p>
                                    </div>
                                    <div className={cn(
                                        "rounded-xl p-3 border",
                                        apyLevel === "warn" ? "bg-red-50 border-red-200" :
                                        apyLevel === "high" ? "bg-amber-50 border-amber-200" :
                                        "bg-white border-stone-100"
                                    )}>
                                        <p className="text-[11px] text-stone-400 mb-0.5">예상 APY</p>
                                        <p className={cn(
                                            "text-sm font-bold",
                                            apyLevel === "warn" ? "text-red-500" :
                                            apyLevel === "high" ? "text-amber-500" :
                                            "text-[#17cf54]"
                                        )}>
                                            {previewApyPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                                {apyLevel === "warn" && (
                                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-relaxed">
                                        감정가 대비 숙박가가 높아 APY가 비정상적입니다. 입력값을 확인하세요.
                                    </p>
                                )}
                                {apyLevel === "high" && (
                                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                                        일반 부동산 대비 높은 수익률입니다. 근거 자료 준비를 권장합니다.
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Issue */}
                            <div>
                                <p className="text-xs text-stone-400 mb-3">
                                    지갑으로 서명하면 토큰이 발행되고 투자자 모집이 시작됩니다.
                                </p>
                                <InitializePropertyButton
                                    listingId={listing.id}
                                    values={{
                                        valuationKrw,
                                        minFundingBps: minFundingPct * 100,
                                        fundingDeadlineTs: deadlineTs,
                                    }}
                                    disabled={!isDeadlineValid || valuationKrw <= 0}
                                />
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
    const { allListings, unsettledIds, stats } = useLoaderData<typeof loader>();
    const unsettledSet = useMemo(() => new Set(unsettledIds), [unsettledIds]);

    // --- client filter state ---
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // --- sheet state ---
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedListing, setSelectedListing] = useState<HostListingRow | null>(null);

    const openSheet = (listing: HostListingRow) => {
        setSelectedListing(listing);
        setSheetOpen(true);
    };

    const filteredListings = useMemo(() => {
        return allListings.filter((l) => {
            const q = searchQuery.toLowerCase();
            if (
                q &&
                !l.title.toLowerCase().includes(q) &&
                !l.location.toLowerCase().includes(q)
            )
                return false;
            if (statusFilter === "all") return true;
            if (statusFilter === "none") return !l.tokenMint;
            return l.tokenStatus === statusFilter;
        });
    }, [allListings, searchQuery, statusFilter]);

    // --- derived pipeline counts ---
    const notTokenizedCount = stats.totalListings - stats.tokenizedCount;
    const fundedCount = Math.max(
        0,
        stats.tokenizedCount - stats.fundingCount - stats.activeCount
    );

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-10 pb-16 px-4 sm:px-8">
                {/* ====== Section 1: Page header + quick actions ====== */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-[#4a3b2c]">
                            관리자 대시보드
                        </h1>
                        <p className="text-sm text-stone-400 mt-1">
                            전체 매물과 투자 현황을 한눈에
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/host/edit/new">새 숙소 등록</Link>
                        </Button>
                    </div>
                </div>

                {/* ====== Section 2: Stats -- two card groups ====== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* -- Property stats -- */}
                    <Card className="rounded-3xl border-stone-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-stone-400 tracking-wider uppercase">
                                매물 현황
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StatItem
                                large
                                icon="home"
                                iconBg="bg-[#17cf54]/10 text-[#17cf54]"
                                label="전체 숙소"
                                value={stats.totalListings}
                            />
                            <Separator className="my-4" />
                            <div className="grid grid-cols-3 gap-4">
                                <StatItem
                                    icon="verified"
                                    iconBg="bg-blue-500/10 text-blue-600"
                                    label="토큰화 완료"
                                    value={stats.tokenizedCount}
                                />
                                <StatItem
                                    icon="trending_up"
                                    iconBg="bg-amber-500/10 text-amber-600"
                                    label="펀딩 진행중"
                                    value={stats.fundingCount}
                                />
                                <StatItem
                                    icon="check_circle"
                                    iconBg="bg-emerald-500/10 text-emerald-600"
                                    label="운영중"
                                    value={stats.activeCount}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* -- Investment stats -- */}
                    <Card className="rounded-3xl border-stone-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-stone-400 tracking-wider uppercase">
                                투자 현황
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StatItem
                                large
                                icon="attach_money"
                                iconBg="bg-[#17cf54]/10 text-[#17cf54]"
                                label="총 투자액"
                                value={fmtUsdc(stats.totalInvestedUsdc)}
                            />
                            <Separator className="my-4" />
                            <div className="grid grid-cols-2 gap-4">
                                <StatItem
                                    icon="group"
                                    iconBg="bg-stone-100 text-stone-500"
                                    label="전체 가입자"
                                    value={stats.totalUsers}
                                />
                                <StatItem
                                    icon="person"
                                    iconBg="bg-blue-500/10 text-blue-600"
                                    label="전체 투자자"
                                    value={stats.totalInvestors}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ====== Section 3: Tokenization pipeline ====== */}
                <Card className="rounded-3xl border-stone-100 shadow-sm mb-8">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-[#4a3b2c]">
                            토큰화 파이프라인
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between px-4">
                            <PipelineStep
                                label="미등록"
                                count={notTokenizedCount}
                                color="stone"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label="펀딩중"
                                count={stats.fundingCount}
                                color="amber"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label="펀딩 완료"
                                count={fundedCount}
                                color="blue"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label="운영중"
                                count={stats.activeCount}
                                color="emerald"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ====== Section 4: Listings table with search/filter ====== */}
                <Card className="rounded-3xl border-stone-100 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <CardTitle className="text-base font-bold text-[#4a3b2c]">
                                전체 매물
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 text-[18px]">
                                        search
                                    </span>
                                    <Input
                                        placeholder="숙소명 또는 위치 검색..."
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        className="pl-9 w-56 h-9 rounded-xl text-sm"
                                    />
                                </div>
                                {/* Status filter */}
                                <Select
                                    value={statusFilter}
                                    onValueChange={setStatusFilter}
                                >
                                    <SelectTrigger className="w-32 rounded-xl h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            전체
                                        </SelectItem>
                                        <SelectItem value="none">
                                            미등록
                                        </SelectItem>
                                        <SelectItem value="funding">
                                            펀딩중
                                        </SelectItem>
                                        <SelectItem value="funded">
                                            펀딩 완료
                                        </SelectItem>
                                        <SelectItem value="active">
                                            운영중
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Count */}
                                <span className="text-sm text-stone-400 whitespace-nowrap">
                                    {filteredListings.length}개 매물
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-stone-100">
                                    <TableHead className="pl-6 w-[320px]">
                                        숙소
                                    </TableHead>
                                    <TableHead className="text-right">
                                        1박 요금
                                    </TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead className="text-right pr-6">
                                        관리
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredListings.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4}
                                            className="h-32 text-center"
                                        >
                                            <div className="flex flex-col items-center gap-2 text-stone-300">
                                                <span className="material-symbols-outlined text-[32px]">
                                                    search_off
                                                </span>
                                                <span className="text-sm">
                                                    검색 결과가 없습니다
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredListings.map((listing) => (
                                        <TableRow
                                            key={listing.id}
                                            className="cursor-pointer"
                                            onClick={() => openSheet(listing)}
                                        >
                                            {/* Property name + thumbnail */}
                                            <TableCell className="pl-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-14 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                                                        {listing.image ? (
                                                            <img
                                                                src={listing.image}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-stone-300 text-[16px]">
                                                                    home
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-[#4a3b2c]">
                                                            {listing.title}
                                                        </p>
                                                        <p className="text-xs text-stone-400">
                                                            {listing.location}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Price */}
                                            <TableCell className="text-right text-sm text-stone-700">
                                                {fmtKrw(listing.pricePerNight)}
                                            </TableCell>

                                            {/* Status badge */}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    {listing.tokenMint ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs font-bold rounded-full",
                                                                statusBadgeClass[
                                                                    listing.tokenStatus ?? ""
                                                                ] ??
                                                                    "bg-stone-100 text-stone-500 border-stone-200"
                                                            )}
                                                        >
                                                            {statusLabel[
                                                                listing.tokenStatus ?? ""
                                                            ] ?? listing.tokenStatus}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-stone-300 font-medium">
                                                            미등록
                                                        </span>
                                                    )}
                                                    {unsettledSet.has(listing.id) && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] font-bold rounded-full bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10"
                                                        >
                                                            미정산
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-2">
                                                    {listing.tokenMint ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openSheet(listing);
                                                            }}
                                                        >
                                                            토큰 관리
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="success"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openSheet(listing);
                                                            }}
                                                        >
                                                            토큰 발행
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>

            {/* Right slide sheet */}
            <ListingSheet
                listing={selectedListing}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                isUnsettled={selectedListing ? unsettledSet.has(selectedListing.id) : false}
            />
        </div>
    );
}
