interface Props {
    tokenName: string;
    totalSupply: number;
    tokenPrice: number;
    usdcPrice: number;
    valuationKrw: number;
    valuationUsdc: number;
    holders: number;
    soldTokens: number;
    fundingProgress: number;
    apy: number;
}

function fmtKrw(won: number): string {
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억`;
    }
    if (won >= 1_0000) return `${Math.round(won / 1_0000)}만`;
    if (won >= 1) return `${Math.round(won).toLocaleString()}`;
    return won.toFixed(2);
}

export function TokenInfoCard({
    tokenName, totalSupply, tokenPrice, usdcPrice,
    valuationKrw, valuationUsdc,
    holders, soldTokens, fundingProgress, apy,
}: Props) {
    const priceKrwStr = tokenPrice >= 1
        ? `₩${Math.round(tokenPrice).toLocaleString()}`
        : `₩${tokenPrice.toFixed(2)}`;
    const priceUsdcStr = usdcPrice >= 0.01 ? `${usdcPrice.toFixed(2)} USDC`
        : usdcPrice >= 0.0001 ? `${usdcPrice.toFixed(4)} USDC`
            : `${usdcPrice.toFixed(6)} USDC`;

    const valuationKrwStr = `${fmtKrw(valuationKrw)}원`;
    const valuationUsdStr = `$${Math.round(valuationUsdc).toLocaleString()}`;

    const soldPct = Math.min(fundingProgress, 100);
    const barWidth = soldPct < 1 && soldTokens > 0 ? 2 : soldPct;

    const boxes = [
        { label: "Price / Token", primary: priceKrwStr, secondary: priceUsdcStr, green: false },
        { label: "Valuation", primary: valuationKrwStr, secondary: valuationUsdStr, green: false },
        { label: "Est. APY", primary: `${apy}%`, secondary: "projected", green: true },
        { label: "Investors", primary: `${holders}`, secondary: "holders", green: false },
    ];

    return (
        <div className="space-y-4">
            {/* 4-box grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {boxes.map(({ label, primary, secondary, green }) => (
                    <div
                        key={label}
                        className="rounded-2xl p-4 flex flex-col gap-1 bg-stone-50 border border-stone-100"
                    >
                        <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400">{label}</p>
                        <p className={`text-xl font-bold leading-tight ${green ? "text-[#17cf54]" : "text-[#4a3b2c]"}`}>
                            {primary}
                        </p>
                        <p className="text-xs text-stone-400">{secondary}</p>
                    </div>
                ))}
            </div>

            {/* Funding progress */}
            <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Funding Progress</span>
                    <span className="text-sm font-bold text-[#4a3b2c]">
                        {soldTokens.toLocaleString()} / {totalSupply.toLocaleString()} tokens
                    </span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-[#17cf54] transition-all"
                        style={{ width: `${barWidth}%`, minWidth: soldTokens > 0 ? "2px" : "0" }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-xs text-stone-400">
                        {soldPct < 1 && soldTokens > 0 ? `${soldTokens.toLocaleString()} sold` : `${soldPct}% sold`}
                    </span>
                    <span className="text-xs font-semibold text-[#17cf54]">
                        {(totalSupply - soldTokens).toLocaleString()} remaining
                    </span>
                </div>
            </div>
        </div>
    );
}
