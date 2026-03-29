import { Link, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { listings, rwaTokens, rwaInvestments } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { InitializePropertyButton } from "~/components/rwa/InitializePropertyButton";
import { ReleaseFundsButton } from "~/components/rwa/ReleaseFundsButton";
import type { Route } from "./+types/admin.tokenize";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";

import { TOTAL_SUPPLY, KRW_PER_USDC } from "~/lib/constants";
import { formatKrwLabel } from "~/lib/formatters";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

export async function loader({ request, params }: Route.LoaderArgs) {
    await requireUser(request, ["host", "admin"]);
    const listingId = params.listingId;

    const [listingRow] = await db
        .select({
            id: listings.id,
            title: listings.title,
            location: listings.location,
            images: listings.images,
            valuationKrw: listings.valuationKrw,
            pricePerNight: listings.pricePerNight,
        })
        .from(listings)
        .where(eq(listings.id, listingId));

    if (!listingRow) throw new Response("Not Found", { status: 404 });

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

const statusLabel: Record<string, string> = {
    funding: "펀딩 진행중",
    funded: "펀딩 완료",
    active: "운영중",
    failed: "펀딩 실패",
};

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
    const tokenPriceUsdc = tokenPriceKrw / KRW_PER_USDC;
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
            <div className="min-h-screen bg-[#fcfaf7] font-sans">
                <Header />
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
                            {statusLabel[token.status] ?? token.status}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        {/* Left column: Status + funding progress */}
                        <div className="lg:col-span-3 space-y-6">
                            {/* Token status card */}
                            <Card className="rounded-3xl border-stone-100 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">토큰 상태</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* Funding progress bar */}
                                    {(token.status === "funding" || token.status === "funded") && (
                                        <div className="mb-5">
                                            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                                                <span>판매 진행률</span>
                                                <span className="font-semibold text-[#4a3b2c]">{soldPct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#17cf54] rounded-full transition-all"
                                                    style={{ width: `${soldPct}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1.5">
                                                <span>{token.tokensSold.toLocaleString()} / {token.totalSupply.toLocaleString()} 토큰</span>
                                                <span>최소 목표 {minPct}%</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stats grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">투자자</p>
                                            <p className="text-xl font-bold text-[#4a3b2c]">
                                                {investorCount}
                                                <span className="text-xs font-normal text-stone-400 ml-0.5">명</span>
                                            </p>
                                        </div>
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">감정가</p>
                                            <p className="text-base font-bold text-[#4a3b2c]">{formatKrwLabel(token.valuationKrw)}</p>
                                        </div>
                                        <div className="bg-stone-50 rounded-xl p-4 text-center">
                                            <p className="text-[11px] text-stone-400 mb-1">
                                                {token.status === "funding" ? "마감까지" : "마감일"}
                                            </p>
                                            {daysLeft !== null && token.status === "funding" ? (
                                                <p className="text-xl font-bold text-[#4a3b2c]">
                                                    {daysLeft}
                                                    <span className="text-xs font-normal text-stone-400 ml-0.5">일</span>
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
                                        <CardTitle className="text-base font-bold text-[#4a3b2c]">자금 인출 + 운영 시작</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-stone-400 mb-4">
                                            펀딩 목표를 달성했습니다. 자금을 인출하면 예약이 자동으로 오픈되고 투자자 배당이 시작됩니다.
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
                                        <p className="text-sm font-semibold text-[#4a3b2c]">운영 중</p>
                                        <p className="text-xs text-stone-500 mt-0.5">월정산에서 수익을 분배하세요.</p>
                                    </div>
                                    <Button variant="success" size="sm" asChild>
                                        <Link to={`/admin/settlements/${listing.id}`}>
                                            정산 관리
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
                                    <CardTitle className="text-base font-bold text-[#4a3b2c]">온체인 정보</CardTitle>
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
                                        Explorer에서 보기
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
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-10 pb-16 px-4 sm:px-8">
                {/* Back link + page header */}
                <div className="mb-8">
                    <Link
                        to="/admin"
                        className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-4"
                    >
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        대시보드
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
                                <CardTitle className="text-base font-bold text-[#4a3b2c]">토큰 발행 설정</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div>
                                    <p className="text-xs text-stone-400 mb-1">매물 감정가</p>
                                    <p className="text-2xl font-bold text-[#4a3b2c]">{valuationKrw.toLocaleString()}원</p>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-stone-500 mb-1.5 block">최소 모집 비율</label>
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
                                        <label className="text-xs text-stone-500 mb-1.5 block">모집 마감</label>
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
                                                    {h}시간
                                                </button>
                                            ))}
                                        </div>
                                        {!isDeadlineValid && deadlineStr && (
                                            <p className="text-[11px] text-red-500 mt-1">10분 이후로 설정해주세요</p>
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
                                <CardTitle className="text-base font-bold text-[#4a3b2c]">발행 미리보기</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">총 발행량</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">1억 개 <span className="text-[11px] font-normal text-stone-400">(고정)</span></p>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">토큰 1개 가격</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">
                                        ₩{tokenPriceKrw < 1 ? tokenPriceKrw.toFixed(4) : tokenPriceKrw.toFixed(1)}
                                    </p>
                                    <p className="text-[11px] text-stone-400">${tokenPriceUsdc < 0.0001 ? tokenPriceUsdc.toFixed(8) : tokenPriceUsdc.toFixed(4)} USDC</p>
                                </div>
                                <div className="bg-stone-50 rounded-xl p-3">
                                    <p className="text-[11px] text-stone-400 mb-0.5">목표 모집액 ({minFundingPct}%)</p>
                                    <p className="text-sm font-bold text-[#4a3b2c]">{formatKrwLabel(targetKrw)}</p>
                                </div>
                                <div className={cn(
                                    "rounded-xl p-3",
                                    apyLevel === "warn" ? "bg-red-50 border border-red-200" :
                                    apyLevel === "high" ? "bg-amber-50 border border-amber-200" :
                                    "bg-stone-50"
                                )}>
                                    <p className="text-[11px] text-stone-400 mb-0.5">예상 APY</p>
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
                                        {apyLevel === "warn" ? "입력값 확인 권장" :
                                         apyLevel === "high" ? "높은 수익률" :
                                         "projected"}
                                    </p>
                                </div>

                                {apyLevel === "warn" && (
                                    <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
                                        예상 APY {previewApyPct.toFixed(0)}% -- 감정가({valuationKrw.toLocaleString()}원)가 숙박가({listing.pricePerNight.toLocaleString()}원/박) 대비 매우 낮습니다. 입력값이 맞는지 확인 후 발행하세요.
                                    </div>
                                )}
                                {apyLevel === "high" && (
                                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
                                        예상 APY {previewApyPct.toFixed(0)}% -- 일반적인 부동산 수익률보다 높습니다. 근거 자료를 갖추는 것을 권장합니다.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Issue button */}
                        <Card className="rounded-3xl border-stone-100 shadow-sm">
                            <CardContent className="pt-6">
                                <p className="text-sm text-stone-400 mb-4">
                                    지갑으로 서명하면 토큰이 발행되고 투자자 모집이 시작됩니다.
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
