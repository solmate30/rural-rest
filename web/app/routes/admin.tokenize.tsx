import { Link, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { listings, rwaTokens, rwaInvestments } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { InitializePropertyButton } from "~/components/rwa/InitializePropertyButton";
import { ReleaseFundsButton } from "~/components/rwa/ReleaseFundsButton";
import type { Route } from "./+types/admin.tokenize";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";

import { TOTAL_SUPPLY, KRW_PER_USDC_FALLBACK } from "~/lib/constants";
import { formatKrwLabel } from "~/lib/formatters";
import { DateTimePicker } from "~/components/ui/datetime-picker";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

export async function loader({ request, params }: Route.LoaderArgs) {
    const user = await requireUser(request, ["spv", "operator", "admin"]);
    const listingId = params.listingId;

    const [listingRow] = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            images: listings.images,
            valuationKrw: listings.valuationKrw,
            pricePerNight: listings.pricePerNight,
            hostId: listings.hostId,
        })
        .from(listings)
        .where(eq(listings.id, listingId));

    if (!listingRow) throw new Response("Not Found", { status: 404 });

    // host는 본인 매물만 접근 가능, admin은 전체 접근
    if ((user as any).role === "spv" && listingRow.hostId !== user.id) {
        throw new Response("Forbidden", { status: 403 });
    }

    const [tokenRow] = await db
        .select({
            id: rwaTokens.id,
            tokenMint: rwaTokens.tokenMint,
            status: rwaTokens.status,
            tokensSold: rwaTokens.tokensSold,
            totalSupply: rwaTokens.totalSupply,
            fundingDeadline: rwaTokens.fundingDeadline,
            minFundingBps: rwaTokens.minFundingBps,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            valuationKrw: rwaTokens.valuationKrw,
        })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, listingId));

    let investorCount = 0;
    if (tokenRow) {
        const [countRow] = await db
            .select({ count: sql<number>`count(distinct ${rwaInvestments.walletAddress})` })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.rwaTokenId, tokenRow.id));
        investorCount = Number(countRow?.count ?? 0);
    }

    const onchain = tokenRow?.tokenMint ? await fetchPropertyOnchain(listingId!) : null;

    const images = listingRow.images as string[];
    return {
        listing: {
            id: listingRow.id,
            title: listingRow.title,
            location: listingRow.location,
            image: images[0] ?? null,
            valuationKrw: listingRow.valuationKrw ?? 0,
            pricePerNight: listingRow.pricePerNight ?? 0,
        },
        token: tokenRow ? {
            id: tokenRow.id,
            tokenMint: tokenRow.tokenMint,
            status: onchain?.status ?? tokenRow.status,
            tokensSold: onchain?.tokensSold ?? tokenRow.tokensSold,
            totalSupply: tokenRow.totalSupply,
            fundingDeadline: tokenRow.fundingDeadline ? new Date(tokenRow.fundingDeadline).toISOString() : null,
            minFundingBps: tokenRow.minFundingBps,
            pricePerTokenUsdc: tokenRow.pricePerTokenUsdc,
            valuationKrw: tokenRow.valuationKrw,
        } : null,
        investorCount,
    };
}

/* ------------------------------------------------------------------ */
/*  Status maps                                                        */
/* ------------------------------------------------------------------ */

const statusBadgeClass: Record<string, string> = {
    funding: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/10",
    funded: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/10",
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10",
    failed: "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/10",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminTokenize() {
    const { t, i18n } = useTranslation("admin");
    const { listing, token, investorCount } = useLoaderData<typeof loader>();
    const valuationKrw = listing.valuationKrw;

    const toDatetimeLocal = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const minDatetime = useMemo(() => toDatetimeLocal(new Date(Date.now() + 10 * 60 * 1000)), []);
    const maxDatetime = useMemo(() => toDatetimeLocal(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)), []);

    const [minFundingPct, setMinFundingPct] = useState(60);
    const [deadlineStr, setDeadlineStr] = useState(() =>
        toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000))
    );

    const tokenPriceKrw = valuationKrw / TOTAL_SUPPLY;
    const tokenPriceUsdc = tokenPriceKrw / KRW_PER_USDC_FALLBACK;
    const targetKrw = valuationKrw * (minFundingPct / 100);

    const previewApyBps = valuationKrw > 0
        ? Math.round((listing.pricePerNight * 365 * 0.55 * 0.55 * 0.30) / valuationKrw * 10000)
        : 0;
    const previewApyPct = previewApyBps / 100;
    const apyLevel: "normal" | "high" | "warn" =
        previewApyBps > 50_000 ? "warn" :
        previewApyBps > 3_000  ? "high" :
        "normal";

    const deadlineTs = useMemo(() => {
        if (!deadlineStr) return 0;
        const date = new Date(deadlineStr);
        return isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
    }, [deadlineStr]);

    const isDeadlineValid = !!deadlineStr && deadlineStr >= minDatetime;

    const quickSet = (hours: number) => {
        setDeadlineStr(toDatetimeLocal(new Date(Date.now() + hours * 60 * 60 * 1000)));
    };

    /* ================================================================ */
    /*  POST-TOKENIZATION: token exists                                 */
    /* ================================================================ */
    if (token?.tokenMint) {
        const soldPct = token.totalSupply > 0
            ? Math.min(100, (token.tokensSold / token.totalSupply) * 100)
            : 0;
        const minPct = token.minFundingBps / 100;
        const deadline = token.fundingDeadline ? new Date(token.fundingDeadline) : null;
        const daysLeft = deadline
            ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;

        return (
            <div className="font-sans">
                <main className="container mx-auto pt-10 pb-16 px-4 sm:px-8 max-w-6xl">
                    {/* Page header */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-16 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                            {listing.image
                                ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-stone-100" />}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-[#4a3b2c]">{listing.title}</h1>
                            <p className="text-sm text-stone-400 mt-0.5">{listing.location}</p>
                        </div>
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-xs font-bold rounded-full px-3 py-1",
                                statusBadgeClass[token.status] ?? "bg-stone-100 text-stone-500 border-stone-200"
                            )}
                        >
                            {t(`tokenize.status.${token.status}` as any) ?? token.status}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Left column: Status + funding progress */}
                        <div className="lg:col-span-3 space-y-6">
                            {/* Token status card */}
                            <Card className="rounded-3xl border-stone-100 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("tokenize.tokenStatus")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Funding progress bar */}
                                    {(token.status === "funding" || token.status === "funded") && (
                                        <div className="mb-5">
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
                                                <span>{t("tokenize.tokenCount", { sold: token.tokensSold.toLocaleString(), total: token.totalSupply.toLocaleString() })}</span>
                                                <span>{t("tokenize.minTarget", { pct: minPct })}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">{t("tokenize.investors")}</p>
                                            <p className="text-xl font-bold text-[#4a3b2c]">
                                                {t("tokenize.investorCount", { count: investorCount })}
                                            </p>
                                        </div>
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">{t("tokenize.valuation")}</p>
                                            <p className="text-base font-bold text-[#4a3b2c]">{formatKrwLabel(token.valuationKrw, i18n.language as "ko" | "en")}</p>
                                        </div>
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">
                                                {token.status === "funding" ? t("tokenize.deadline") : t("tokenize.deadlineDate")}
                                            </p>
                                            {daysLeft !== null && token.status === "funding" ? (
                                                <p className="text-xl font-bold text-[#4a3b2c]">
                                                    {t("tokenize.daysLeft", { days: daysLeft })}
                                                </p>
                                            ) : deadline ? (
                                                <p className="text-base font-bold text-[#4a3b2c]">
                                                    {deadline.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                                </p>
                                            ) : (
                                                <p className="text-base text-stone-300">--</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Release funds (funded only) */}
                            {token.status === "funded" && (
                                <Card className="rounded-3xl border-stone-100 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("tokenize.releaseFunds")}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-stone-400 mb-4">
                                            {t("tokenize.releaseFundsDesc")}
                                        </p>
                                        <ReleaseFundsButton
                                            listingId={listing.id}
                                            rwaTokenId={token.id}
                                            tokenMint={token.tokenMint!}
                                            authorityWallet={null}
                                        />
                                    </CardContent>
                                </Card>
                            )}

                            {/* Active -- settlement shortcut */}
                            {token.status === "active" && (
                                <div className="bg-[#17cf54]/5 border border-[#17cf54]/20 rounded-3xl p-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-[#4a3b2c]">{t("tokenize.activeStatus")}</p>
                                        <p className="text-xs text-stone-500 mt-0.5">{t("tokenize.activeDesc")}</p>
                                    </div>
                                    <Button variant="success" size="sm" asChild>
                                        <Link to={`/admin/settlements/${listing.id}`}>
                                            {t("tokenize.manageSettlement")}
                                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Right column: On-chain info */}
                        <div className="lg:col-span-2">
                            <Card className="rounded-3xl border-stone-100 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("tokenize.onchainInfo")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-stone-400 mb-1.5">Token Mint</p>
                                    <p className="text-xs font-mono text-stone-600 break-all bg-stone-50 border border-stone-100 px-3 py-2.5 rounded-xl mb-3">
                                        {token.tokenMint}
                                    </p>
                                    <a
                                        href={`https://explorer.solana.com/address/${token.tokenMint}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-[#17cf54] hover:underline"
                                    >
                                        {t("tokenize.viewExplorer")}
                                        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                    </a>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    /* ================================================================ */
    /*  PRE-TOKENIZATION: no token yet                                  */
    /* ================================================================ */
    return (
        <div className="font-sans">
            <main className="container mx-auto pt-10 pb-16 px-4 sm:px-8">
                {/* Back link + page header */}
                <div className="mb-8">
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-4"
                    >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        {t("tokenize.breadcrumb")}
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-12 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                            {listing.image
                                ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full bg-stone-100" />}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[#4a3b2c]">{listing.title}</h1>
                            <p className="text-sm text-stone-400 mt-0.5">{listing.location}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column: Settings */}
                    <div className="lg:col-span-2">
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("tokenize.issueSettings")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div>
                                    <p className="text-xs text-stone-400 mb-1">{t("tokenize.valuationLabel")}</p>
                                    <p className="text-2xl font-bold text-[#4a3b2c]">{formatKrwLabel(valuationKrw, i18n.language as "ko" | "en")}</p>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4">
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
                                        <DateTimePicker
                                            value={deadlineStr}
                                            onChange={setDeadlineStr}
                                            min={minDatetime}
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
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right column: Preview + action */}
                    <div className="space-y-6">
                        {/* Auto-calculated preview */}
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("tokenize.preview")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.totalSupply")}</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">1억 개 <span className="text-[11px] font-normal text-stone-400">({t("tokenize.fixed")})</span></p>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.tokenPriceLabel")}</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">
                                        ₩{tokenPriceKrw < 1 ? tokenPriceKrw.toFixed(4) : tokenPriceKrw.toFixed(1)}
                                    </p>
                                    <p className="text-[11px] text-stone-400">${tokenPriceUsdc < 0.0001 ? tokenPriceUsdc.toFixed(8) : tokenPriceUsdc.toFixed(4)} USDC</p>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">{t("tokenize.minFundingTarget", { pct: minFundingPct })}</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(targetKrw, i18n.language as "ko" | "en")}</p>
                                </div>
                                <div className={cn(
                                    "rounded-xl p-3",
                                    apyLevel === "warn" ? "bg-red-50 border border-red-200" :
                                    apyLevel === "high" ? "bg-amber-50 border border-amber-200" :
                                    "bg-stone-50"
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
                                    <p className={cn(
                                        "text-[11px]",
                                        apyLevel === "warn" ? "text-red-400" :
                                        apyLevel === "high" ? "text-amber-400" :
                                        "text-stone-400"
                                    )}>
                                        {apyLevel === "warn" ? t("tokenize.apyWarningCheck") :
                                         apyLevel === "high" ? t("tokenize.apyWarningHigh") :
                                         "projected"}
                                    </p>
                                </div>

                                {apyLevel === "warn" && (
                                    <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
                                        {t("tokenize.apyHint", { pct: previewApyPct.toFixed(0), valuation: valuationKrw.toLocaleString(), price: listing.pricePerNight.toLocaleString() })}
                                    </div>
                                )}
                                {apyLevel === "high" && (
                                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
                                        {t("tokenize.apyHintHigh", { pct: previewApyPct.toFixed(0) })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Issue button */}
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-6">
                                <p className="text-sm text-stone-400 mb-4">
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
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
