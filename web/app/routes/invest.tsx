import { Header, Footer, Card } from "~/components/ui-mockup";
import { useNavigate, useLoaderData } from "react-router";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useKyc } from "~/components/KycProvider";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { eq } from "drizzle-orm";
import { syncFundingStatuses } from "~/lib/rwa.server";
import { fetchPropertiesOnchain } from "~/lib/rwa.onchain.server";

import { KRW_PER_USDC } from "~/lib/constants";
import { formatKrwLabel, fmtKrw, fmtUsdc } from "~/lib/formatters";

function statusToEnglish(status: string): string {
    switch (status) {
        case "funding": return "Funding";
        case "funded":  return "Funded";
        case "active":  return "Active";
        case "failed":  return "Closed";
        default:        return status;
    }
}

export async function loader() {
    await syncFundingStatuses();

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
        // 데드라인 경과 + 목표 미달 → failed 보정
        if (row.status === "funding" && row.fundingDeadline) {
            const deadlineMs = new Date(row.fundingDeadline).getTime();
            if (now > deadlineMs) {
                const totalSupply = row.totalSupply ?? 0;
                const tokensSold = row.tokensSold ?? 0;
                const progressBps = totalSupply > 0 ? (tokensSold / totalSupply) * 10000 : 0;
                if (progressBps < (row.minFundingBps ?? 6000)) {
                    row.status = "failed";
                }
            }
        }
    }

    return rows.filter(r => r.tokenMint).map((row) => {
        const images = row.images as string[];

        const usdcPrice = row.pricePerTokenUsdc! / 1_000_000;
        const tokenPriceKrw = usdcPrice * KRW_PER_USDC;
        const totalSupply = row.totalSupply!;
        const tokensSold = row.tokensSold!;
        const fundingProgress = totalSupply > 0
            ? Math.round((tokensSold / totalSupply) * 100)
            : 0;
        const raisedUsdc = tokensSold * usdcPrice;
        const remainingUsdc = (totalSupply - tokensSold) * usdcPrice;
        return {
            id: row.id,
            title: row.title,
            location: row.location,
            region: row.region,
            image: images[0] ?? "/house.png",
            apy: row.estimatedApyBps! / 100,
            tokenPrice: tokenPriceKrw,
            usdcPrice,
            valuationKrw: row.valuationKrw!,
            valuationUsdc: row.valuationKrw! / KRW_PER_USDC,
            fundingProgress,
            tokensSold,
            totalSupply,
            raised: formatKrwLabel(raisedUsdc * KRW_PER_USDC),
            remaining: formatKrwLabel(remainingUsdc * KRW_PER_USDC),
            raisedUsdc,
            remainingUsdc,
            status: statusToEnglish(row.status!),
            themes: [] as string[],
        };
    });
}

export default function InvestDashboard() {
    const allProperties = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const { connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [showFilter, setShowFilter] = useState(false);

    // Filter States
    const [selectedRegion, setSelectedRegion] = useState("All");
    const [selectedSort, setSelectedSort] = useState("Yield");
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [minApy, setMinApy] = useState(0);
    const [maxPrice, setMaxPrice] = useState(100000);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

    const { isKycCompleted } = useKyc();

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
                                빈집의 재탄생에 함께하세요.<br />

                            </p>
                        </div>
                        <div className="flex w-full md:w-auto items-center overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                            <div className="flex gap-2 items-center flex-nowrap w-max">
                                <button
                                    onClick={() => setShowFilter(!showFilter)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm hover:bg-background shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[18px]">tune</span>
                                    Filter
                                </button>
                                <div className="h-9 w-[1px] bg-border mx-1 shrink-0 hidden sm:block"></div>
                                {[
                                    { value: "All", label: "All Regions" },
                                    { value: "경기", label: "경기" },
                                    { value: "강원", label: "강원" },
                                    { value: "충청", label: "충청" },
                                    { value: "전라", label: "전라" },
                                    { value: "경상", label: "경상" },
                                    { value: "제주", label: "제주" },
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
                                    <h2 className="text-xl font-bold">Filter</h2>
                                    <button onClick={() => setShowFilter(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">Sort By</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: "Yield", label: "Yield" },
                                                { value: "Latest", label: "Latest" },
                                                { value: "Price", label: "Price" },
                                            ].map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setSelectedSort(value)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedSort === value
                                                        ? "bg-[#17cf54] text-white shadow-md shadow-[#17cf54]/20"
                                                        : "bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground border border-border/50"
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">Status</label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: "All", label: "All" },
                                                { value: "Funding", label: "Funding" },
                                                { value: "Funded", label: "Funded" },
                                                { value: "Active", label: "Active" },
                                                { value: "Closed", label: "Closed" },
                                            ].map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setSelectedStatus(value)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedStatus === value
                                                        ? "bg-[#17cf54] text-white shadow-md shadow-[#17cf54]/20"
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
                                            <span>Min APY</span>
                                            <span className="text-[#17cf54]">{minApy}%+</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="0" max="15" step="0.5"
                                            value={minApy}
                                            onChange={(e) => setMinApy(Number(e.target.value))}
                                            className="w-full accent-[#17cf54]"
                                        />
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 flex justify-between text-foreground">
                                            <span>Max Token Price</span>
                                            <span className="text-[#17cf54]">₩{maxPrice.toLocaleString()}</span>
                                        </label>
                                        <input
                                            type="range"
                                            min="10000" max="200000" step="10000"
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(Number(e.target.value))}
                                            className="w-full accent-[#17cf54]"
                                        />
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 block text-foreground">Theme</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["한옥", "오션뷰", "숲속 오두막", "돌담"].map((theme) => (
                                                <button
                                                    key={theme}
                                                    onClick={() => toggleTheme(theme)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${selectedThemes.includes(theme)
                                                        ? "bg-[#17cf54]/10 border-[#17cf54]/30 text-[#17cf54]"
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
                                        Reset
                                    </button>
                                    <button
                                        className="flex-1 px-4 py-3 rounded-xl bg-[#17cf54] hover:bg-[#14b847] text-white font-bold transition-transform active:scale-[0.98] shadow-lg shadow-[#17cf54]/20"
                                        onClick={() => setShowFilter(false)}
                                    >
                                        View {filteredProperties.length} listings
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="w-full">
                        {filteredProperties.length === 0 ? (
                            <div className="py-24 text-center">
                                <span className="material-symbols-outlined text-[56px] text-stone-300">real_estate_agent</span>
                                <p className="text-lg font-bold text-stone-700 mt-4">Coming Soon</p>
                                <p className="text-stone-500 mt-2">새로운 투자 매물이 준비 중입니다.</p>
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProperties.map((property) => (
                                <div key={property.id} className={`group relative flex flex-col overflow-hidden rounded-[calc(var(--radius)*2)] bg-card border-none shadow-lg transition-all duration-300 hover:-translate-y-1 transform-gpu`}>

                                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/20">
                                        {property.status === "Funding" && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold backdrop-blur-sm shadow-sm text-foreground">
                                                Funding
                                            </div>
                                        )}
                                        {(property.status === "Funded" || property.status === "Active") && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-[#17cf54]/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
                                                FUNDED
                                            </div>
                                        )}
                                        {property.status === "Closed" && (
                                            <div className="absolute top-3 left-3 z-10 rounded-full bg-red-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm shadow-sm">
                                                Closed
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur-sm shadow-sm flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-green-600">trending_up</span>
                                            APY {property.apy}%
                                        </div>
                                        <img
                                            alt={property.title}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            src={property.image}
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
                                                        <p className="text-xs font-medium text-foreground/60">Token Price</p>
                                                        <p className="text-base font-bold text-foreground">{fmtKrw(property.tokenPrice)}</p>
                                                        <p className="text-xs text-muted-foreground">{fmtUsdc(property.usdcPrice)} · /token</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium text-foreground/60">Valuation</p>
                                                        <p className="text-base font-bold text-foreground">{formatKrwLabel(property.valuationKrw)}</p>
                                                        <p className="text-xs text-muted-foreground">${Math.round(property.valuationUsdc).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="font-medium text-foreground/80">Tokens Sold</span>
                                                        <span className="font-bold text-green-600">
                                                            {property.fundingProgress < 1 && property.tokensSold > 0
                                                                ? `${property.tokensSold.toLocaleString()} sold`
                                                                : `${property.fundingProgress}%`}
                                                        </span>
                                                    </div>
                                                    <div className="h-2.5 w-full rounded-full bg-background overflow-hidden border border-border/50">
                                                        <div
                                                            className="h-full rounded-full bg-[#17cf54]"
                                                            style={{ width: property.tokensSold > 0 && property.fundingProgress === 0 ? "2px" : `${property.fundingProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-xs text-foreground/50 pt-1">
                                                        <span>{property.raised} raised</span>
                                                        <span>{property.remaining} remaining</span>
                                                    </div>
                                                </div>
                                                {(property.status !== "Funding" || property.fundingProgress >= 100) ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/invest/${property.id}`);
                                                        }}
                                                        className="mt-5 w-full rounded-lg border border-[#17cf54] py-2.5 text-sm font-semibold text-[#17cf54] hover:bg-[#17cf54]/10 transition-colors"
                                                    >
                                                        View
                                                    </button>
                                                ) : connected ? (
                                                    isKycCompleted ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/invest/${property.id}`);
                                                            }}
                                                            className="mt-5 w-full rounded-lg bg-[#17cf54] hover:bg-[#14b847] py-2.5 text-sm font-semibold text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                                                        >
                                                            Invest Now
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate("/kyc");
                                                            }}
                                                            className="mt-5 w-full rounded-lg bg-[#17cf54] hover:bg-[#14b847] py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
                                                        >
                                                            Complete KYC to Invest
                                                        </button>
                                                    )
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setVisible(true);
                                                        }}
                                                        className="mt-5 w-full rounded-lg bg-[#17cf54] hover:bg-[#14b847] py-2.5 text-sm font-semibold text-white transition-colors shadow-sm"
                                                    >
                                                        Connect Wallet to Invest
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
