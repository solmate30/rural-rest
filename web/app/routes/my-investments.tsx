import { PortfolioSummary } from "../components/investments/portfolio-summary";
import { TokenCard } from "../components/investments/token-card";
import { DividendHistory } from "../components/investments/dividend-history";
import { Header, Footer } from "../components/ui-mockup";

export const meta = () => {
    return [
        { title: "My Portfolio | Rural Rest" },
        { name: "description", content: "View your RWA investments in Rural Rest." },
    ];
};

// Mock data for demonstration purposes
const mockPortfolioSummary = {
    totalInvested: 3700,
    currentValue: 3959,
    yieldPercent: 7.2,
    totalDividends: 250,
};

const mockOwnedTokens = [
    {
        id: "1",
        propertyName: "양평 돌담 고택",
        tokenName: "YANG-001",
        tokensOwned: 50,
        totalValue: 2500,
        dividendStatus: "claimed" as const,
        dividendAmount: 205,
    },
    {
        id: "2",
        propertyName: "고성 바다 한옥",
        tokenName: "GOS-002",
        tokensOwned: 30,
        totalValue: 1200,
        dividendStatus: "pending" as const,
        dividendAmount: 45,
    },
];

const mockDividendRecords = [
    {
        id: "div-1",
        date: "2026-01-15",
        propertyName: "양평 돌담 고택",
        amount: 205,
        txHash: "4Tyz8kXWJ3oRzZp9QvKmN8LpYdF2sH6rT3xW9cBnVhMg",
        status: "Completed" as const,
    },
    {
        id: "div-2",
        date: "2026-02-01",
        propertyName: "고성 바다 한옥",
        amount: 45,
        txHash: "7bK9mP2vLpR5tX8oWqC4fJ6hN3dY1zAaS9gVnMkTrBpL",
        status: "Pending" as const,
    },
];

export default function MyInvestmentsRoute() {
    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto px-4 max-w-5xl pt-24 pb-16">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-[#4a3b2c] mb-2">My Investments</h1>
                    <p className="text-stone-500">투자 포트폴리오를 추적하고 수익률을 관리하세요.</p>
                </header>

                {/* Portfolio Summary Section */}
                <PortfolioSummary {...mockPortfolioSummary} />

                {/* Owned Tokens Section */}
                <section className="mb-12">
                    <div className="flex items-baseline justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#4a3b2c] mb-1">Your Holdings</h2>
                            <p className="text-sm text-stone-500">보유 중인 부동산 토큰을 관리하세요</p>
                        </div>
                        <span className="text-sm text-stone-400">
                            {mockOwnedTokens.length}개 자산
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {mockOwnedTokens.map((token) => (
                            <TokenCard key={token.id} {...token} />
                        ))}
                    </div>
                </section>

                {/* Dividend History Section */}
                <section>
                    <DividendHistory records={mockDividendRecords} />
                </section>
            </main>
            <Footer />
        </div>
    );
}
