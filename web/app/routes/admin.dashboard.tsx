import { useState, useMemo, useEffect } from "react";
import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { getHostListings, type HostListingRow } from "../lib/admin-dashboard.server";
import { db } from "../db/index.server";
import { rwaInvestments, user as userTable, bookings, listings, operatorSettlements } from "../db/schema";
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
import { TOTAL_SUPPLY } from "~/lib/constants";
import { usePythRate } from "~/hooks/usePythRate";

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

    // 승인 대기 중인 예약 목록
    const pendingBookings = await db
        .select({
            id: bookings.id,
            listingTitle: listings.title,
            listingId: bookings.listingId,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            totalPrice: bookings.totalPrice,
            paymentIntentId: bookings.paymentIntentId,
            onchainPayTx: bookings.onchainPayTx,
            createdAt: bookings.createdAt,
            guestName: userTable.name,
            guestEmail: userTable.email,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .innerJoin(userTable, eq(bookings.guestId, userTable.id))
        .where(eq(bookings.status, "pending"))
        .orderBy(bookings.createdAt);

    return {
        allListings,
        unsettledIds: Array.from(unsettledSet),
        pendingBookings,
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

// statusLabel replaced by t() calls in component

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

function useStatusLabel() {
    const { t } = useTranslation("admin");
    return (status: string) =>
        ({
            funding: t("dashboard.status.funding"),
            funded: t("dashboard.status.funded"),
            active: t("dashboard.status.active"),
            failed: t("dashboard.status.failed"),
        }[status] ?? status);
}

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
    const statusLabel = useStatusLabel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t, i18n } = useTranslation("admin") as any;
    const { rate: krwPerUsdc } = usePythRate();
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
            if (!res.ok) throw new Error(data.error ?? t("dashboard.sheet.forceFundError"));
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
    useEffect(() => {
        setDeadlineStr(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    }, [listingId]);

    if (!listing) return null;

    const isTokenized = !!listing.tokenMint;
    const valuationKrw = listing.valuationKrw;

    // Pre-tokenization calculations
    const tokenPriceKrw = valuationKrw > 0 ? valuationKrw / TOTAL_SUPPLY : 0;
    const tokenPriceUsdc = tokenPriceKrw / krwPerUsdc;
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
                                    {statusLabel(listing.tokenStatus ?? "")}
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
                                        <span>{t("tokenize.progress")}</span>
                                        <span className="font-semibold text-[#4a3b2c]">{soldPct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#17cf54] rounded-full transition-all"
                                            style={{ width: `${soldPct}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1.5">
                                        <span>{t("tokenize.tokenCount", { sold: listing.tokensSold.toLocaleString(), total: listing.totalSupply.toLocaleString() })}</span>
                                        <span>{t("tokenize.minTarget", { pct: minPct })}</span>
                                    </div>
                                </div>
                            )}

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">{t("tokenize.valuation")}</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(listing.valuationKrw, i18n.language as "ko" | "en")}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">{t("dashboard.sheet.nightlyRate")}</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{fmtKrw(listing.pricePerNight)}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 text-center border border-stone-100">
                                    <p className="text-[11px] text-stone-400 mb-1">
                                        {listing.tokenStatus === "funding" ? t("tokenize.deadline") : t("tokenize.deadlineDate")}
                                    </p>
                                    {daysLeft !== null && listing.tokenStatus === "funding" ? (
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            {t("tokenize.daysLeft", { days: daysLeft })}
                                        </p>
                                    ) : deadline ? (
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            {deadline.toLocaleDateString(i18n.language === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" })}
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
                                    {t("tokenize.viewExplorer")}
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            </div>

                            <Separator />

                            {/* Actions */}
                            {listing.tokenStatus === "funding" && listing.rwaTokenId && (
                                <div className="space-y-2">
                                    <p className="text-xs text-stone-400 font-medium">{t("dashboard.sheet.forceFundTitle")}</p>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                                        {t("dashboard.sheet.forceFundDesc")}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                                        onClick={handleForceFund}
                                        disabled={forceFundStatus === "loading" || forceFundStatus === "done"}
                                    >
                                        {forceFundStatus === "loading" ? t("dashboard.sheet.processing") :
                                         forceFundStatus === "done" ? t("dashboard.sheet.doneRefreshing") :
                                         t("dashboard.sheet.forceFundBtn")}
                                    </Button>
                                    {forceFundStatus === "error" && (
                                        <p className="text-xs text-red-500">{forceFundError}</p>
                                    )}
                                </div>
                            )}

                            {listing.tokenStatus === "funded" && (
                                <div>
                                    <p className="text-sm font-semibold text-[#4a3b2c] mb-1">{t("dashboard.sheet.goLiveTitle")}</p>
                                    <p className="text-xs text-stone-400 mb-3">
                                        {t("dashboard.sheet.goLiveDesc")}
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
                                            {isUnsettled ? t("dashboard.sheet.unsettledStatus") : t("dashboard.sheet.activeStatus")}
                                        </p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {isUnsettled ? t("dashboard.sheet.unsettledDesc") : t("dashboard.sheet.activeDesc")}
                                        </p>
                                    </div>
                                    <Button variant={isUnsettled ? "destructive" : "success"} size="sm" asChild>
                                        <Link to={`/admin/settlements/${listing.id}`}>
                                            {isUnsettled ? t("dashboard.sheet.settle") : t("dashboard.sheet.manageSettlements")}
                                        </Link>
                                    </Button>
                                </div>
                            )}

                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <Link to={`/invest/${listing.id}`}>
                                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    {t("dashboard.sheet.viewInvestPage")}
                                </Link>
                            </Button>
                        </>
                    ) : (
                        /* ---- Pre-tokenization content ---- */
                        <>
                            {/* Valuation */}
                            <div>
                                <p className="text-xs text-stone-400 mb-1">{t("tokenize.valuationLabel")}</p>
                                <p className="text-2xl font-bold text-[#4a3b2c]">{formatKrwLabel(valuationKrw, i18n.language as "ko" | "en")}</p>
                            </div>

                            <Separator />

                            {/* Settings */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-stone-500 mb-1.5 block">{t("tokenize.minFundingPct")}</label>
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
                                    <label className="text-xs text-stone-500 mb-1.5 block">{t("tokenize.deadline2")}</label>
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
                                                {t("tokenize.quickSet", { hours: h })}
                                            </button>
                                        ))}
                                    </div>
                                    {!isDeadlineValid && deadlineStr && (
                                        <p className="text-[11px] text-red-500 mt-1">{t("tokenize.deadlineError")}</p>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Preview */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{t("tokenize.preview")}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.totalSupply")}</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">{t("dashboard.sheet.totalSupplyVal")}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">{t("dashboard.sheet.tokenPriceLabel")}</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">
                                            ₩{tokenPriceKrw < 1 ? tokenPriceKrw.toFixed(4) : tokenPriceKrw.toFixed(1)}
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border border-stone-100">
                                        <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.minFundingTarget", { pct: minFundingPct })}</p>
                                        <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(targetKrw, i18n.language as "ko" | "en")}</p>
                                    </div>
                                    <div className={cn(
                                        "rounded-xl p-3 border",
                                        apyLevel === "warn" ? "bg-red-50 border-red-200" :
                                        apyLevel === "high" ? "bg-amber-50 border-amber-200" :
                                        "bg-white border-stone-100"
                                    )}>
                                        <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.estimatedApy")}</p>
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
                                        {t("tokenize.apyWarningCheck")}
                                    </p>
                                )}
                                {apyLevel === "high" && (
                                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                                        {t("tokenize.apyWarningHigh")}
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Issue */}
                            <div>
                                <p className="text-xs text-stone-400 mb-3">
                                    {t("tokenize.issueInstruction")}
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
/*  Helper: PendingBookingsSection                                     */
/* ------------------------------------------------------------------ */

type PendingBooking = {
    id: string;
    listingTitle: string;
    listingId: string;
    checkIn: Date | null;
    checkOut: Date | null;
    totalPrice: number;
    paymentIntentId: string | null;
    onchainPayTx: string | null;
    createdAt: Date | null;
    guestName: string;
    guestEmail: string;
};

function PendingBookingsSection({ pendingBookings }: { pendingBookings: PendingBooking[] }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t, i18n } = useTranslation("admin") as any;
    const locale = i18n.language as "ko" | "en";
    const [actionStates, setActionStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
    const [localList, setLocalList] = useState(pendingBookings);

    async function handleApprove(bookingId: string) {
        setActionStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setLocalList((l) => l.filter((b) => b.id !== bookingId));
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    async function handleReject(bookingId: string) {
        setActionStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setLocalList((l) => l.filter((b) => b.id !== bookingId));
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    function fmtDay(d: Date | null) {
        if (!d) return "—";
        return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(d));
    }

    return (
        <Card className="rounded-3xl border-stone-100 shadow-sm mb-8">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-[#4a3b2c] flex items-center gap-2">
                        {t("pending.title")}
                        {localList.length > 0 && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold">
                                {localList.length}
                            </span>
                        )}
                    </CardTitle>
                    <p className="text-xs text-stone-400">{t("pending.subtitle")}</p>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {localList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 text-stone-300 py-10">
                        <span className="material-symbols-outlined text-[32px]">check_circle</span>
                        <span className="text-sm">{t("pending.empty")}</span>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-stone-100">
                                <TableHead className="pl-6">{t("pending.colGuest")}</TableHead>
                                <TableHead>{t("pending.colProperty")}</TableHead>
                                <TableHead>{t("pending.colDates")}</TableHead>
                                <TableHead className="text-right">{t("pending.colAmount")}</TableHead>
                                <TableHead>{t("pending.colMethod")}</TableHead>
                                <TableHead className="text-right pr-6">{t("pending.colActions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localList.map((b) => {
                                const state = actionStates[b.id] ?? "idle";
                                const isLoading = state === "loading";
                                const payMethod = b.paymentIntentId ? "card" : "usdc";
                                return (
                                    <TableRow key={b.id} className="border-stone-100">
                                        <TableCell className="pl-6">
                                            <p className="text-sm font-semibold text-[#4a3b2c]">{b.guestName}</p>
                                            <p className="text-xs text-stone-400">{b.guestEmail}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/property/${b.listingId}`}
                                                className="text-sm text-[#4a3b2c] hover:underline font-medium"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {b.listingTitle}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-stone-600">
                                                {fmtDay(b.checkIn)} — {fmtDay(b.checkOut)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-sm font-semibold text-[#4a3b2c]">
                                                {fmtKrw(b.totalPrice)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-xs rounded-full",
                                                    payMethod === "card"
                                                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                                        : "bg-violet-500/10 text-violet-600 border-violet-500/20"
                                                )}
                                            >
                                                {payMethod === "card" ? t("pending.methodCard") : t("pending.methodUsdc")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            {state === "error" ? (
                                                <span className="text-xs text-red-500">{t("pending.actionError")}</span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="success"
                                                        disabled={isLoading}
                                                        onClick={() => handleApprove(b.id)}
                                                    >
                                                        {isLoading ? t("pending.processing") : t("pending.approve")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-red-200 text-red-600 hover:bg-red-50"
                                                        disabled={isLoading}
                                                        onClick={() => handleReject(b.id)}
                                                    >
                                                        {t("pending.reject")}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

/* ------------------------------------------------------------------ */
/*  Helper: CouncilTokenSheet                                          */
/* ------------------------------------------------------------------ */

function CouncilTokenSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    const [wallet, setWallet] = useState("");
    const [amount, setAmount] = useState("1");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [resultMsg, setResultMsg] = useState("");

    async function handleIssue() {
        const parsed = parseInt(amount, 10);
        if (!wallet.trim() || isNaN(parsed) || parsed < 1) return;
        setStatus("loading");
        setResultMsg("");
        try {
            const res = await fetch("/api/admin/issue-council-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress: wallet.trim(), amount: parsed }),
            });
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch { throw new Error(text.slice(0, 200)); }
            if (!res.ok) throw new Error(data.error ?? "발급 실패");
            setStatus("done");
            setResultMsg(`발급 완료 — tx: ${data.signature}`);
            setWallet("");
            setAmount("1");
        } catch (e: any) {
            setStatus("error");
            setResultMsg(e.message);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md bg-[#fcfaf7]">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-base font-bold text-[#4a3b2c] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-violet-500">token</span>
                        Council Token 발급
                    </SheetTitle>
                    <SheetDescription>
                        지자체·마을지기에게 거버넌스 의결권 토큰을 발급합니다.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs text-stone-400 font-medium mb-1.5 block">수령 지갑 주소</label>
                        <Input
                            placeholder="솔라나 지갑 주소 (base58)"
                            value={wallet}
                            onChange={(e) => setWallet(e.target.value)}
                            className="rounded-xl font-mono text-sm"
                            disabled={status === "loading"}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-stone-400 font-medium mb-1.5 block">수량</label>
                        <Input
                            type="number"
                            min="1"
                            max="100"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="rounded-xl text-sm w-32"
                            disabled={status === "loading"}
                        />
                    </div>
                    <Button
                        onClick={handleIssue}
                        disabled={status === "loading" || !wallet.trim()}
                        className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        {status === "loading" ? "발급 중..." : "발급하기"}
                    </Button>
                    {resultMsg && (
                        <p className={`text-xs font-mono break-all ${status === "done" ? "text-emerald-600" : "text-red-500"}`}>
                            {resultMsg}
                        </p>
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
    const { allListings, unsettledIds, pendingBookings, stats } = useLoaderData<typeof loader>();
    const statusLabel = useStatusLabel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t } = useTranslation("admin") as any;
    const unsettledSet = useMemo(() => new Set(unsettledIds), [unsettledIds]);

    // --- client filter state ---
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // --- sheet state ---
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedListing, setSelectedListing] = useState<HostListingRow | null>(null);
    const [councilSheetOpen, setCouncilSheetOpen] = useState(false);

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
                            {t("dashboard.title")}
                        </h1>
                        <p className="text-sm text-stone-400 mt-1">
                            {t("dashboard.subtitle")}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCouncilSheetOpen(true)}
                            className="border-violet-200 text-violet-600 hover:bg-violet-50"
                        >
                            Council Token 발급
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/host/edit/new">{t("dashboard.newListing")}</Link>
                        </Button>
                    </div>
                </div>

                {/* ====== Section 2: Stats -- two card groups ====== */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* -- Property stats -- */}
                    <Card className="rounded-3xl border-stone-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-stone-400 tracking-wider uppercase">
                                {t("dashboard.sections.propertyStatus")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StatItem
                                large
                                icon="home"
                                iconBg="bg-[#17cf54]/10 text-[#17cf54]"
                                label={t("dashboard.stats.totalListings")}
                                value={stats.totalListings}
                            />
                            <Separator className="my-4" />
                            <div className="grid grid-cols-3 gap-4">
                                <StatItem
                                    icon="verified"
                                    iconBg="bg-blue-500/10 text-blue-600"
                                    label={t("dashboard.stats.tokenized")}
                                    value={stats.tokenizedCount}
                                />
                                <StatItem
                                    icon="trending_up"
                                    iconBg="bg-amber-500/10 text-amber-600"
                                    label={t("dashboard.stats.funding")}
                                    value={stats.fundingCount}
                                />
                                <StatItem
                                    icon="check_circle"
                                    iconBg="bg-emerald-500/10 text-emerald-600"
                                    label={t("dashboard.stats.active")}
                                    value={stats.activeCount}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* -- Investment stats -- */}
                    <Card className="rounded-3xl border-stone-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-stone-400 tracking-wider uppercase">
                                {t("dashboard.sections.investmentStatus")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <StatItem
                                large
                                icon="attach_money"
                                iconBg="bg-[#17cf54]/10 text-[#17cf54]"
                                label={t("dashboard.stats.totalInvested")}
                                value={fmtUsdc(stats.totalInvestedUsdc)}
                            />
                            <Separator className="my-4" />
                            <div className="grid grid-cols-2 gap-4">
                                <StatItem
                                    icon="group"
                                    iconBg="bg-stone-100 text-stone-500"
                                    label={t("dashboard.stats.totalUsers")}
                                    value={stats.totalUsers}
                                />
                                <StatItem
                                    icon="person"
                                    iconBg="bg-blue-500/10 text-blue-600"
                                    label={t("dashboard.stats.totalInvestors")}
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
                            {t("dashboard.sections.pipeline")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between px-4">
                            <PipelineStep
                                label={t("dashboard.pipeline.notTokenized")}
                                count={notTokenizedCount}
                                color="stone"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label={t("dashboard.pipeline.funding")}
                                count={stats.fundingCount}
                                color="amber"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label={t("dashboard.pipeline.funded")}
                                count={fundedCount}
                                color="blue"
                            />
                            <div className="flex-1 h-0.5 bg-stone-200 mx-3" />
                            <PipelineStep
                                label={t("dashboard.pipeline.active")}
                                count={stats.activeCount}
                                color="emerald"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* ====== Section 4: Pending bookings ====== */}
                <PendingBookingsSection pendingBookings={pendingBookings} />

                {/* ====== Section 5: Listings table with search/filter ====== */}
                <Card className="rounded-3xl border-stone-100 shadow-sm">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <CardTitle className="text-base font-bold text-[#4a3b2c]">
                                {t("dashboard.sections.allListings")}
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 text-[18px]">
                                        search
                                    </span>
                                    <Input
                                        placeholder={t("dashboard.table.search")}
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
                                            {t("dashboard.table.filterAll")}
                                        </SelectItem>
                                        <SelectItem value="none">
                                            {t("dashboard.table.filterNone")}
                                        </SelectItem>
                                        <SelectItem value="funding">
                                            {t("dashboard.table.filterFunding")}
                                        </SelectItem>
                                        <SelectItem value="funded">
                                            {t("dashboard.table.filterFunded")}
                                        </SelectItem>
                                        <SelectItem value="active">
                                            {t("dashboard.table.filterActive")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Count */}
                                <span className="text-sm text-stone-400 whitespace-nowrap">
                                    {t("dashboard.table.count", { count: filteredListings.length })}
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-stone-100">
                                    <TableHead className="pl-6 w-[320px]">
                                        {t("dashboard.table.colProperty")}
                                    </TableHead>
                                    <TableHead className="text-right">
                                        {t("dashboard.table.colPrice")}
                                    </TableHead>
                                    <TableHead>{t("dashboard.table.colStatus")}</TableHead>
                                    <TableHead className="text-right pr-6">
                                        {t("dashboard.table.colActions")}
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
                                                    {t("dashboard.table.noResults")}
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
                                                            {statusLabel(listing.tokenStatus ?? "")}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-stone-300 font-medium">
                                                            {t("dashboard.badge.notTokenized")}
                                                        </span>
                                                    )}
                                                    {unsettledSet.has(listing.id) && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] font-bold rounded-full bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10"
                                                        >
                                                            {t("dashboard.badge.unsettled")}
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
                                                            {t("dashboard.btn.manage")}
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
                                                            {t("dashboard.btn.tokenize")}
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

            {/* Right slide sheet — listing detail */}
            <ListingSheet
                listing={selectedListing}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                isUnsettled={selectedListing ? unsettledSet.has(selectedListing.id) : false}
            />

            {/* Right slide sheet — Council Token 발급 */}
            <CouncilTokenSheet open={councilSheetOpen} onOpenChange={setCouncilSheetOpen} />
        </div>
    );
}
