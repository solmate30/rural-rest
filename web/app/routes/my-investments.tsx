import { PortfolioSummary } from "../components/investments/portfolio-summary";
import { HoldingsTable } from "../components/investments/holdings-table";
import { DividendHistory } from "../components/investments/dividend-history";
import { Header, Footer } from "../components/ui-mockup";
import { useLoaderData, useSearchParams } from "react-router";
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { Route } from "./+types/my-investments";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, rwaDividends } from "~/db/schema";
import { eq, desc } from "drizzle-orm";

export const meta = () => {
    return [
        { title: "My Portfolio | Rural Rest" },
        { name: "description", content: "View your RWA investments in Rural Rest." },
    ];
};

const EMPTY = {
    portfolioSummary: { totalInvested: 0, currentValue: 0, yieldPercent: 0, totalDividends: 0 },
    ownedTokens: [] as ReturnType<typeof buildOwnedTokens>,
    dividendRecords: [] as ReturnType<typeof buildDividendRecords>,
};

function buildOwnedTokens(
    investmentRows: { rwaTokenId: string; tokenAmount: number; investedUsdc: number; pricePerTokenUsdc: number; estimatedApyBps: number; listingId: string; listingTitle: string; tokenMint: string }[],
    pendingByToken: Map<string, number>
) {
    const tokenMap = new Map<string, typeof investmentRows[0] & { totalTokenAmount: number; totalInvestedMicro: number }>();
    for (const row of investmentRows) {
        const existing = tokenMap.get(row.rwaTokenId);
        if (existing) {
            existing.totalTokenAmount += row.tokenAmount;
            existing.totalInvestedMicro += row.investedUsdc;
        } else {
            tokenMap.set(row.rwaTokenId, { ...row, totalTokenAmount: row.tokenAmount, totalInvestedMicro: row.investedUsdc });
        }
    }
    return Array.from(tokenMap.values()).map((row) => {
        const pendingMicro = pendingByToken.get(row.rwaTokenId) ?? 0;
        const dividendAmountUsdc = pendingMicro / 1_000_000;
        return {
            id: row.listingId,
            rwaTokenId: row.rwaTokenId,
            tokenMint: row.tokenMint,
            propertyName: row.listingTitle,
            tokenName: `RWA-${row.listingId.slice(-4).toUpperCase()}`,
            tokensOwned: row.totalTokenAmount,
            totalValue: row.totalTokenAmount * row.pricePerTokenUsdc / 1_000_000,
            dividendStatus: dividendAmountUsdc > 0 ? "pending" as const : "claimed" as const,
            dividendAmount: dividendAmountUsdc,
        };
    });
}

function buildDividendRecords(
    dividendRows: { id: string; rwaTokenId: string; month: string; dividendUsdc: number; claimTx: string | null; listingTitle: string }[]
) {
    return dividendRows.map((row) => ({
        id: row.id,
        date: row.month,
        propertyName: row.listingTitle,
        amount: Math.round((row.dividendUsdc / 1_000_000) * 100) / 100,
        txHash: row.claimTx ?? "",
        status: row.claimTx ? ("Completed" as const) : ("Pending" as const),
    }));
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const walletAddress = url.searchParams.get("wallet");

    if (!walletAddress) return EMPTY;

    const investmentRows = await db
        .select({
            id: rwaInvestments.id,
            rwaTokenId: rwaInvestments.rwaTokenId,
            tokenAmount: rwaInvestments.tokenAmount,
            investedUsdc: rwaInvestments.investedUsdc,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            estimatedApyBps: rwaTokens.estimatedApyBps,
            tokenMint: rwaTokens.tokenMint,
            listingId: listings.id,
            listingTitle: listings.title,
        })
        .from(rwaInvestments)
        .innerJoin(rwaTokens, eq(rwaInvestments.rwaTokenId, rwaTokens.id))
        .innerJoin(listings, eq(rwaTokens.listingId, listings.id))
        .where(eq(rwaInvestments.walletAddress, walletAddress));

    const dividendRows = await db
        .select({
            id: rwaDividends.id,
            rwaTokenId: rwaDividends.rwaTokenId,
            month: rwaDividends.month,
            dividendUsdc: rwaDividends.dividendUsdc,
            claimTx: rwaDividends.claimTx,
            listingTitle: listings.title,
        })
        .from(rwaDividends)
        .innerJoin(rwaTokens, eq(rwaDividends.rwaTokenId, rwaTokens.id))
        .innerJoin(listings, eq(rwaTokens.listingId, listings.id))
        .where(eq(rwaDividends.walletAddress, walletAddress))
        .orderBy(desc(rwaDividends.createdAt));

    const pendingByToken = new Map<string, number>();
    for (const row of dividendRows) {
        if (!row.claimTx) {
            pendingByToken.set(row.rwaTokenId, (pendingByToken.get(row.rwaTokenId) ?? 0) + row.dividendUsdc);
        }
    }

    const totalInvestedUsdc = investmentRows.reduce((sum, r) => sum + r.investedUsdc, 0) / 1_000_000;
    const totalDividendsUsdc = dividendRows.reduce((sum, r) => sum + r.dividendUsdc, 0) / 1_000_000;
    const avgApy = investmentRows.length > 0
        ? investmentRows.reduce((sum, r) => sum + r.estimatedApyBps, 0) / investmentRows.length / 100
        : 0;

    const ownedTokens = buildOwnedTokens(
        investmentRows.map(r => ({ ...r, tokenMint: r.tokenMint ?? "" })),
        pendingByToken
    );
    const currentValueUsdc = ownedTokens.reduce((sum, t) => sum + t.totalValue, 0);

    return {
        portfolioSummary: {
            totalInvested: Math.round(totalInvestedUsdc * 100) / 100,
            currentValue: Math.round(currentValueUsdc * 100) / 100,
            yieldPercent: Math.round(avgApy * 10) / 10,
            totalDividends: Math.round(totalDividendsUsdc * 100) / 100,
        },
        ownedTokens,
        dividendRecords: buildDividendRecords(dividendRows),
    };
}

export default function MyInvestmentsRoute() {
    const { portfolioSummary, ownedTokens, dividendRecords } = useLoaderData<typeof loader>();
    const { publicKey } = useWallet();
    const { setVisible } = useWalletModal();
    const [searchParams, setSearchParams] = useSearchParams();

    // 지갑 연결되면 URL에 wallet 파라미터 자동 추가 → 로더 재실행
    useEffect(() => {
        if (publicKey) {
            const current = searchParams.get("wallet");
            if (current !== publicKey.toBase58()) {
                setSearchParams({ wallet: publicKey.toBase58() }, { replace: true });
            }
        }
    }, [publicKey]);

    const walletParam = searchParams.get("wallet");

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto px-4 max-w-5xl pt-24 pb-16">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-[#4a3b2c] mb-2">My Investments</h1>
                    <p className="text-stone-500">Track your portfolio and manage your returns.</p>
                </header>

                {!walletParam ? (
                    <div className="py-24 text-center">
                        <span className="material-symbols-outlined text-[56px] text-stone-300">account_balance_wallet</span>
                        <p className="text-stone-500 mt-4 mb-6 font-medium">Connect your wallet to view your portfolio.</p>
                        <button
                            onClick={() => setVisible(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#17cf54] text-white font-bold hover:bg-[#14b847] transition-all shadow-lg shadow-[#17cf54]/20"
                        >
                            Connect Wallet
                        </button>
                    </div>
                ) : (
                    <>
                        <PortfolioSummary {...portfolioSummary} />

                        <section className="mb-12">
                            <div className="flex items-baseline justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-[#4a3b2c] mb-1">Your Holdings</h2>
                                    <p className="text-sm text-stone-500">Manage your real estate tokens</p>
                                </div>
                                <span className="text-sm text-stone-400">{ownedTokens.length} assets</span>
                            </div>
                            <HoldingsTable holdings={ownedTokens} walletAddress={walletParam ?? ""} />
                        </section>

                        <section>
                            <DividendHistory records={dividendRecords} />
                        </section>
                    </>
                )}
            </main>
            <Footer />
        </div>
    );
}
