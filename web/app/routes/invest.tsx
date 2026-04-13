import { Header, Footer, Card } from "~/components/ui-mockup";
import { useNavigate, useLoaderData } from "react-router";
import { useState } from "react";
import { usePrivyPublicKey } from "~/lib/privy-wallet";
import { useKyc } from "~/components/KycProvider";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { eq } from "drizzle-orm";
import { throttledSync } from "~/lib/rwa.server";
import { fetchPropertiesOnchain } from "~/lib/rwa.onchain.server";
import { useTranslation } from "react-i18next";

import { fetchPythKrwRate } from "~/lib/pyth";
import { formatKrwLabel, fmtKrw, fmtUsdc, cdnImg } from "~/lib/formatters";

function statusToEnglish(status: string): string {
    switch (status) {
        case "funding": return "Funding";
        case "funded":  return "Funded";
        case "active":  return "Active";
        case "failed":  return "Closed";
        default:        return status;
    }
}

export function meta() {
    return [
        { title: "RWA 투자 | Rural Rest" },
        { name: "description", content: "한국 농촌 부동산 토큰(RWA)에 투자하세요. 소액으로 시골 빈집 리모델링 프로젝트에 참여하고 임대 수익을 배당받으세요." },
        { property: "og:title", content: "RWA 투자 | Rural Rest" },
        { property: "og:description", content: "소액으로 시작하는 한국 농촌 부동산 토큰 투자." },
        { property: "og:image", content: "https://rural-rest.vercel.app/hero.png" },
    ];
}

export async function loader() {
    await throttledSync();
    const krwPerUsdc = await fetchPythKrwRate();

    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            region: listings.region,
            images: listings.images,
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
        .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id));

    // Fetch on-chain state (overrides DB status + tokensSold)
    const initializedIds = rows.filter(r => r.tokenMint).map(r => r.id);
    const onchainMap = await fetchPropertiesOnchain(initializedIds);
    const now = Date.now();
    for (const row of rows) {
        const onchain = onchainMap.get(row.id);
        if (onchain) {
            row.status = onchain.status as typeof row.status;
            row.tokensSold = onchain.tokensSold;
        }
        // 데드라인 경과 보정 (온체인 미반영 대비 방어 로직)
        if (row.status === "funding" && row.fundingDeadline) {
            const deadlineMs = new Date(row.fundingDeadline).getTime();
            if (now > deadlineMs) {
                const totalSupply = row.totalSupply ?? 0;
                const tokensSold = row.tokensSold ?? 0;
                const progressBps = totalSupply > 0 ? (tokensSold / totalSupply) * 10000 : 0;
                if (progressBps < (row.minFundingBps ?? 6000)) {
                    row.status = "failed";  // 목표 미달
                } else {
                    row.status = "funded";  // 목표 달성 → release_funds 전이라도 funded 표시
                }
            }
        }
    }

    return rows.filter(r => r.tokenMint).map((row) => {
        const images = row.images as string[];

        const usdcPrice = row.pricePerTokenUsdc! / 1_000_000;
        const tokenPriceKrw = usdcPrice * krwPerUsdc;
        const totalSupply = row.totalSupply!;
        const tokensSold = row.tokensSold!;
        // cap at 100: on-chain tokensSold can exceed totalSupply due to test data
        const fundingProgress = totalSupply > 0
            ? Math.min(100, Math.round((tokensSold / totalSupply) * 100))
            : 0;
        // raised/remaining derived from valuation × progress ratio
        // (avoids unit mismatch when totalSupply × pricePerToken ≠ valuationKrw)
        const raisedKrw = Math.round(row.valuationKrw! * fundingProgress / 100);
        const remainingKrw = row.valuationKrw! - raisedKrw;
        return {
            id: row.id,
            title: row.title,
            location: row.location,
            region: row.region,
            image: cdnImg(images[0] ?? "/house.png", 600),
            apy: row.estimatedApyBps! / 100,
            tokenPrice: tokenPriceKrw,
            usdcPrice,
            valuationKrw: row.valuationKrw!,
            valuationUsdc: row.valuationKrw! / krwPerUsdc,
            fundingProgress,
            tokensSold,
            totalSupply,
            raised: formatKrwLabel(raisedKrw),
            remaining: formatKrwLabel(remainingKrw),
            raisedUsdc: raisedKrw / krwPerUsdc,
            remainingUsdc: remainingKrw / krwPerUsdc,
            status: statusToEnglish(row.status!),
            themes: [] as string[],
        };
    });
}

export default function InvestDashboard() {
    const allProperties = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const walletAddress = usePrivyPublicKey();
    const [showFilter, setShowFilter] = useState(false);
    const { t, i18n } = useTranslation("invest");

    // Filter States
    const [selectedRegion, setSelectedRegion] = useState("All");
    const [selectedSort, setSelectedSort] = useState("Yield");
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [minApy, setMinApy] = useState(0);
    const [maxPrice, setMaxPrice] = useState(100000);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

    const { isKycCompleted, isKycLoading } = useKyc();

    // Filter Logic
    let filteredProperties = allProperties.filter(p => {
        if (selectedRegion !== "All" && p.region !== selectedRegion) return false;
        if (selectedStatus !== "All" && p.status !== selectedStatus) return false;
        if (p.apy < minApy) return false;
        if (p.tokenPrice > maxPrice) return false;
        if (selectedThemes.length > 0 && !selectedThemes.some(t => p.themes.includes(t))) return false;
        return true;
    });

    // Sort Logic
    if (selectedSort === "Yield") {
        filteredProperties.sort((a, b) => b.apy - a.apy);
    } else if (selectedSort === "Price") {
        filteredProperties.sort((a, b) => a.tokenPrice - b.tokenPrice);
    } else if (selectedSort === "Latest") {
        filteredProperties.sort((a, b) => a.fundingProgress - b.fundingProgress);
    }

    const toggleTheme = (theme: string) => {
        setSelectedThemes(prev =>
            prev.includes(theme)
                ? prev.filter(t => t !== theme)
                : [...prev, theme]
        );
    };

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
            <Header />

            <main className="flex-1">
                <div className="container mx-auto py-16 px-4 sm:px-8">
                    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                        <div className="max-w-2xl">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-3">
                                Invest in Rural Korea
                            </h1>
                            <p className="text-lg text-muted-foreground">
                                {t("tagline")}<br />

                            </p>
                        </div>
                        <div className="flex w-full md:w-auto items-center overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                            <div className="flex gap-2 items-center flex-nowrap w-max">
                                <button
                                    onClick={() => setShowFilter(!showFilter)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm hover:bg-background shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[18px]">tune</span>
                                    {t("filter.button")}
                                </button>
                                <div className="h-9 w-[1px] bg-border mx-1 shrink-0 hidden sm:block"></div>
                                {[
                                    { value: "All", label: t("region.all") },
                                    { value: "경기", label: t("region.경기") },
                                    { value: "강원", label: t("region.강원") },
                                    { value: "충청", label: t("region.충청") },
                                    { value: "전라", label: t("region.전라") },
                                    { value: "경상", label: t("region.경상") },
                                    { value: "제주", label: t("region.제주") },
                                ].map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setSelectedRegion(value)}
                                        className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm shrink-0 transition-colors ${selectedRegion === value
                                            ? "bg-foreground text-background"
                                            : "bg-card text-foreground/70 hover:text-foreground hover:bg-background"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Filter Modal */}
                    {showFilter && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                            <Card className="w-full max-w-md p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                                <div className="flex items-center justify-between sticky top-0 bg-card py-2 z-10">
                                    <h2 className="text-xl font-bold">{t("filter.title")}</h2>
                                    <button onClick={() => setShowFilter(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">{t("filter.sortBy")}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: "Yield", label: t("filter.sort.yield") },
                                                { value: "Latest", label: t("filter.sort.latest") },
                                                { value: "Price", label: t("filter.sort.price") },
                                            ].map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setSelectedSort(value)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedSort === value
                                                        ? "bg-invest text-invest-foreground shadow-md shadow-invest/20"
                                                        : "bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground border border-border/50"
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">{t("filter.status")}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: "All", label: t("filter.statusAll") },
                                                { value: "Funding", label: t("filter.statusFunding") },
                                                { value: "Funded", label: t("filter.statusFunded") },
                                                { value: "Active", label: t("filter.statusActive") },
                                                { value: "Closed", label: t("filter.statusClosed") },
                                            ].map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setSelectedStatus(value)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedStatus === value
                                                        ? "bg-invest text-invest-foreground shadow-md shadow-invest/20"
                                                        : "bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground border border-border/50"
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 flex justify-between text-foreground">
                                            <span>{t("filter.minApy")}</span>
                                            <span className="text-invest">{minApy}%+</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0" max="15" step="0.5"
                                            value={minApy}
                                            onChange={(e) => setMinApy(Number(e.target.value))}
                                            className="w-full accent-invest"
                                        />
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 flex justify-between text-foreground">
                                            <span>{t("filter.maxPrice")}</span>
                                            <span className="text-invest">₩{maxPrice.toLocaleString()}</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="10000" max="200000" step="10000"
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(Number(e.target.value))}
                                            className="w-full accent-invest"
                                        />
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 block text-foreground">{t("filter.theme")}</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["한옥", "오션뷰", "숲속 오두막", "돌담"].map((theme) => (
                                                <button
                                                    key={theme}
                                                    onClick={() => toggleTheme(theme)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${selectedThemes.includes(theme)
                                                        ? "bg-invest/10 border-invest/30 text-invest"
                                                        : "bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                                                        }`}
                                                >
                                                    {selectedThemes.includes(theme) && (
                                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                                    )}
                                                    {theme}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-6 pb-2 sticky bottom-0 bg-card border-t border-border mt-4">
                                    <button
                                        className="px-4 py-3 rounded-xl border border-border text-foreground/70 font-semibold hover:bg-secondary hover:text-foreground transition-colors shrink-0"
                                        onClick={() => {
                                            setSelectedRegion("All");
                                            setSelectedSort("Yield");
                                            setSelectedStatus("All");
                                            setMinApy(0);
                                            setMaxPrice(100000);
                                            setSelectedThemes([]);
                                        }}
                                    >
                                        {t("filter.reset")}
                                    </button>
                                    <button
                                        className="flex-1 px-4 py-3 rounded-xl bg-invest hover:bg-invest-hover text-invest-foreground font-bold transition-transform active:scale-[0.98] shadow-lg shadow-invest/20"
                                        onClick={() => setShowFilter(false)}
                                    >
                                        {t("filter.apply", { count: filteredProperties.length })}
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="w-full">
                        {filteredProperties.length === 0 ? (
                            <div className="py-24 text-center">
                                <span className="material-symbols-outlined text-[56px] text-stone-300">real_estate_agent</span>
                                <p className="text-lg font-bold text-stone-700 mt-4">{t("empty.title")}</p>
                                <p className="text-stone-500 mt-2">{t("empty.desc")}</p>
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProperties.map((property) => (
                                <div key={property.id} className={`group relative flex flex-col overflow-hidden rounded-[calc(var(--radius)*2)] bg-card border-none shadow-lg transition-all duration-300 hover:-translate-y-1 transform-gpu`}>

                                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/20">
                                        {property.status === "Funding" && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold backdrop-blur-sm shadow-sm text-foreground">
                                                {t("status.funding")}
                                            </div>
                                        )}
                                        {(property.status === "Funded" || property.status === "Active") && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-invest/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
                                                {t("status.funded")}
                                            </div>
                                        )}
                                        {property.status === "Closed" && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
                                                {t("status.closed")}
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur-sm shadow-sm flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-invest">trending_up</span>
                                            APY {property.apy}%
                                        </div>
                                        <img
                                            alt={property.title}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            src={property.image}
                                            loading="lazy"
                                            decoding="async"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent opacity-60"></div>
                                        <div className="absolute bottom-4 left-4 text-white z-10">
                                            <div className="flex items-center gap-1 text-xs font-medium bg-foreground/40 backdrop-blur-md px-2 py-1 rounded mb-1 w-fit">
                                                <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                {property.location}
                                            </div>
                                            <h3 className="text-xl font-bold">{property.title}</h3>
                                        </div>
                                    </div>

                                    <div className="flex flex-1 flex-col justify-between p-5">
                                            <>
                                                <div className="mb-4 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs font-medium text-foreground/60">{t("card.tokenPrice")}</p>
                                                        <p className="text-base font-bold text-foreground">{fmtKrw(property.tokenPrice)}</p>
                                                        <p className="text-xs text-muted-foreground">{fmtUsdc(property.usdcPrice)} · /token</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium text-foreground/60">{t("card.valuation")}</p>
                                                        <p className="text-base font-bold text-foreground">{formatKrwLabel(property.valuationKrw, i18n.language as "ko" | "en")}</p>
                                                        <p className="text-xs text-muted-foreground">${Math.round(property.valuationUsdc).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="font-medium text-foreground/80">{t("card.tokensSold")}</span>
                                                        <span className="font-bold text-invest">
                                                            {property.fundingProgress < 1 && property.tokensSold > 0
                                                                ? t("card.sold", { count: property.tokensSold })
                                                                : `${property.fundingProgress}%`}
                                                        </span>
                                                    </div>
                                                    <div className="h-2.5 w-full rounded-full bg-background overflow-hidden border border-border/50">
                                                        <div
                                                            className="h-full rounded-full bg-invest"
                                                            style={{ width: property.tokensSold > 0 && property.fundingProgress === 0 ? "2px" : `${property.fundingProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-xs text-foreground/50 pt-1">
                                                        <span>{t("card.raised", { amount: property.raised })}</span>
                                                        <span>{t("card.remaining", { amount: property.remaining })}</span>
                                                    </div>
                                                </div>
                                                {(property.status !== "Funding" || property.fundingProgress >= 100) ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/invest/${property.id}`);
                                                        }}
                                                        className="mt-5 w-full rounded-lg border border-invest py-2.5 text-sm font-semibold text-invest hover:bg-invest/10 transition-colors"
                                                    >
                                                        {t("card.view")}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/invest/${property.id}`);
                                                        }}
                                                        className="mt-5 w-full rounded-lg bg-invest hover:bg-invest-hover py-2.5 text-sm font-semibold text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                                                    >
                                                        {t("card.investNow")}
                                                    </button>
                                                )}
                                            </>
                                    </div>
                                </div>
                            ))}
                        </div>
                        )}
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
