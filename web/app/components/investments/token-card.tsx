import { Link } from "react-router";
import { ChevronRight, Clock, CheckCircle2, Wallet, Sparkles } from "lucide-react";

interface TokenCardProps {
    id: string;
    propertyName: string;
    tokenName: string;
    tokensOwned: number;
    totalValue: number; // in USDC
    dividendStatus: "claimed" | "pending";
    dividendAmount: number; // in USDC
}

export function TokenCard({
    id,
    propertyName,
    tokenName,
    tokensOwned,
    totalValue,
    dividendStatus,
    dividendAmount,
}: TokenCardProps) {
    // 1 USDC = 1,490 KRW 로 가정 (UI 목업용)
    const exchangeRate = 1490;
    const totalValueKrw = totalValue * exchangeRate;
    const dividendAmountKrw = dividendAmount * exchangeRate;

    return (
        <div className="group relative bg-white rounded-[24px] border border-stone-200/60 hover:border-stone-300 hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col">
            {/* Top Section */}
            <div className="p-6 pb-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-stone-900 group-hover:text-stone-700 transition-colors line-clamp-1">
                            {propertyName}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-2.5 py-0.5 rounded-md bg-stone-100/80 text-stone-600 text-[11px] font-bold tracking-wider font-mono">
                                {tokenName}
                            </span>
                        </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-stone-50 flex items-center justify-center border border-stone-100 shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-stone-400">real_estate_agent</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-stone-500">보유 수량</span>
                        <span className="text-base font-bold text-stone-800">{tokensOwned.toLocaleString()} <span className="text-xs font-normal text-stone-500">tokens</span></span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-stone-500">투자금</span>
                        <div className="text-right">
                            <p className="text-base font-bold text-stone-800">
                                ₩{Math.floor(totalValueKrw).toLocaleString()}
                            </p>
                            <p className="text-[11px] text-stone-400 font-medium">
                                ≈ {totalValue.toLocaleString()} USDC
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent opacity-50"></div>

            {/* Dividend Section */}
            <div className="p-6 bg-stone-50/50 flex flex-col flex-1">
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-stone-400 tracking-wider uppercase">Dividend</span>
                        {dividendStatus === "claimed" ? (
                            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Claimed
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-[11px] font-bold animate-pulse">
                                <Sparkles className="w-3.5 h-3.5" />
                                Pending
                            </div>
                        )}
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className={`text-xl font-extrabold ${dividendStatus === 'claimed' ? 'text-stone-400' : 'text-[#17cf54]'}`}>
                                ₩{Math.floor(dividendAmountKrw).toLocaleString()}
                            </p>
                            <p className="text-xs text-stone-400 font-medium mt-0.5">
                                ≈ {dividendAmount.toLocaleString()} USDC
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2.5 mt-auto pt-2">
                    <Link
                        to={`/invest/${id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-stone-200/80 bg-white text-stone-600 text-sm font-bold hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm"
                    >
                        View
                        <ChevronRight className="w-4 h-4 text-stone-400" />
                    </Link>
                    {dividendStatus === "pending" && (
                        <button
                            onClick={() => {
                                alert("배당금(USDC) 수령 트랜잭션이 시작됩니다.");
                            }}
                            className="flex-[1.5] h-11 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] shadow-md shadow-[#17cf54]/20 hover:shadow-lg hover:shadow-[#17cf54]/30 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                        >
                            <Wallet className="w-4 h-4" />
                            Claim Dividend
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
