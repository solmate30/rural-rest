import { Link, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import { Header, Card, Input } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { listings, rwaTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import { InitializePropertyButton } from "~/components/rwa/InitializePropertyButton";
import { ActivateButton } from "~/components/rwa/ActivateButton";
import { StatusBadge } from "~/components/rwa/StatusBadge";
import type { Route } from "./+types/admin.tokenize";

const TOTAL_SUPPLY = 100_000_000;
const KRW_PER_USDC = 1350;

// ─── Server ──────────────────────────────────────────────────────────────────

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
        })
        .from(listings)
        .where(eq(listings.id, listingId));

    if (!listingRow) throw new Response("Not Found", { status: 404 });

    const [tokenRow] = await db
        .select({
            tokenMint: rwaTokens.tokenMint,
            status: rwaTokens.status,
            id: rwaTokens.id,
        })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, listingId));

    const images = listingRow.images as string[];
    return {
        listing: {
            id: listingRow.id,
            title: listingRow.title,
            location: listingRow.location,
            image: images[0] ?? null,
            valuationKrw: listingRow.valuationKrw ?? 0,
        },
        tokenMint: tokenRow?.tokenMint ?? null,
        tokenStatus: tokenRow?.status ?? null,
        rwaTokenId: tokenRow?.id ?? null,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKrw(won: number): string {
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억 원`;
    }
    if (won >= 1_0000) return `${Math.round(won / 1_0000).toLocaleString()}만 원`;
    return `${won.toLocaleString()}원`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTokenize() {
    const { listing, tokenMint, tokenStatus, rwaTokenId } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
    const valuationKrw = listing.valuationKrw;

    const { minDate, maxDate } = useMemo(() => {
        const now = new Date();
        const toStr = (d: Date) => d.toISOString().split("T")[0];
        return {
            minDate: toStr(new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)),
            maxDate: toStr(new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000)),
        };
    }, []);
    const [minFundingPct, setMinFundingPct] = useState(60);
    const [deadlineStr, setDeadlineStr] = useState(minDate);

    const tokenPriceKrw = valuationKrw / TOTAL_SUPPLY;
    const tokenPriceUsdc = tokenPriceKrw / KRW_PER_USDC;
    const targetKrw = valuationKrw * (minFundingPct / 100);

    const deadlineTs = useMemo(() => {
        if (!deadlineStr) return 0;
        // YYYY-MM-DD를 로컬 자정으로 파싱 (UTC 변환 방지)
        const [y, m, d] = deadlineStr.split("-").map(Number);
        const date = new Date(y, m - 1, d, 23, 59, 59); // 당일 자정 + 1초 전
        return isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
    }, [deadlineStr]);

    const isDeadlineValid = deadlineStr >= minDate && deadlineStr <= maxDate;

    // 발행 완료 상태
    if (tokenMint) {
        return (
            <div className="min-h-screen bg-stone-50/50">
                <Header />
                <main className="container mx-auto py-12 px-4 max-w-3xl">
                    <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
                        ← 대시보드로
                    </Link>
                    <div className="flex items-center gap-5 mb-10">
                        <div className="h-20 w-32 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                            {listing.image
                                ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                : <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">No image</div>
                            }
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{listing.title}</h1>
                            <p className="text-sm text-muted-foreground mt-1">{listing.location}</p>
                        </div>
                    </div>
                    <Card className="p-8 bg-white border-none shadow-sm text-center space-y-4">
                        <StatusBadge status={tokenStatus ?? "funding"} />
                        <p className="text-sm font-medium">Token Mint 주소</p>
                        <p className="text-xs font-mono text-muted-foreground break-all bg-stone-50 p-3 rounded-xl">
                            {tokenMint}
                        </p>
                        <a
                            href={`https://explorer.solana.com/address/${tokenMint}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[#17cf54] hover:underline"
                        >
                            Solana Explorer에서 보기 →
                        </a>
                        {tokenStatus === "funded" && rwaTokenId && (
                            <div className="pt-2 border-t border-stone-100">
                                <p className="text-xs text-muted-foreground mb-3">
                                    펀딩 목표 달성. 운영을 시작하면 투자자 배당이 활성화됩니다.
                                </p>
                                <ActivateButton rwaTokenId={rwaTokenId} />
                            </div>
                        )}
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50/50">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-3xl">
                <Link to="/host" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8">
                    ← 대시보드로
                </Link>

                {/* 매물 요약 */}
                <div className="flex items-center gap-5 mb-10">
                    <div className="h-20 w-32 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                        {listing.image
                            ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">No image</div>
                        }
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{listing.title}</h1>
                        <p className="text-sm text-muted-foreground mt-1">{listing.location}</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* 설정 */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-[#17cf54] rounded-full" />
                            토큰 발행 설정
                        </h2>
                        <Card className="p-6 bg-white border-none shadow-sm space-y-5">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">매물 감정가</label>
                                <p className="text-2xl font-bold text-foreground">{valuationKrw.toLocaleString()}원</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">최소 모집 비율 (%)</label>
                                    <Input
                                        type="number"
                                        value={minFundingPct}
                                        onChange={(e) => setMinFundingPct(Number(e.target.value))}
                                        min={1}
                                        max={100}
                                        step={1}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">모집 마감일</label>
                                    <Input
                                        type="date"
                                        value={deadlineStr}
                                        onChange={(e) => setDeadlineStr(e.target.value)}
                                        min={minDate}
                                        max={maxDate}
                                    />
                                    {!isDeadlineValid && deadlineStr && (
                                        <p className="text-xs text-red-500">오늘 기준 4~8주 이내로 설정해주세요</p>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </section>

                    {/* 자동 계산 */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-stone-300 rounded-full" />
                            자동 계산
                        </h2>
                        <Card className="p-6 bg-white border-none shadow-sm">
                            <div className="grid grid-cols-3 gap-6 text-center">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">총 발행량</p>
                                    <p className="text-lg font-bold">1억 개</p>
                                    <p className="text-xs text-muted-foreground">고정</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">토큰 1개 가격</p>
                                    <p className="text-lg font-bold">₩{tokenPriceKrw.toFixed(1)}</p>
                                    <p className="text-xs text-muted-foreground">${tokenPriceUsdc.toFixed(4)} USDC</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">목표 모집액 ({minFundingPct}%)</p>
                                    <p className="text-lg font-bold">{formatKrw(targetKrw)}</p>
                                </div>
                            </div>
                        </Card>
                    </section>

                    {/* 발행 버튼 */}
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="h-6 w-1 bg-[#17cf54] rounded-full" />
                            온체인 발행
                        </h2>
                        <Card className="p-6 bg-white border-none shadow-sm space-y-3">
                            <p className="text-sm text-muted-foreground">
                                지갑으로 서명하면 토큰이 발행되고 투자 모집이 시작됩니다.
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
                        </Card>
                    </section>
                </div>
            </main>
        </div>
    );
}
