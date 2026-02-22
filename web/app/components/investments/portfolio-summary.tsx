import { ArrowUpRight, TrendingUp } from "lucide-react";

interface PortfolioSummaryProps {
    totalInvested: number;
    currentValue: number;
    yieldPercent: number;
    totalDividends: number;
}

export function PortfolioSummary({
    totalInvested,
    currentValue,
    yieldPercent,
    totalDividends,
}: PortfolioSummaryProps) {
    const gainLoss = currentValue - totalInvested;
    const gainLossPercent = ((gainLoss / totalInvested) * 100).toFixed(1);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Total Invested */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px] text-stone-500">account_balance_wallet</span>
                    </div>
                    <p className="text-stone-500 text-sm font-bold">Total Invested</p>
                </div>
                <p className="text-[#4a3b2c] text-3xl font-bold">
                    {totalInvested.toLocaleString()}
                    <span className="text-stone-400 text-lg font-normal ml-1.5">USDC</span>
                </p>
            </div>

            {/* Current Value */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#17cf54]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between mb-2 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#17cf54]/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px] text-[#17cf54]">monitoring</span>
                        </div>
                        <p className="text-stone-500 text-sm font-bold">Current Value</p>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${gainLoss >= 0 ? "bg-[#17cf54]/10 text-[#17cf54]" : "bg-red-50 text-red-600"}`}>
                        <span className="material-symbols-outlined text-[14px]">
                            {gainLoss >= 0 ? "trending_up" : "trending_down"}
                        </span>
                        {gainLoss >= 0 ? "+" : ""}{gainLossPercent}%
                    </div>
                </div>
                <p className="text-[#4a3b2c] text-3xl font-bold relative z-10">
                    {currentValue.toLocaleString()}
                    <span className="text-stone-400 text-lg font-normal ml-1.5">USDC</span>
                </p>
            </div>

            {/* Total Dividends */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-[#ab9ff2]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2 mb-2 relative z-10">
                    <div className="w-8 h-8 rounded-full bg-[#ab9ff2]/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px] text-[#ab9ff2]">payments</span>
                    </div>
                    <p className="text-stone-500 text-sm font-bold">Total Dividends</p>
                </div>
                <p className="text-[#17cf54] text-3xl font-bold relative z-10">
                    +{totalDividends.toLocaleString()}
                    <span className="text-stone-400 text-lg font-normal ml-1.5">USDC</span>
                </p>
            </div>
        </div>
    );
}
