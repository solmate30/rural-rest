import { PortfolioSummary } from "../components/investments/portfolio-summary";
import { HoldingsTable } from "../components/investments/holdings-table";
import { DividendHistory } from "../components/investments/dividend-history";
import { Header, Footer } from "../components/ui-mockup";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/my-investments";
import { db } from "~/db/index.server";
import { listings, rwaTokens, rwaInvestments, rwaDividends } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "~/lib/auth.server";

const KRW_PER_USDC = 1350;

export const meta = () => {
    return [
        { title: "My Portfolio | Rural Rest" },
        { name: "description", content: "View your RWA investments in Rural Rest." },
    ];
};

export async function loader({ request }: Route.LoaderArgs) {
    const currentUser = await requireUser(request);

    const investmentRows = await db
        .select({
            id: rwaInvestments.id,
            rwaTokenId: rwaInvestments.rwaTokenId,
            tokenAmount: rwaInvestments.tokenAmount,
            investedUsdc: rwaInvestments.investedUsdc,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            estimatedApyBps: rwaTokens.estimatedApyBps,
            listingId: listings.id,
            listingTitle: listings.title,
        })
        .from(rwaInvestments)
        .innerJoin(rwaTokens, eq(rwaInvestments.rwaTokenId, rwaTokens.id))
        .innerJoin(listings, eq(rwaTokens.listingId, listings.id))
        .where(eq(rwaInvestments.userId, currentUser.id));

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
        .where(eq(rwaDividends.userId, currentUser.id))
        .orderBy(desc(rwaDividends.createdAt));

    // pending 배당 집계 (토큰별)
    const pendingByToken = new Map<string, number>();
    for (const row of dividendRows) {
        if (!row.claimTx) {
            pendingByToken.set(
                row.rwaTokenId,
                (pendingByToken.get(row.rwaTokenId) ?? 0) + row.dividendUsdc
            );
        }
    }

    // 같은 토큰 여러 번 구매 시 합산
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

    const ownedTokens = Array.from(tokenMap.values()).map((row) => {
        const pendingMicro = pendingByToken.get(row.rwaTokenId) ?? 0;
        const dividendAmountUsdc = pendingMicro / 1_000_000;
        return {
            id: row.listingId,
            propertyName: row.listingTitle,
            tokenName: `RWA-${row.listingId.slice(-4).toUpperCase()}`,
            tokensOwned: row.totalTokenAmount,
            totalValue: row.totalTokenAmount * row.pricePerTokenUsdc / 1_000_000, // USDC
            dividendStatus: dividendAmountUsdc > 0 ? "pending" as const : "claimed" as const,
            dividendAmount: dividendAmountUsdc, // USDC
        };
    });

    const totalInvestedUsdc = investmentRows.reduce((sum, r) => sum + r.investedUsdc, 0) / 1_000_000;
    const totalDividendsUsdc = dividendRows.reduce((sum, r) => sum + r.dividendUsdc, 0) / 1_000_000;
    const avgApy = investmentRows.length > 0
        ? investmentRows.reduce((sum, r) => sum + r.estimatedApyBps, 0) / investmentRows.length / 100
        : 0;

    const portfolioSummary = {
        totalInvested: Math.round(totalInvestedUsdc * 100) / 100,   // USDC
        currentValue: Math.round(totalInvestedUsdc * 100) / 100,    // USDC (가격 변동 미반영)
        yieldPercent: Math.round(avgApy * 10) / 10,
        totalDividends: Math.round(totalDividendsUsdc * 100) / 100, // USDC
    };

    const dividendRecords = dividendRows.map((row) => ({
        id: row.id,
        date: row.month,
        propertyName: row.listingTitle,
        amount: Math.round((row.dividendUsdc / 1_000_000) * 100) / 100, // USDC
        txHash: row.claimTx ?? "",
        status: row.claimTx ? ("Completed" as const) : ("Pending" as const),
    }));

    return { portfolioSummary, ownedTokens, dividendRecords };
}

export default function MyInvestmentsRoute() {
    const { portfolioSummary, ownedTokens, dividendRecords } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto px-4 max-w-5xl pt-24 pb-16">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-[#4a3b2c] mb-2">My Investments</h1>
                    <p className="text-stone-500">Track your portfolio and manage your returns.</p>
                </header>

                <PortfolioSummary {...portfolioSummary} />

                <section className="mb-12">
                    <div className="flex items-baseline justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#4a3b2c] mb-1">Your Holdings</h2>
                            <p className="text-sm text-stone-500">Manage your real estate tokens</p>
                        </div>
                        <span className="text-sm text-stone-400">{ownedTokens.length} assets</span>
                    </div>
                    <HoldingsTable holdings={ownedTokens} />
                </section>

                <section>
                    <DividendHistory records={dividendRecords} />
                </section>
            </main>
            <Footer />
        </div>
    );
}
