import { Card } from "~/components/ui-mockup";

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
    lastDividend: string | null;
}

function fmtKrw(won: number): string {
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억 원`;
    }
    if (won >= 1_0000) return `${Math.round(won / 1_0000)}만 원`;
    if (won >= 1) return `${Math.round(won).toLocaleString()}원`;
    return `₩${won.toFixed(2)}`;
}

export function TokenInfoCard({
    tokenName, totalSupply, tokenPrice, usdcPrice,
    valuationKrw, valuationUsdc,
    holders, soldTokens, fundingProgress, apy, lastDividend,
}: Props) {
    const priceKrw = tokenPrice >= 1 ? `₩${Math.round(tokenPrice).toLocaleString()}` : `₩${tokenPrice.toFixed(2)}`;
    const priceUsdc = usdcPrice >= 0.01 ? `${usdcPrice.toFixed(2)} USDC`
        : usdcPrice >= 0.0001 ? `${usdcPrice.toFixed(4)} USDC`
        : `${usdcPrice.toFixed(6)} USDC`;

    const rows = [
        { label: "Token Name",    value: tokenName },
        { label: "Total Supply",  value: `${totalSupply.toLocaleString()} tokens` },
        { label: "Price / Token", value: priceKrw, sub: priceUsdc },
        { label: "Valuation",     value: fmtKrw(valuationKrw), sub: `$${Math.round(valuationUsdc).toLocaleString()}` },
        { label: "Holders",       value: `${holders} investors` },
    ];

    return (
        <Card className="p-6 shadow-md border border-stone-100 bg-white rounded-2xl">
            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-4">
                Token Information
            </h3>
            <div className="space-y-2.5">
                {rows.map((item) => (
                    <div key={item.label} className="flex justify-between items-start text-sm">
                        <span className="text-stone-500 shrink-0">{item.label}</span>
                        <span className="font-semibold text-stone-800 text-right">
                            {item.value}
                            {"sub" in item && item.sub && (
                                <span className="block text-xs font-normal text-stone-400">{item.sub}</span>
                            )}
                        </span>
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
