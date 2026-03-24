import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/invest.detail";
import { Header, Footer, Card, Button, Input, Badge } from "~/components/ui-mockup";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, user } from "~/db/schema";
import { eq, sql } from "drizzle-orm";
import { PropertyMap } from "~/components/PropertyMap";
import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { useToast } from "~/hooks/use-toast";
import { useKyc } from "~/components/KycProvider";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
    ComposedChart,
} from "recharts";

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
    if (won >= 1_0000) {
        const man = Math.round(won / 1_0000);
        return `${man}만 원`;
    }
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
    const tokenPriceKrw = Math.round((row.pricePerTokenUsdc / 1_000_000) * KRW_PER_USDC);
    const usdcPrice = row.pricePerTokenUsdc / 1_000_000;
    const fundingProgress = row.totalSupply > 0
        ? Math.round((row.tokensSold / row.totalSupply) * 100) : 0;

    return {
        id: row.id,
        title: row.title,
        location: row.location,
        detailLocation: row.location,
        images,
        apy: row.estimatedApyBps / 100,
        tokenName: `RWA-${row.id.slice(-4).toUpperCase()}`,
        tokenPrice: tokenPriceKrw,
        usdcPrice,
        totalSupply: row.totalSupply,
        totalValuation: formatKrw(row.valuationKrw),
        holders: holdersRow?.count ?? 0,
        soldTokens: row.tokensSold,
        fundingProgress,
        raised: formatKrw(row.tokensSold * tokenPriceKrw),
        remaining: formatKrw((row.totalSupply - row.tokensSold) * tokenPriceKrw),
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


const DUMMY_DIVIDENDS = [3200, 3000, 3900, 3500, 4500, 4200, 5200, 4900, 4400, 5400, 5100, 4100];
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const chartData = MONTHS.map((month, index) => {
    const netDividend = DUMMY_DIVIDENDS[index];
    const platformFee = Math.round(netDividend * 0.05);
    const operatingCost = Math.round(netDividend * 0.15);
    const grossRevenue = netDividend + operatingCost + platformFee;

    // Calculate cumulative dividend
    const cumulativeDividend = DUMMY_DIVIDENDS.slice(0, index + 1).reduce((a, b) => a + b, 0);

    return {
        month,
        netDividend,
        platformFee,
        operatingCost,
        grossRevenue,
        cumulativeDividend,
    };
});

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-stone-900 text-white text-xs px-3 py-2 rounded-lg shadow-2xl z-10 min-w-[160px]">
                <div className="font-bold text-sm mb-2 border-b border-white/20 pb-1">
                    {label} 배당 상세
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-white/70">총 수익</span>
                        <span className="font-semibold">₩{data.grossRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-white/70">운영비</span>
                        <span className="text-red-300">-₩{data.operatingCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-white/70">플랫폼 수수료</span>
                        <span className="text-red-300">-₩{data.platformFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 mt-1 border-t border-white/20">
                        <span className="font-bold text-[#17cf54]">순 배당</span>
                        <span className="font-bold text-[#17cf54]">₩{data.netDividend.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                        <span className="font-bold text-amber-400">누적 배당</span>
                        <span className="font-bold text-amber-400">₩{data.cumulativeDividend.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

function RevenueChart({ lastDividend, apy }: { lastDividend: string; apy: number }) {
    const annualTotal = DUMMY_DIVIDENDS.reduce((a, b) => a + b, 0);

    return (
        <div className="p-6 rounded-3xl bg-white border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <p className="text-sm text-stone-500 font-medium mb-1">연간 합계 (token당)</p>
                    <p className="text-3xl font-bold text-[#4a3b2c]">
                        {annualTotal.toLocaleString()}
                        <span className="text-lg font-normal text-stone-400 ml-1">USDC</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-stone-500 font-medium mb-1">연 수익률 (est.)</p>
                    <p className="text-3xl font-bold text-[#17cf54]">+{apy}%</p>
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                        <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#8E8E93', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#8E8E93', fontSize: 12 }}
                            tickFormatter={(value) => `${value / 1000}k`}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(23, 207, 84, 0.05)' }} />
                        <Bar
                            yAxisId="left"
                            dataKey="netDividend"
                            fill="#17cf54"
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                            opacity={0.8}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="cumulativeDividend"
                            stroke="#ab9ff2"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#ab9ff2", strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center items-center gap-6 mt-6 pt-4 border-t border-stone-100">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#17cf54] opacity-80" />
                    <span className="text-xs text-stone-500">월별 순 배당</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ab9ff2]" />
                    <span className="text-xs text-stone-500">누적 배당</span>
                </div>
            </div>
            <p className="text-xs text-stone-400 text-center mt-4">
                Last Dividend — {lastDividend}
            </p>
        </div>
    );
}

function InvestDetailContent() {
    const property = useLoaderData<typeof loader>();
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();
    const [tokenCount, setTokenCount] = useState(1);
    const [showGallery, setShowGallery] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const { toast } = useToast();

    const handleInvest = async () => {
        if (!publicKey) return;

        try {
            setIsProcessing(true);

            // Real on-chain transaction adding a Memo for the investment
            const memoText = `Rural Rest Investment: ${tokenCount} tokens of ${property.tokenName}`;

            const memoInstruction = new TransactionInstruction({
                keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
                data: Buffer.from(memoText, 'utf-8') as any,
                programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            });

            // Add a small SOL transfer to simulate payment (0.01 SOL)
            const transferInstruction = SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: publicKey, // Self transfer for safe simulation without external treasury
                lamports: Math.round(LAMPORTS_PER_SOL * 0.01),
            });

            const transaction = new Transaction().add(memoInstruction, transferInstruction);

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'processed');

            toast({
                title: "투자가 완료되었습니다!",
                description: `성공적으로 온체인에 기록되었습니다. (서명: ${signature.slice(0, 8)}...)`,
                variant: "success",
            });
        } catch (error) {
            console.error("Investment failed:", error);
            toast({
                title: "결제 실패",
                description: "트랜잭션이 취소되었거나 실패했습니다.",
                variant: "destructive",
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const navigate = useNavigate();
    const { isKycCompleted } = useKyc();

    const platformFeeRate = 0.01;
    const subtotal = property.tokenPrice * tokenCount;
    const subtotalUsdc = property.usdcPrice * tokenCount;
    const platformFee = subtotal * platformFeeRate;
    const total = subtotal + platformFee;
    const estAnnualReturn = Math.floor(subtotal * (property.apy / 100));

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />

            <main className="container mx-auto py-8 px-4 sm:px-8 max-w-6xl">

                {/* Title & Badges */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-[#17cf54]/10 text-[#17cf54] text-xs font-bold px-3 py-1 rounded-full border border-[#17cf54]/20">
                            모집 중
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
                        <span className="text-muted-foreground">· {property.detailLocation}</span>
                    </div>
                </div>

                {/* Gallery Grid */}
                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-auto md:h-[450px]">
                        {/* Main Image */}
                        <div className="md:col-span-3 rounded-2xl overflow-hidden shadow-lg relative group">
                            <img
                                src={property.images[0]}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                alt={property.title}
                                onClick={() => setShowGallery(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        </div>
                        {/* Side: image + "+N Photos" button */}
                        <div className="hidden md:grid grid-rows-2 gap-4">
                            <div className="rounded-2xl overflow-hidden shadow-md relative group">
                                <img
                                    src={property.images[1] || property.images[0]}
                                    className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                    alt={`${property.title} 2`}
                                    onClick={() => setShowGallery(true)}
                                />
                            </div>
                            <button
                                className="rounded-2xl overflow-hidden shadow-md bg-stone-100 flex flex-col items-center justify-center gap-2 font-bold text-stone-600 hover:bg-stone-200 transition-colors group"
                                onClick={() => setShowGallery(true)}
                            >
                                <svg
                                    className="w-6 h-6 transition-transform group-hover:scale-110"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 6h16M4 12h16m-7 6h7"
                                    />
                                </svg>
                                <span>+{property.images.length - 2} Photos</span>
                            </button>
                        </div>
                        {/* Mobile */}
                        <div className="md:hidden">
                            <Button
                                variant="outline"
                                className="w-full rounded-xl"
                                onClick={() => setShowGallery(true)}
                            >
                                모든 사진 보기 ({property.images.length})
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* About */}
                        <section className="space-y-4 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">About This Home</h2>
                            <p className="text-muted-foreground leading-relaxed text-lg">
                                {property.about}
                            </p>
                        </section>

                        {/* Renovation History + Occupancy */}
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
                                {[
                                    { icon: "group", label: "최대 인원", value: `${property.maxGuests}명` },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex flex-col gap-2 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-primary text-[24px]">
                                            {item.icon}
                                        </span>
                                        <p className="text-xs text-muted-foreground">{item.label}</p>
                                        <p className="font-semibold text-sm">{item.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Occupancy */}
                            <div className="flex items-center gap-5 p-5 rounded-2xl bg-stone-50 border border-stone-100 shadow-sm">
                                <div className="p-3 rounded-xl bg-[#17cf54]/10">
                                    <span className="material-symbols-outlined text-[28px] text-[#17cf54]">
                                        bar_chart
                                    </span>
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
                                    { icon: "wifi", label: "무선 인터넷 (WiFi)" },
                                    { icon: "kitchen", label: "주방 및 조리도구" },
                                    { icon: "ac_unit", label: "시스템 에어컨" },
                                    { icon: "local_parking", label: "무료 주차공간" },
                                    { icon: "tv", label: "스마트 TV (넷플릭스)" },
                                    { icon: "coffee_maker", label: "네스프레소 커피머신" },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-3 text-stone-700">
                                        <span className="material-symbols-outlined text-stone-400 text-[22px]">
                                            {item.icon}
                                        </span>
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
                                    <div>
                                        <h3 className="text-xl font-bold text-stone-900">
                                            {property.host.name}
                                        </h3>
                                    </div>
                                    <p className="text-stone-700 leading-relaxed text-sm">
                                        {property.host.bio}
                                    </p>
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

                        {/* Location */}
                        <section className="space-y-4 pt-8 border-t pb-12">
                            <h2 className="text-2xl font-bold text-foreground">Location & Map</h2>
                            <p className="text-sm text-muted-foreground">{property.detailLocation}</p>
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

                            {/* Card 1: Token Information */}
                            <Card className="p-6 shadow-md border border-stone-100 bg-white rounded-2xl">
                                <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-4">
                                    Token Information
                                </h3>
                                <div className="space-y-2.5">
                                    {[
                                        { label: "Token Name", value: property.tokenName },
                                        { label: "Total Supply", value: `${property.totalSupply.toLocaleString()} tokens` },
                                        { label: "Price / Token", value: `₩${property.tokenPrice.toLocaleString()} (≈${property.usdcPrice} USDC)` },
                                        { label: "Valuation", value: property.totalValuation },
                                        { label: "Holders", value: `${property.holders} investors` },
                                    ].map((item) => (
                                        <div key={item.label} className="flex justify-between items-center text-sm">
                                            <span className="text-stone-500">{item.label}</span>
                                            <span className="font-semibold text-stone-800">{item.value}</span>
                                        </div>
                                    ))}

                                    {/* Sold + Progress */}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-stone-500">Sold</span>
                                        <span className="font-semibold text-stone-800">
                                            {property.soldTokens.toLocaleString()} / {property.totalSupply.toLocaleString()} ({property.fundingProgress}%)
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-[#17cf54]"
                                            style={{ width: `${property.fundingProgress}%` }}
                                        />
                                    </div>

                                    <div className="border-t border-stone-100 pt-2.5 space-y-2.5">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-stone-500">Annual Yield</span>
                                            <span className="font-bold text-[#17cf54]">{property.apy}% (est.)</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-stone-500">Last Dividend</span>
                                            <span className="font-semibold text-stone-800">{property.lastDividend}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Card 2: Purchase Tokens */}
                            <Card className="p-6 shadow-2xl border-none bg-white rounded-3xl space-y-4">
                                <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                                    Purchase Tokens
                                </h3>

                                {/* Token Input */}
                                <div>
                                    <label className="text-xs font-medium text-stone-600 block mb-1.5">
                                        Amount
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => setTokenCount((c) => Math.max(1, c - 1))}
                                            disabled={property.fundingProgress >= 100}
                                        >
                                            −
                                        </button>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={tokenCount}
                                            onChange={(e) =>
                                                setTokenCount(Math.max(1, parseInt(e.target.value) || 1))
                                            }
                                            className="text-center text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={property.fundingProgress >= 100}
                                        />
                                        <button
                                            className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => setTokenCount((c) => c + 1)}
                                            disabled={property.fundingProgress >= 100}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {/* Price Breakdown */}
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-stone-600">
                                        <span>{tokenCount} tokens × ₩{property.tokenPrice.toLocaleString()}</span>
                                        <span className="font-semibold text-stone-800">
                                            {subtotalUsdc.toFixed(1)} USDC
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-stone-600">
                                        <span>플랫폼 수수료 (1%)</span>
                                        <span className="font-semibold text-stone-800">
                                            {(subtotalUsdc * 0.01).toFixed(2)} USDC
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[#17cf54] text-xs">
                                        <span>Est. Annual Return</span>
                                        <span className="font-bold">₩{estAnnualReturn.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-stone-200 pt-3 font-bold text-stone-900">
                                        <span>Total</span>
                                        <span>
                                            {(subtotalUsdc * 1.01).toFixed(1)} USDC
                                            <span className="text-xs text-stone-400 font-normal ml-1">
                                                (≈₩{Math.floor(total).toLocaleString()})
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                {/* CTA */}
                                {property.fundingProgress >= 100 ? (
                                    <button
                                        disabled
                                        className="w-full h-14 rounded-2xl bg-stone-300 text-stone-500 text-base font-bold cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            block
                                        </span>
                                        Sold Out
                                    </button>
                                ) : connected ? (
                                    isKycCompleted ? (
                                        <button
                                            className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                            onClick={handleInvest}
                                            disabled={isProcessing}
                                        >
                                            <span className="material-symbols-outlined text-[20px]">
                                                {isProcessing ? 'hourglass_empty' : 'account_balance_wallet'}
                                            </span>
                                            {isProcessing ? 'Processing Transaction...' : 'Buy with USDC →'}
                                        </button>
                                    ) : (
                                        <button
                                            className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                                            onClick={() => navigate("/kyc")}
                                        >
                                            Complete KYC to Invest
                                        </button>
                                    )
                                ) : (
                                    <button
                                        className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                                        onClick={() => setVisible(true)}
                                    >
                                        Connect Wallet to Invest
                                    </button>
                                )}

                                <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                    No charge until funding goal is met
                                </p>

                                {/* Risk Disclaimer */}
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">
                                            warning
                                        </span>
                                        <p className="text-xs text-amber-800 leading-relaxed">
                                            <span className="font-bold">투자 위험 고지</span><br />
                                            본 투자는 원금 손실 가능성이 있으며, 숙박 수익률은 계절·시장 상황에 따라 변동될 수 있습니다.
                                        </p>
                                    </div>
                                </div>

                                <button className="w-full text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">flag</span>
                                    문제 신고
                                </button>
                            </Card>

                        </div>
                    </div>
                </div>
            </main>

            {/* Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
                    <div className="sticky top-0 z-[110] flex justify-between items-center p-6 bg-black/40 backdrop-blur-md border-b border-white/10">
                        <div className="flex flex-col">
                            <h2 className="text-white text-xl font-bold">{property.title}</h2>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
                                Gallery — {property.images.length} Photos
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 h-12 w-12 rounded-full p-0"
                            onClick={() => setShowGallery(false)}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>
                    <div className="max-w-6xl mx-auto px-6 py-12 md:columns-2 lg:columns-3 gap-6 space-y-6">
                        {property.images.map((img, i) => (
                            <div
                                key={i}
                                className="group relative rounded-2xl overflow-hidden shadow-2xl break-inside-avoid animate-in zoom-in-95 duration-500"
                            >
                                <img
                                    src={img}
                                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                                    alt={`${property.title} gallery ${i + 1}`}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}

export default function InvestDetail() {
    return <InvestDetailContent />;
}
