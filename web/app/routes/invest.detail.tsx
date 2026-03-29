import { useLoaderData } from "react-router";
import type { Route } from "./+types/invest.detail";
import { Header, Footer } from "~/components/ui-mockup";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, rwaDividends, user, bookings } from "~/db/schema";
import { and, gte } from "drizzle-orm";
import { eq, sql } from "drizzle-orm";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";
import { PropertyMap } from "~/components/PropertyMap";
import { RevenueChart } from "~/components/rwa/RevenueChart";
import { TokenInfoCard } from "~/components/rwa/TokenInfoCard";
import { PurchaseCard } from "~/components/rwa/PurchaseCard";
import { RefundButton } from "~/components/rwa/RefundButton";
import { PropertyGallery } from "~/components/rwa/PropertyGallery";

import { KRW_PER_USDC } from "~/lib/constants";
import { formatKrwLabel } from "~/lib/formatters";


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

export async function loader({ params }: Route.LoaderArgs) {
    const listingId = params.listingId;

    const row = await db
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
        .then(rows => rows[0] ?? null);

    if (!row) throw new Response("Not Found", { status: 404 });

    // On-chain state (authoritative for status + tokensSold)
    const onchain = await fetchPropertyOnchain(listingId!);
    if (onchain) {
        row.status = onchain.status as typeof row.status;
        row.tokensSold = onchain.tokensSold;
    }

    const hostUser = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.hostId))
        .then(rows => rows[0]);

    const holdersRow = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${rwaInvestments.walletAddress})` })
        .from(rwaInvestments)
        .where(eq(rwaInvestments.rwaTokenId, row.tokenId))
        .then(rows => rows[0]);

    // 최근 90일 예약률 계산
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const bookingRows = await db
        .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(and(
            eq(bookings.listingId, row.id),
            gte(bookings.checkIn, ninetyDaysAgo),
            sql`${bookings.status} IN ('confirmed', 'completed')`
        ));

    const bookedNights = bookingRows.reduce((sum, b) => {
        const nights = Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86400000);
        return sum + nights;
    }, 0);
    const occupancyRate = Math.round((bookedNights / 90) * 100);

    // 월별 배당 집계 (실제 지급 내역)
    const dividendHistory = await db
        .select({ month: rwaDividends.month, dividendUsdc: rwaDividends.dividendUsdc })
        .from(rwaDividends)
        .where(eq(rwaDividends.rwaTokenId, row.tokenId));

    const dividendByMonth = new Map<string, number>();
    for (const d of dividendHistory) {
        dividendByMonth.set(d.month, (dividendByMonth.get(d.month) ?? 0) + d.dividendUsdc);
    }
    const dividendHistoryAgg = Array.from(dividendByMonth.entries()).map(([month, totalUsdc]) => ({ month, totalUsdc }));
    const lastDividendMonth = dividendHistoryAgg.length > 0
        ? dividendHistoryAgg.sort((a, b) => b.month.localeCompare(a.month))[0].month
        : null;

    const images = row.images as string[];
    const amenities = row.amenities as string[];
    const usdcPrice = row.pricePerTokenUsdc / 1_000_000;
    const tokenPriceKrw = usdcPrice * KRW_PER_USDC;
    const fundingProgress = row.totalSupply > 0
        ? Math.round((row.tokensSold / row.totalSupply) * 100) : 0;
    const raisedUsdc = row.tokensSold * usdcPrice;
    const remainingUsdc = (row.totalSupply - row.tokensSold) * usdcPrice;

    return {
        id: row.id,
        tokenId: row.tokenId,
        title: row.title,
        location: row.location,
        images,
        apy: row.estimatedApyBps / 100,
        tokenName: `RWA-${row.id.slice(-4).toUpperCase()}`,
        tokenPrice: tokenPriceKrw,
        usdcPrice,
        totalSupply: row.totalSupply,
        availableTokens: row.totalSupply - row.tokensSold,
        valuationKrw: row.valuationKrw,
        valuationUsdc: row.valuationKrw / KRW_PER_USDC,
        holders: holdersRow?.count ?? 0,
        soldTokens: row.tokensSold,
        fundingProgress,
        raised: formatKrwLabel(raisedUsdc * KRW_PER_USDC),
        remaining: formatKrwLabel(remainingUsdc * KRW_PER_USDC),
        raisedUsdc,
        remainingUsdc,
        status: statusToLabel(row.status, fundingProgress),
        rawStatus: row.status,
        about: row.description,
        amenities,
        maxGuests: row.maxGuests,
        tokenMint: row.tokenMint,
        coordinates: (row.lat && row.lng)
            ? { lat: row.lat, lng: row.lng }
            : { lat: 35.8394, lng: 129.2917 },
        renovationHistory: (row.renovationHistory as { date: string; desc: string }[]) ?? [],
        rating: null as number | null,
        reviewCount: 0,
        fundingDeadline: row.fundingDeadline instanceof Date
            ? row.fundingDeadline.getTime()
            : Number(row.fundingDeadline) * 1000,
        minFundingBps: row.minFundingBps,
        dividendChartData: buildDividendChartData(dividendHistoryAgg, row.pricePerTokenUsdc, row.estimatedApyBps),
        lastDividend: lastDividendMonth,
        occupancyRate,
        host: {
            name: hostUser?.name ?? "마을지기",
            bio: null as string | null,
        },
    };
}

export default function InvestDetail() {
    const property = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />

            <main className="container mx-auto py-8 px-4 sm:px-8 max-w-6xl">

                {/* Title & Badges */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        {property.rawStatus === "funding" && (
                            <span className="bg-card text-foreground text-xs font-bold px-3 py-1 rounded-full border border-border">
                                Funding
                            </span>
                        )}
                        {(property.rawStatus === "funded" || property.rawStatus === "active") && (
                            <span className="bg-[#17cf54] text-white text-xs font-bold px-3 py-1 rounded-full">
                                FUNDED
                            </span>
                        )}
                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                            {property.tokenName}
                        </span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                        {property.title}
                    </h1>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="flex items-center gap-1">★ {property.rating}</span>
                        <span className="text-muted-foreground">{property.reviewCount}개 리뷰</span>
                        <span className="text-muted-foreground">· {property.location}</span>
                    </div>
                </div>

                {/* Gallery */}
                <PropertyGallery images={property.images} title={property.title} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* Token Info */}
                        <section className="pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground mb-6">Token Information</h2>
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
                            <h2 className="text-2xl font-bold text-foreground">About This Home</h2>
                            <p className="text-muted-foreground leading-relaxed text-lg">{property.about}</p>
                        </section>

                        {/* Renovation History */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">리모델링 이력</h2>
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
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Max Guests</p>
                                    <p className="text-xl font-bold text-[#4a3b2c]">{property.maxGuests}<span className="text-sm font-normal text-stone-400 ml-1">명</span></p>
                                </div>
                                <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                                    <span className="material-symbols-outlined text-stone-400 text-[20px]">bar_chart</span>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Occupancy (90d)</p>
                                    <p className="text-xl font-bold text-[#4a3b2c]">{property.occupancyRate}<span className="text-sm font-normal text-stone-400 ml-0.5">%</span></p>
                                </div>
                            </div>
                        </section>

                        {/* Amenities */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">Amenities</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {property.amenities.map((amenity) => (
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
                            <h2 className="text-2xl font-bold text-foreground">호스트 정보</h2>
                            <div className="flex gap-6 items-start">
                                <div className="h-16 w-16 rounded-full bg-stone-200 shrink-0 overflow-hidden border-2 border-white shadow-md">
                                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=e2e8f0" alt="Host Profile" className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-xl font-bold text-stone-900">{property.host.name}</h3>
                                    <p className="text-stone-700 leading-relaxed text-sm">{property.host.bio}</p>
                                    <div className="flex gap-4 pt-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                                            <span className="material-symbols-outlined text-[16px]">star</span>
                                            {property.rating} 후기 평점
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
                                            <span className="material-symbols-outlined text-[16px]">verified_user</span>
                                            신원 인증 완료
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Revenue Chart */}
                        <section className="space-y-4 pt-8 border-t">
                            <div className="flex items-baseline justify-between">
                                <h2 className="text-2xl font-bold text-foreground">
                                    {property.rawStatus === "active" ? "Revenue Distribution" : "Est. Revenue"}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {property.rawStatus === "active"
                                        ? "Last 12 months · per 1,000 tokens"
                                        : "Projected · per 1,000 tokens"}
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
                            <h2 className="text-2xl font-bold text-foreground">Location & Map</h2>
                            <p className="text-sm text-muted-foreground">{property.location}</p>
                            <PropertyMap
                                lat={property.coordinates.lat}
                                lng={property.coordinates.lng}
                                locationLabel={property.title}
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
                                            모집 종료
                                        </span>
                                    </div>
                                    <p className="text-sm text-stone-500">
                                        모집 목표를 달성하지 못했습니다. 투자하신 금액을 환불받으실 수 있습니다.
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
