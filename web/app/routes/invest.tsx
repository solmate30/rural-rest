import { Header, Footer, Card } from "~/components/ui-mockup";
import { useNavigate, useLoaderData } from "react-router";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useKyc } from "~/components/KycProvider";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { eq } from "drizzle-orm";

// TODO: 추후 Pyth oracle로 교체
const KRW_PER_USDC = 1350;

function formatKrw(won: number): string {
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억 원`;
    }
    if (won >= 1_0000) {
        const man = won / 1_0000;
        return `${man % 1 === 0 ? man : man.toFixed(0)}만 원`;
    }
    return `${won.toLocaleString()}원`;
}

function fmtKrwDisplay(krw: number): string {
    if (krw >= 1) return `₩${Math.round(krw).toLocaleString()}`;
    return `₩${krw.toFixed(2)}`;
}

function fmtUsdcDisplay(usdc: number): string {
    if (usdc >= 0.01) return `${usdc.toFixed(2)} USDC`;
    if (usdc >= 0.0001) return `${usdc.toFixed(4)} USDC`;
    return `${usdc.toFixed(6)} USDC`;
}

function statusToEnglish(status: string): string {
    switch (status) {
        case "funding": return "Funding";
        case "funded":  return "Funded";
        case "active":  return "Active";
        case "failed":  return "Failed";
        default:        return status;
    }
}

export async function loader() {
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
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id));

    return rows.map((row) => {
        const images = row.images as string[];

        // RWA 미발행 매물 (온체인 미초기화) — Coming Soon
        if (!row.tokenMint) {
            return {
                id: row.id,
                title: row.title,
                location: row.location,
                region: row.region,
                image: images[0] ?? "/house.png",
                apy: 0,
                tokenPrice: 0,
                usdcPrice: 0,
                valuationKrw: 0,
                valuationUsdc: 0,
                fundingProgress: 0,
                raised: "—",
                remaining: "—",
                raisedUsdc: 0,
                remainingUsdc: 0,
                status: "coming_soon" as const,
                themes: [] as string[],
            };
        }

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
            raised: formatKrw(raisedUsdc * KRW_PER_USDC),
            remaining: formatKrw(remainingUsdc * KRW_PER_USDC),
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
                                    필터
                                </button>
                                <div className="h-9 w-[1px] bg-border mx-1 shrink-0 hidden sm:block"></div>
                                {["전체", "경기", "강원", "충청", "전라", "경상", "제주"].map((region) => (
                                    <button
                                        key={region}
                                        onClick={() => setSelectedRegion(region)}
                                        className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm shrink-0 transition-colors ${selectedRegion === region
                                            ? "bg-foreground text-background"
                                            : "bg-card text-foreground/70 hover:text-foreground hover:bg-background"
                                            }`}
                                    >
                                        {region} {region === "전체" ? "지역" : ""}
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
                                    <h2 className="text-xl font-bold">필터 옵션</h2>
                                    <button onClick={() => setShowFilter(false)} className="p-2 hover:bg-secondary rounded-lg transition-colors">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">정렬 방식</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["수익률순", "최신순", "가격순"].map((sort) => (
                                                <button
                                                    key={sort}
                                                    onClick={() => setSelectedSort(sort)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedSort === sort
                                                        ? "bg-[#17cf54] text-white shadow-md shadow-[#17cf54]/20"
                                                        : "bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground border border-border/50"
                                                        }`}
                                                >
                                                    {sort}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold mb-3 block text-foreground">펀딩 상태</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["전체", "모집 중", "모집 완료", "운영 중"].map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => setSelectedStatus(status)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${selectedStatus === status
                                                        ? "bg-[#17cf54] text-white shadow-md shadow-[#17cf54]/20"
                                                        : "bg-secondary text-foreground/70 hover:bg-secondary/80 hover:text-foreground border border-border/50"
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t border-border pt-4">
                                        <label className="text-sm font-bold mb-3 flex justify-between text-foreground">
                                            <span>예상 수익률 (APY)</span>
                                            <span className="text-[#17cf54]">{minApy}% 이상</span>
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
                                            <span>토큰 가격대</span>
                                            <span className="text-[#17cf54]">{(maxPrice).toLocaleString()}원 이하</span>
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
                                        <label className="text-sm font-bold mb-3 block text-foreground">숙소 테마</label>
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
                                            setSelectedRegion("전체");
                                            setSelectedSort("수익률순");
                                            setSelectedStatus("전체");
                                            setMinApy(0);
                                            setMaxPrice(100000);
                                            setSelectedThemes([]);
                                        }}
                                    >
                                        초기화
                                    </button>
                                    <button
                                        className="flex-1 px-4 py-3 rounded-xl bg-[#17cf54] hover:bg-[#14b847] text-white font-bold transition-transform active:scale-[0.98] shadow-lg shadow-[#17cf54]/20"
                                        onClick={() => setShowFilter(false)}
                                    >
                                        {filteredProperties.length}개의 숙소 보기
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="w-full">
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filteredProperties.map((property) => (
                                <div key={property.id} className={`group relative flex flex-col overflow-hidden rounded-[calc(var(--radius)*2)] bg-card border-none shadow-lg transition-all duration-300 hover:-translate-y-1 transform-gpu`}>

                                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/20">
                                        {property.status !== "coming_soon" && (
                                            <div className="absolute top-3 right-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur-sm shadow-sm flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px] text-green-600">trending_up</span>
                                                연 {property.apy}%
                                            </div>
                                        )}
                                        <img
                                            alt={property.title}
                                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${property.status === "coming_soon" ? "grayscale" : ""}`}
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
                                        {property.status === "coming_soon" && (
                                            <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center backdrop-blur-[2px]">
                                                <div className="bg-card px-4 py-2 rounded-full shadow-lg border border-border text-sm font-bold text-foreground flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                                                    RWA Coming Soon
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-1 flex-col justify-between p-5">
                                        {property.status === "coming_soon" ? (
                                            <>
                                                <div className="mb-4 space-y-2">
                                                    <p className="text-xs font-medium text-foreground/50">Token Price</p>
                                                    <p className="text-lg font-bold text-foreground/30">— / token</p>
                                                    <p className="text-xs text-foreground/40 mt-1">RWA 토큰 발행 준비 중입니다.</p>
                                                </div>
                                                <button disabled className="mt-auto w-full rounded-lg border border-border bg-transparent py-2.5 text-sm font-semibold text-foreground/40 cursor-not-allowed">
                                                    준비 중
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="mb-4 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs font-medium text-foreground/60">Token Price</p>
                                                        <p className="text-base font-bold text-foreground">{fmtKrwDisplay(property.tokenPrice)}</p>
                                                        <p className="text-xs text-muted-foreground">{fmtUsdcDisplay(property.usdcPrice)} · /token</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-medium text-foreground/60">Valuation</p>
                                                        <p className="text-base font-bold text-foreground">{formatKrw(property.valuationKrw)}</p>
                                                        <p className="text-xs text-muted-foreground">${Math.round(property.valuationUsdc).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="font-medium text-foreground/80">Tokens Sold</span>
                                                        <span className="font-bold text-green-600">{property.fundingProgress}%</span>
                                                    </div>
                                                    <div className="h-2.5 w-full rounded-full bg-background overflow-hidden border border-border/50">
                                                        <div className="h-full rounded-full bg-[#17cf54]" style={{ width: `${property.fundingProgress}%` }}></div>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-foreground/50 pt-1">
                                                        <span>{property.raised} raised</span>
                                                        <span>{property.remaining} remaining</span>
                                                    </div>
                                                </div>
                                                {connected ? (
                                                    isKycCompleted ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/invest/${property.id}`);
                                                            }}
                                                            className="mt-5 w-full rounded-lg bg-[#17cf54] hover:bg-[#14b847] py-2.5 text-sm font-semibold text-white transition-colors shadow-sm flex items-center justify-center gap-1"
                                                        >
                                                            Invest Now
                                                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
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
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
