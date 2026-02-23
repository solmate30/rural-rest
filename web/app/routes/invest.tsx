import { Header, Footer, Card, Button } from "~/components/ui-mockup";
import { useNavigate } from "react-router";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useKyc } from "~/components/KycProvider";

function InvestDashboardContent() {
    const navigate = useNavigate();
    const { connected } = useWallet();
    const { setVisible } = useWalletModal();
    const [showFilter, setShowFilter] = useState(false);

    // Filter States
    const [selectedRegion, setSelectedRegion] = useState("전체");
    const [selectedSort, setSelectedSort] = useState("수익률순");
    const [selectedStatus, setSelectedStatus] = useState("전체");
    const [minApy, setMinApy] = useState(0);
    const [maxPrice, setMaxPrice] = useState(100000);
    const [selectedThemes, setSelectedThemes] = useState<string[]>([]);

    const { isKycCompleted } = useKyc();

    const ALL_PROPERTIES = [
        {
            id: "1",
            title: "성주 할머니댁 돌담집",
            location: "경주시, 경상북도",
            region: "경상",
            image: "/house.png",
            apy: 8.2,
            tokenPrice: 50000,
            totalValuation: "5억 원",
            fundingProgress: 78,
            raised: "3.9억 원",
            remaining: "1.1억 원",
            status: "운영 중",
            themes: ["한옥"]
        },
        {
            id: "2",
            title: "양평 숲속 오두막",
            location: "양평군, 경기도",
            region: "경기",
            image: "/house.png",
            apy: 7.5,
            tokenPrice: 50000,
            totalValuation: "4.2억 원",
            fundingProgress: 45,
            raised: "1.89억 원",
            remaining: "2.31억 원",
            status: "모집 중",
            themes: ["숲속 오두막"]
        },
        {
            id: "3",
            title: "기장 바다 앞 민박",
            location: "기장군, 부산광역시",
            region: "경상",
            image: "/house.png",
            apy: 9.1,
            tokenPrice: 50000,
            totalValuation: "6.8억 원",
            fundingProgress: 100,
            raised: "6.8억 원",
            remaining: "0",
            status: "모집 완료",
            themes: ["오션뷰"]
        },
        {
            id: "5",
            title: "제주 애월 돌담 민박",
            location: "애월읍, 제주도",
            region: "제주",
            image: "/house.png",
            apy: 8.5,
            tokenPrice: 100000,
            totalValuation: "미정",
            fundingProgress: 0,
            raised: "0",
            remaining: "0",
            status: "모집 예정",
            themes: ["오션뷰", "돌담"]
        }
    ];

    // Filter Logic
    let filteredProperties = ALL_PROPERTIES.filter(p => {
        if (selectedRegion !== "전체" && p.region !== selectedRegion) return false;
        if (selectedStatus !== "전체" && p.status !== selectedStatus) return false;
        if (p.apy < minApy) return false;
        if (p.tokenPrice > maxPrice) return false;
        if (selectedThemes.length > 0 && !selectedThemes.some(t => p.themes.includes(t))) return false;
        return true;
    });

    // Sort Logic
    if (selectedSort === "수익률순") {
        filteredProperties.sort((a, b) => b.apy - a.apy);
    } else if (selectedSort === "가격순") {
        filteredProperties.sort((a, b) => a.tokenPrice - b.tokenPrice);
    } else if (selectedSort === "최신순") {
        // Assume id based sorting or progress for now
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
                                        <div className="absolute top-3 right-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur-sm shadow-sm flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-green-600">trending_up</span>
                                            연 {property.apy}%
                                        </div>
                                        <img
                                            alt={property.title}
                                            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${property.status === '모집 예정' ? 'grayscale blur-[2px] group-hover:scale-100' : ''}`}
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
                                        {property.status === '모집 예정' && (
                                            <div className="absolute inset-0 bg-background/40 z-20 flex items-center justify-center backdrop-blur-sm transition-all">
                                                <div className="bg-card px-4 py-2 rounded-full shadow-lg border border-border text-sm font-bold text-foreground flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                                                    오픈 예정
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-1 flex-col justify-between p-5">
                                        <div className="mb-4 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs font-medium text-foreground/60">Token Price</p>
                                                <p className="text-lg font-bold text-foreground">₩{property.tokenPrice.toLocaleString()}</p>
                                                <p className="text-xs text-muted-foreground">/ token</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-medium text-foreground/60">{property.status === '모집 예정' ? 'Est. Yield' : 'Valuation'}</p>
                                                <p className="text-lg font-bold text-foreground">{property.status === '모집 예정' ? `${property.apy}%` : property.totalValuation}</p>
                                                <p className="text-xs text-muted-foreground">{property.status === '모집 예정' ? 'annually' : ''}</p>
                                            </div>
                                        </div>

                                        {property.status === '운영 중' || property.status === '모집 중' || property.status === '모집 완료' ? (
                                            <>
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
                                        ) : (
                                            <button className="mt-auto w-full rounded-lg border border-border bg-transparent py-2.5 text-sm font-semibold text-foreground/80 hover:border-primary hover:text-foreground hover:bg-background transition-colors">
                                                오픈 알림 받기
                                            </button>
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

export default function InvestDashboard() {
    return <InvestDashboardContent />;
}
