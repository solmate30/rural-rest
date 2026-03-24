import { Wallet, Sparkles } from "lucide-react";

const KRW_PER_USDC = 1350;

function fmtUsdc(v: number) {
    if (v === 0) return "0 USDC";
    if (v >= 0.01) return `${v.toFixed(2)} USDC`;
    if (v >= 0.0001) return `${v.toFixed(4)} USDC`;
    return `${v.toFixed(6)} USDC`;
}

function fmtKrw(v: number) {
    if (v >= 1) return `₩${Math.floor(v).toLocaleString()}`;
    return `₩${v.toFixed(2)}`;
}

interface Holding {
    id: string;
    propertyName: string;
    tokenName: string;
    tokensOwned: number;
    totalValue: number; // USDC
    dividendStatus: "claimed" | "pending";
    dividendAmount: number; // USDC
}

interface Props {
    holdings: Holding[];
}

export function HoldingsTable({ holdings }: Props) {
    if (holdings.length === 0) {
        return (
            <div className="py-16 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <p className="text-stone-400 font-medium">아직 보유 중인 토큰이 없습니다.</p>
                <a href="/invest" className="mt-4 inline-block text-sm font-bold text-primary underline underline-offset-2">
                    투자 가능한 매물 보기
                </a>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-stone-50/70 text-stone-400 text-xs font-bold uppercase tracking-wider border-b border-stone-100">
                            <th className="py-3.5 px-5">Property</th>
                            <th className="py-3.5 px-5">Token</th>
                            <th className="py-3.5 px-5 text-right">Holdings</th>
                            <th className="py-3.5 px-5 text-right">Invested</th>
                            <th className="py-3.5 px-5 text-right">Value</th>
                            <th className="py-3.5 px-5" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {holdings.map((h) => (
                            <tr key={h.id} className="hover:bg-stone-50/40 transition-colors">
                                <td className="py-4 px-5 font-semibold text-stone-800 text-sm">{h.propertyName}</td>
                                <td className="py-4 px-5">
                                    <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-500 text-[11px] font-bold font-mono">
                                        {h.tokenName}
                                    </span>
                                </td>
                                <td className="py-4 px-5 text-right text-sm font-semibold text-stone-700">
                                    {h.tokensOwned.toLocaleString()} <span className="text-xs font-normal text-stone-400">tokens</span>
                                </td>
                                <td className="py-4 px-5 text-right text-sm">
                                    <p className="font-semibold text-stone-800">{fmtUsdc(h.totalValue)}</p>
                                    <p className="text-xs text-stone-400">{fmtKrw(h.totalValue * KRW_PER_USDC)}</p>
                                </td>
                                <td className="py-4 px-5 text-right text-sm">
                                    <p className="font-semibold text-stone-800">{fmtUsdc(h.totalValue)}</p>
                                    <p className="text-xs text-stone-400">{fmtKrw(h.totalValue * KRW_PER_USDC)}</p>
                                </td>
                                <td className="py-4 px-5 text-right">
                                    {h.dividendStatus === "pending" ? (
                                        <button
                                            onClick={() => alert("배당금(USDC) 수령 트랜잭션이 시작됩니다.")}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17cf54] text-white text-xs font-bold hover:bg-[#14b847] transition-colors"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            Claim
                                        </button>
                                    ) : (
                                        <span className="text-xs text-stone-300">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
