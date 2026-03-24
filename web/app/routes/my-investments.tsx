import { PortfolioSummary } from "../components/investments/portfolio-summary";
import { TokenCard } from "../components/investments/token-card";
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

    const ownedTokens = investmentRows.map((row) => ({
        id: row.id,
        propertyName: row.listingTitle,
        tokenName: `RWA-${row.listingId.slice(-4).toUpperCase()}`,
        tokensOwned: row.tokenAmount,
        totalValue: Math.round((row.tokenAmount * row.pricePerTokenUsdc / 1_000_000) * KRW_PER_USDC),
        dividendStatus: "pending" as const,
        dividendAmount: 0,
    }));

    const totalInvestedKrw = Math.round(
        investmentRows.reduce((sum, r) => sum + r.investedUsdc, 0) / 1_000_000 * KRW_PER_USDC
    );
    const totalDividendsKrw = Math.round(
        dividendRows.reduce((sum, r) => sum + r.dividendUsdc, 0) / 1_000_000 * KRW_PER_USDC
    );
    const avgApy = investmentRows.length > 0
        ? investmentRows.reduce((sum, r) => sum + r.estimatedApyBps, 0) / investmentRows.length / 100
        : 0;

    const portfolioSummary = {
        totalInvested: totalInvestedKrw,
        currentValue: totalInvestedKrw,
        yieldPercent: Math.round(avgApy * 10) / 10,
        totalDividends: totalDividendsKrw,
    };

    const dividendRecords = dividendRows.map((row) => ({
        id: row.id,
        date: row.month,
        propertyName: row.listingTitle,
        amount: Math.round((row.dividendUsdc / 1_000_000) * KRW_PER_USDC),
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
                    <p className="text-stone-500">투자 포트폴리오를 추적하고 수익률을 관리하세요.</p>
                </header>

                <PortfolioSummary {...portfolioSummary} />

                <section className="mb-12">
                    <div className="flex items-baseline justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#4a3b2c] mb-1">Your Holdings</h2>
                            <p className="text-sm text-stone-500">보유 중인 부동산 토큰을 관리하세요</p>
                        </div>
                        <span className="text-sm text-stone-400">{ownedTokens.length}개 자산</span>
                    </div>
                    {ownedTokens.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {ownedTokens.map((token) => (
                                <TokenCard key={token.id} {...token} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-16 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                            <p className="text-stone-400 font-medium">아직 보유 중인 토큰이 없습니다.</p>
                            <a href="/invest" className="mt-4 inline-block text-sm font-bold text-primary underline underline-offset-2">
                                투자 가능한 매물 보기
                            </a>
                        </div>
                    )}
                </section>

                <section>
                    <DividendHistory records={dividendRecords} />
                </section>
            </main>
            <Footer />
        </div>
    );
}
