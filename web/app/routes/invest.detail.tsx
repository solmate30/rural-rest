import { useLoaderData } from "react-router";
import type { Route } from "./+types/invest.detail";
import { Header, Footer } from "~/components/ui-mockup";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, user } from "~/db/schema";
import { eq, sql } from "drizzle-orm";
import { PropertyMap } from "~/components/PropertyMap";
import { RevenueChart } from "~/components/rwa/RevenueChart";
import { TokenInfoCard } from "~/components/rwa/TokenInfoCard";
import { PurchaseCard } from "~/components/rwa/PurchaseCard";
import { PropertyGallery } from "~/components/rwa/PropertyGallery";

// TODO: Pyth oracle로 교체
const KRW_PER_USDC = 1350;

const TEMP_HOST_BIOS: Record<string, string> = {
    "seed-spv-3000-hwango":    "황오동 골목을 직접 관리·운영하고 있습니다. 비어있던 이 공간에 다시 온기를 불어넣어, 방문하는 분들께 경주 구도심의 진짜 일상을 전하고 싶어요.",
    "seed-spv-3001-seonggon":  "성건동 마을 주민들이 함께 관리하는 공간입니다. 첨성대 가까운 골목에서 한옥의 따뜻함을 나눠요.",
    "seed-spv-3002-dongcheon": "동천동 주민들이 직접 운영하는 쉼터입니다. 느린 여행을 원하는 분들께 경주의 또 다른 얼굴을 보여드려요.",
    "seed-spv-3003-geoncheon": "건천읍 마을 주민들이 함께 꾸리고 있는 농가주택입니다. 들녘 가까운 조용한 시골 일상을 나눠요.",
    "seed-spv-3004-angang":    "안강읍 마을에서 직접 관리·운영하고 있습니다. 제철 농산물로 차린 시골 밥상과 함께 느린 하루를 선물해드려요.",
};

function formatKrw(won: number): string {
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억 원`;
    }
    if (won >= 1_0000) return `${Math.round(won / 1_0000)}만 원`;
    return `${won.toLocaleString()}원`;
}

function statusToKorean(status: string): string {
    switch (status) {
        case "funding": return "모집 중";
        case "funded":  return "모집 완료";
        case "active":  return "운영 중";
        case "failed":  return "모집 실패";
        default:        return status;
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

    const hostUser = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.hostId))
        .then(rows => rows[0]);

    const holdersRow = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${rwaInvestments.userId})` })
        .from(rwaInvestments)
        .where(eq(rwaInvestments.rwaTokenId, row.tokenId))
        .then(rows => rows[0]);

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
        raised: formatKrw(raisedUsdc * KRW_PER_USDC),
        remaining: formatKrw(remainingUsdc * KRW_PER_USDC),
        raisedUsdc,
        remainingUsdc,
        status: statusToKorean(row.status),
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
        lastDividend: null as string | null,
        occupancyRate: null as number | null,
        host: {
            name: hostUser?.name ?? "마을지기",
            bio: TEMP_HOST_BIOS[row.hostId] ?? null,
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
                        <span className="bg-[#17cf54]/10 text-[#17cf54] text-xs font-bold px-3 py-1 rounded-full border border-[#17cf54]/20">
                            {property.status}
                        </span>
                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                            {property.tokenName}
                        </span>
                        <span className="text-sm text-muted-foreground">{property.location}</span>
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

                            {/* Room Spec */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-2 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm">
                                    <span className="material-symbols-outlined text-primary text-[24px]">group</span>
                                    <p className="text-xs text-muted-foreground">최대 인원</p>
                                    <p className="font-semibold text-sm">{property.maxGuests}명</p>
                                </div>
                            </div>

                            {/* Occupancy */}
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-stone-50 border border-stone-100 shadow-sm">
                                <div className="p-3 rounded-xl bg-[#17cf54]/10">
                                    <span className="material-symbols-outlined text-[28px] text-[#17cf54]">bar_chart</span>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">월 평균 예약률</p>
                                    <p className="text-3xl font-bold text-foreground">{property.occupancyRate}%</p>
                                </div>
                            </div>
                        </section>

                        {/* Amenities */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">숙소 편의시설</h2>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                {[
                                    { icon: "wifi",          label: "무선 인터넷 (WiFi)" },
                                    { icon: "kitchen",       label: "주방 및 조리도구" },
                                    { icon: "ac_unit",       label: "시스템 에어컨" },
                                    { icon: "local_parking", label: "무료 주차공간" },
                                    { icon: "tv",            label: "스마트 TV (넷플릭스)" },
                                    { icon: "coffee_maker",  label: "네스프레소 커피머신" },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-3 text-stone-700">
                                        <span className="material-symbols-outlined text-stone-400 text-[22px]">{item.icon}</span>
                                        <span className="text-sm font-medium">{item.label}</span>
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
                                <h2 className="text-2xl font-bold text-foreground">수익 분배 이력</h2>
                                <span className="text-xs text-muted-foreground">최근 12개월 · token당</span>
                            </div>
                            <RevenueChart lastDividend={property.lastDividend ?? "없음"} apy={property.apy} />
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
                        <div className="lg:sticky lg:top-24 space-y-4">
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
                                lastDividend={property.lastDividend}
                            />
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
                            />
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
