import { useTranslation } from "react-i18next";
import { formatKrwLabel, fmtNumber } from "~/lib/formatters";

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

export function TokenInfoCard({
    tokenName, totalSupply, tokenPrice, usdcPrice,
    valuationKrw, valuationUsdc,
    holders, soldTokens, fundingProgress, apy,
}: Props) {
    const { i18n } = useTranslation();
    const locale = i18n.language;

    const priceKrwStr = tokenPrice >= 1
        ? `₩${fmtNumber(Math.round(tokenPrice), locale)}`
        : tokenPrice >= 0.01 ? `₩${tokenPrice.toFixed(2)}`
        : tokenPrice >= 0.0001 ? `₩${tokenPrice.toFixed(4)}`
        : `₩${tokenPrice.toFixed(6)}`;
    const priceUsdcStr = usdcPrice >= 0.01 ? `${usdcPrice.toFixed(2)} USDC`
        : usdcPrice >= 0.0001 ? `${usdcPrice.toFixed(4)} USDC`
            : `${usdcPrice.toFixed(6)} USDC`;

    const valuationKrwStr = formatKrwLabel(valuationKrw, locale === "en" ? "en" : "ko");
    const valuationUsdStr = `$${fmtNumber(Math.round(valuationUsdc), locale)}`;

    const soldPct = Math.min(fundingProgress, 100);
    const barWidth = soldPct < 1 && soldTokens > 0 ? 2 : soldPct;

    const boxes = [
        { label: "Price / Token", primary: priceKrwStr, secondary: priceUsdcStr, green: false, warn: false },
        { label: "Valuation", primary: valuationKrwStr, secondary: valuationUsdStr, green: false, warn: false },
        { label: "Est. APY", primary: `${apy}%`,
          secondary: apy > 500 ? "예상 수익률 (변동 가능)" : apy > 30 ? "높은 수익률" : "projected",
          green: apy <= 30 && apy > 0, warn: false },
        { label: "Investors", primary: `${holders}`, secondary: "holders", green: false, warn: false },
    ];

    return (
        <div className="space-y-4">
            {/* 4-box grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {boxes.map(({ label, primary, secondary, green, warn }) => (
                    <div
                        key={label}
                        className={`rounded-2xl p-4 flex flex-col gap-1 border ${warn ? "bg-amber-50 border-amber-200" : "bg-stone-50 border-stone-100"}`}
                    >
                        <p className="text-xs uppercase font-bold tracking-wider text-stone-400">{label}</p>
                        <p className={`text-xl font-bold leading-tight ${warn ? "text-amber-500" : green ? "text-invest" : "text-[#4a3b2c]"}`}>
                            {primary}
                        </p>
                        <p className={`text-xs ${warn ? "text-amber-500" : "text-stone-400"}`}>{secondary}</p>
                    </div>
                ))}
            </div>

            {/* Funding progress */}
            <div className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm">
                <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Funding Progress</span>
                    <span className="text-sm font-bold text-[#4a3b2c]">
                        {fmtNumber(soldTokens, locale)} / {fmtNumber(totalSupply, locale)} tokens
                    </span>
                </div>
                <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-invest transition-all"
                        style={{ width: `${barWidth}%`, minWidth: soldTokens > 0 ? "2px" : "0" }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-xs text-stone-400">
                        {soldPct < 1 && soldTokens > 0 ? `${fmtNumber(soldTokens, locale)} sold` : `${soldPct}% sold`}
                    </span>
                    <span className="text-xs font-semibold text-invest">
                        {fmtNumber(totalSupply - soldTokens, locale)} remaining
                    </span>
                </div>
            </div>
        </div>
    );
}
