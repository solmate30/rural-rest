import { useLoaderData } from "react-router";
import type { Route } from "./+types/invest.detail";
import { Header, Footer } from "~/components/ui-mockup";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, rwaDividends, user, bookings } from "~/db/schema";
import { and, gte } from "drizzle-orm";
import { eq, sql } from "drizzle-orm";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";
import { throttledSync } from "~/lib/rwa.server";
import { PropertyMap } from "~/components/PropertyMap";
import { RevenueChart } from "~/components/rwa/RevenueChart";
import { TokenInfoCard } from "~/components/rwa/TokenInfoCard";
import { PurchaseCard } from "~/components/rwa/PurchaseCard";
import { RefundButton } from "~/components/rwa/RefundButton";
import { PropertyGallery } from "~/components/rwa/PropertyGallery";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { KRW_PER_USDC_FALLBACK } from "~/lib/constants";
import { fetchPythKrwRate } from "~/lib/pyth";
import { formatKrwLabel } from "~/lib/formatters";
import { detectLocale } from "~/lib/i18n.server";
import { applyListingLocale, translateAmenities } from "~/data/listing-translations";

function ShareBlinksButton({ listingId }: { listingId: string }) {
    const [copied, setCopied] = useState(false);

    function handleShare() {
        const actionUrl = `${window.location.origin}/api/actions/invest/${listingId}`;
        const blinksUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
        navigator.clipboard.writeText(blinksUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-colors shrink-0"
        >
            <span className="material-symbols-outlined text-[16px]">
                {copied ? "check_circle" : "share"}
            </span>
            {copied ? "복사됨!" : "공유"}
        </button>
    );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildDividendChartData(
    actual: { month: string; totalUsdc: number }[],
    pricePerTokenUsdc: number, // micro-USDC
    apyBps: number,
) {
    // 실제 배당 내역이 있으면 사용
    if (actual.length > 0) {
        const byMonth = new Map(actual.map(r => [r.month.slice(5), r.totalUsdc / 1_000_000]));
        let cumulative = 0;
        return MONTH_LABELS.map((label, i) => {
            const mm = String(i + 1).padStart(2, "0");
            const dividend = byMonth.get(mm) ?? 0;
            cumulative += dividend;
            return { month: label, dividend, cumulative };
        });
    }

    // 실제 데이터 없으면 APY 기반 예상치 (1,000토큰 기준)
    const annualPerToken = (pricePerTokenUsdc / 1_000_000) * (apyBps / 10000);
    const monthlyPer1000 = (annualPerToken * 1000) / 12;
    // 계절성 가중치 (봄·가을 성수기)
    const weights = [0.7, 0.7, 1.0, 1.2, 1.0, 0.8, 0.8, 0.9, 1.2, 1.1, 0.9, 0.7];
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let cumulative = 0;
    return MONTH_LABELS.map((label, i) => {
        const dividend = Math.round(monthlyPer1000 * (weights[i] / weightSum) * 12 * 10) / 10;
        cumulative = Math.round((cumulative + dividend) * 10) / 10;
        return { month: label, dividend, cumulative };
    });
}

function statusToLabel(status: string, fundingProgress: number): string {
    switch (status) {
        case "funding": return "Funding";
        case "funded": return fundingProgress >= 100 ? "Sold Out" : "Funded";
        case "active": return "Active";
        case "failed": return "Closed";
        default: return status;
    }
}

export async function loader({ params, request }: Route.LoaderArgs) {
    const listingId = params.listingId;
    const locale = await detectLocale(request);

    await throttledSync().catch(() => {});

    // DB 메인 쿼리 + Pyth 환율 병렬 실행
    const [row, krwPerUsdc] = await Promise.all([
        db
            .select({
                id: listings.id,
                title: listings.title,
                description: listings.description,
                location: listings.location,
                images: listings.images,
                maxGuests: listings.maxGuests,
                amenities: listings.amenities,
                hostId: listings.hostId,
                lat: listings.lat,
                lng: listings.lng,
                renovationHistory: listings.renovationHistory,
                tokenId: rwaTokens.id,
                tokenMint: rwaTokens.tokenMint,
                totalSupply: rwaTokens.totalSupply,
                tokensSold: rwaTokens.tokensSold,
                valuationKrw: rwaTokens.valuationKrw,
                pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
                estimatedApyBps: rwaTokens.estimatedApyBps,
                status: rwaTokens.status,
                fundingDeadline: rwaTokens.fundingDeadline,
                minFundingBps: rwaTokens.minFundingBps,
            })
            .from(listings)
            .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
            .where(eq(listings.id, listingId!))
            .then(rows => rows[0] ?? null),
        fetchPythKrwRate(),
    ]);

    if (!row) throw new Response("Not Found", { status: 404 });

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);

    // 온체인 조회 + 나머지 DB 쿼리 병렬 실행 (온체인은 3초 타임아웃)
    const [onchain, holdersRow, bookingRows, dividendHistory] = await Promise.all([
        Promise.race([
            fetchPropertyOnchain(listingId!),
            new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
        ]),
        db
            .select({ count: sql<number>`COUNT(DISTINCT ${rwaInvestments.walletAddress})` })
            .from(rwaInvestments)
            .where(eq(rwaInvestments.rwaTokenId, row.tokenId))
            .then(rows => rows[0]),
        db
            .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
            .from(bookings)
            .where(and(
                eq(bookings.listingId, row.id),
                gte(bookings.checkIn, ninetyDaysAgo),
                sql`${bookings.status} IN ('confirmed', 'completed')`
            )),
        db
            .select({ month: rwaDividends.month, dividendUsdc: rwaDividends.dividendUsdc })
            .from(rwaDividends)
            .where(eq(rwaDividends.rwaTokenId, row.tokenId)),
    ]);

    if (onchain) {
        row.status = onchain.status as typeof row.status;
        row.tokensSold = onchain.tokensSold;
    }

    // deadline 지난 + 목표 달성이면 on-chain releaseFunds 전이라도 "funded"로 표시
    // (on-chain status는 releaseFunds 호출 전까지 "funding"으로 유지됨)
    if (row.status === "funding" && row.fundingDeadline) {
        const deadlineTs = row.fundingDeadline instanceof Date
            ? row.fundingDeadline.getTime()
            : Number(row.fundingDeadline) * 1000;
        if (Date.now() > deadlineTs) {
            const soldCount = onchain ? onchain.tokensSold : row.tokensSold;
            const minRequired = Math.floor((row.totalSupply * row.minFundingBps) / 10000);
            if (soldCount >= minRequired) {
                row.status = "funded" as typeof row.status;
            }
        }
    }

    const bookedNights = bookingRows.reduce((sum, b) => {
        const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86400000);
        return sum + nights;
    }, 0);
    const occupancyRate = Math.round((bookedNights / 90) * 100);

    const dividendByMonth = new Map<string, number>();
    for (const d of dividendHistory) {
        dividendByMonth.set(d.month, (dividendByMonth.get(d.month) ?? 0) + d.dividendUsdc);
    }
    const dividendHistoryAgg = Array.from(dividendByMonth.entries()).map(([month, totalUsdc]) => ({ month, totalUsdc }));
    const lastDividendMonth = dividendHistoryAgg.length > 0
        ? dividendHistoryAgg.sort((a, b) => b.month.localeCompare(a.month))[0].month
        : null;

    // 실제 배당 이력 기반 APY 추정 (최근 12개월 합산 / valuation)
    // 배당 이력 없으면 DB의 estimated_apy_bps 사용
    let estimatedApyBps = row.estimatedApyBps;
    if (dividendHistoryAgg.length > 0) {
        const valuationUsdc = row.valuationKrw / krwPerUsdc;
        const recentMonths = dividendHistoryAgg
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 12);
        const annualDividendUsdc = recentMonths.length < 12
            ? (recentMonths.reduce((s, d) => s + d.totalUsdc, 0) / recentMonths.length) * 12
            : recentMonths.reduce((s, d) => s + d.totalUsdc, 0);
        estimatedApyBps = Math.round((annualDividendUsdc / valuationUsdc) * 10000);
    }

    const rawImages = row.images;
    const images = typeof rawImages === "string"
        ? (JSON.parse(rawImages) as string[])
        : rawImages as string[];
    const rawAmenities = row.amenities as string[];

    const localizedKo = applyListingLocale(
        { id: row.id, title: row.title, description: row.description ?? "" },
        "ko",
    );
    const localizedEn = applyListingLocale(
        { id: row.id, title: row.title, description: row.description ?? "" },
        "en",
    );

    const usdcPrice = row.pricePerTokenUsdc / 1_000_000;
    const tokenPriceKrw = usdcPrice * krwPerUsdc;
    const fundingProgress = row.totalSupply > 0
        ? Math.min(100, Math.round((row.tokensSold / row.totalSupply) * 100)) : 0;
    const raisedKrw = Math.round(row.valuationKrw * fundingProgress / 100);
    const remainingKrw = row.valuationKrw - raisedKrw;
    const villageName = row.location.split(" ").at(-1);

    return {
        id: row.id,
        tokenId: row.tokenId,
        title: row.title,
        location: row.location,
        images,
        apy: estimatedApyBps / 100,
        tokenName: `RWA-${row.id.slice(-4).toUpperCase()}`,
        tokenPrice: tokenPriceKrw,
        usdcPrice,
        totalSupply: row.totalSupply,
        availableTokens: row.totalSupply - row.tokensSold,
        valuationKrw: row.valuationKrw,
        valuationUsdc: row.valuationKrw / krwPerUsdc,
        holders: holdersRow?.count ?? 0,
        soldTokens: row.tokensSold,
        fundingProgress,
        raised: formatKrwLabel(raisedKrw),
        remaining: formatKrwLabel(remainingKrw),
        raisedUsdc: raisedKrw / krwPerUsdc,
        remainingUsdc: remainingKrw / krwPerUsdc,
        status: statusToLabel(row.status, fundingProgress),
        rawStatus: row.status,
        i18n: {
            ko: {
                title: localizedKo.title,
                about: localizedKo.description,
                amenities: translateAmenities(rawAmenities, "ko"),
                host: {
                    name: `${villageName} 마을지기`,
                    bio: "우리 마을의 빈집을 되살려 여행자에게 특별한 경험을 제공하고 있습니다. 마을 주민들과 함께 숙소를 운영하며, 지역 문화와 자연을 나누는 일을 하고 있습니다.",
                },
            },
            en: {
                title: localizedEn.title,
                about: localizedEn.description,
                amenities: translateAmenities(rawAmenities, "en"),
                host: {
                    name: `${villageName} Village Host`,
                    bio: "We breathe new life into empty rural homes, giving travelers an authentic local experience. We manage the property together with village residents, sharing the culture and nature of our community.",
                },
            },
        },
        maxGuests: row.maxGuests,
        tokenMint: row.tokenMint,
        coordinates: (row.lat && row.lng)
            ? { lat: row.lat, lng: row.lng }
            : { lat: 35.8394, lng: 129.2917 },
        renovationHistory: (() => {
            const rh = row.renovationHistory;
            if (Array.isArray(rh)) return rh as { date: string; desc: string }[];
            if (typeof rh === "string") {
                try { return JSON.parse(rh) as { date: string; desc: string }[]; } catch { return []; }
            }
            return [];
        })(),
        rating: null as number | null,
        reviewCount: 0,
        fundingDeadline: row.fundingDeadline instanceof Date
            ? row.fundingDeadline.getTime()
            : Number(row.fundingDeadline) * 1000,
        minFundingBps: row.minFundingBps,
        dividendChartData: buildDividendChartData(dividendHistoryAgg, row.pricePerTokenUsdc, row.estimatedApyBps),
        lastDividend: lastDividendMonth,
        occupancyRate,
    };
}

export default function InvestDetail() {
    const property = useLoaderData<typeof loader>();
    const { t, i18n } = useTranslation("invest");
    const lang = (i18n.language === "en" ? "en" : "ko") as "en" | "ko";
    const loc = property.i18n[lang];

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />

            <main className="container mx-auto py-8 px-4 sm:px-8 max-w-6xl">

                {/* Title & Badges */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            {property.rawStatus === "funding" && (
                                <span className="bg-card text-foreground text-xs font-bold px-3 py-1 rounded-full border border-border">
                                    {t("status.funding")}
                                </span>
                            )}
                            {(property.rawStatus === "funded" || property.rawStatus === "active") && (
                                <span className="bg-[#17cf54] text-white text-xs font-bold px-3 py-1 rounded-full">
                                    {t("status.funded")}
                                </span>
                            )}
                            <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                {property.tokenName}
                            </span>
                        </div>
                        <ShareBlinksButton listingId={property.id} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                        {loc.title}
                    </h1>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="flex items-center gap-1">★ {property.rating}</span>
                        <span className="text-muted-foreground">{t("detail.reviews", { count: property.reviewCount })}</span>
                        <span className="text-muted-foreground">· {property.location}</span>
                    </div>
                </div>

                {/* Gallery */}
                <PropertyGallery images={property.images} title={loc.title} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* Token Info */}
                        <section className="pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground mb-6">{t("detail.tokenInfo")}</h2>
                            <TokenInfoCard
                                tokenName={property.tokenName}
                                totalSupply={property.totalSupply}
                                tokenPrice={property.tokenPrice}
                                usdcPrice={property.usdcPrice}
                                valuationKrw={property.valuationKrw}
                                valuationUsdc={property.valuationUsdc}
                                holders={property.holders}
                                soldTokens={property.soldTokens}
                                fundingProgress={property.fundingProgress}
                                apy={property.apy}
                            />
                        </section>

                        {/* About */}
                        <section className="space-y-4 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("detail.aboutHome")}</h2>
                            <p className="text-muted-foreground leading-relaxed text-lg">{loc.about}</p>
                        </section>

                        {/* Renovation History */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("detail.renovation")}</h2>
                            <div className="space-y-4">
                                {property.renovationHistory.map((item, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className="h-3 w-3 rounded-full bg-[#17cf54] mt-0.5 shrink-0" />
                                            {i < property.renovationHistory.length - 1 && (
                                                <div className="w-px h-8 bg-border mt-1" />
                                            )}
                                        </div>
                                        <div className="-mt-0.5">
                                            <span className="text-xs font-bold text-[#17cf54]">{item.date}</span>
                                            <p className="text-sm text-foreground mt-0.5">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Property Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                                    <span className="material-symbols-outlined text-stone-400 text-[20px]">group</span>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">{t("detail.maxGuests")}</p>
                                    <p className="text-xl font-bold text-[#4a3b2c]">{t("detail.guestsCount", { count: property.maxGuests })}</p>
                                </div>
                                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                                    <span className="material-symbols-outlined text-stone-400 text-[20px]">bar_chart</span>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">{t("detail.occupancy")}</p>
                                    <p className="text-xl font-bold text-[#4a3b2c]">{property.occupancyRate}<span className="text-sm font-normal text-stone-400 ml-0.5">%</span></p>
                                </div>
                            </div>
                        </section>

                        {/* Amenities */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("detail.amenities")}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {loc.amenities.map((amenity) => (
                                    <div
                                        key={amenity}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm text-sm font-semibold text-stone-700"
                                    >
                                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                        {amenity}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Host Info */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("detail.operator")}</h2>
                            <div className="flex gap-6 items-start">
                                <div className="h-16 w-16 rounded-full bg-stone-200 shrink-0 overflow-hidden border-2 border-white shadow-md">
                                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e2e8f0" alt="Host Profile" className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-xl font-bold text-stone-900">{loc.host.name}</h3>
                                    <p className="text-stone-700 leading-relaxed text-sm">{loc.host.bio}</p>
                                    <div className="flex gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                                            <span className="material-symbols-outlined text-[16px]">star</span>
                                            {property.rating} {t("detail.rating")}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                                            <span className="material-symbols-outlined text-[16px]">verified_user</span>
                                            {t("detail.verified")}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Revenue Chart */}
                        <section className="space-y-4 pt-8 border-t">
                            <div className="flex items-baseline justify-between">
                                <h2 className="text-2xl font-bold text-foreground">
                                    {property.rawStatus === "active" ? t("detail.revenueActive") : t("detail.revenueEst")}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {property.rawStatus === "active"
                                        ? t("detail.revenueNote")
                                        : t("detail.revenueNoteEst")}
                                </span>
                            </div>
                            <RevenueChart
                                apy={property.apy}
                                chartData={property.dividendChartData}
                                isActual={property.dividendChartData.some(d => d.dividend > 0)}
                            />
                        </section>

                        {/* Map */}
                        <section className="space-y-4 pt-8 border-t pb-12">
                            <h2 className="text-2xl font-bold text-foreground">{t("detail.location")}</h2>
                            <p className="text-sm text-muted-foreground">{property.location}</p>
                            <PropertyMap
                                lat={property.coordinates.lat}
                                lng={property.coordinates.lng}
                                locationLabel={loc.title}
                                height={280}
                                className="shadow-md"
                            />
                        </section>
                    </div>

                    {/* ── Right Column ── */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="lg:sticky lg:top-24">
                            {(() => {
                                const deadlineExpired = Date.now() > property.fundingDeadline;
                                const goalNotMet = property.fundingProgress < (property.minFundingBps / 100);
                                const isRefundable = property.rawStatus === "failed" ||
                                    (property.rawStatus === "funding" && deadlineExpired && goalNotMet);
                                return isRefundable;
                            })() ? (
                                <div className="rounded-3xl bg-white border border-red-100 shadow-sm p-6 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200">
                                            {t("detail.fundingClosed")}
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-500">
                                        {t("detail.refundNotice")}
                                    </p>
                                    <RefundButton
                                        listingId={property.id}
                                        rwaTokenId={property.tokenId}
                                    />
                                </div>
                            ) : (
                                <PurchaseCard
                                    listingId={property.id}
                                    tokenMint={property.tokenMint}
                                    tokenId={property.tokenId}
                                    tokenName={property.tokenName}
                                    tokenPrice={property.tokenPrice}
                                    usdcPrice={property.usdcPrice}
                                    apy={property.apy}
                                    fundingProgress={property.fundingProgress}
                                    availableTokens={property.availableTokens}
                                    totalSupply={property.totalSupply}
                                    holders={property.holders}
                                    soldTokens={property.soldTokens}
                                    fundingDeadlineMs={property.fundingDeadline}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
