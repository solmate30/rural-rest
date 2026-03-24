import { Card } from "~/components/ui-mockup";

interface Props {
    tokenName: string;
    totalSupply: number;
    tokenPrice: number;
    usdcPrice: number;
    totalValuation: string;
    holders: number;
    soldTokens: number;
    fundingProgress: number;
    apy: number;
    lastDividend: string | null;
}

export function TokenInfoCard({
    tokenName, totalSupply, tokenPrice, usdcPrice, totalValuation,
    holders, soldTokens, fundingProgress, apy, lastDividend,
}: Props) {
    const rows = [
        { label: "Token Name",    value: tokenName },
        { label: "Total Supply",  value: `${totalSupply.toLocaleString()} tokens` },
        { label: "Price / Token", value: `₩${tokenPrice.toLocaleString()} (≈${usdcPrice} USDC)` },
        { label: "Valuation",     value: totalValuation },
        { label: "Holders",       value: `${holders} investors` },
    ];

    return (
        <Card className="p-6 shadow-md border border-stone-100 bg-white rounded-2xl">
            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-4">
                Token Information
            </h3>
            <div className="space-y-2.5">
                {rows.map((item) => (
                    <div key={item.label} className="flex justify-between items-center text-sm">
                        <span className="text-stone-500">{item.label}</span>
                        <span className="font-semibold text-stone-800">{item.value}</span>
                    </div>
                ))}

                <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-500">Sold</span>
                    <span className="font-semibold text-stone-800">
                        {soldTokens.toLocaleString()} / {totalSupply.toLocaleString()} ({fundingProgress}%)
                    </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#17cf54]" style={{ width: `${fundingProgress}%` }} />
                </div>

                <div className="border-t border-stone-100 pt-2.5 space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-500">Annual Yield</span>
                        <span className="font-bold text-[#17cf54]">{apy}% (est.)</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-stone-500">Last Dividend</span>
                        <span className="font-semibold text-stone-800">{lastDividend ?? "없음"}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
