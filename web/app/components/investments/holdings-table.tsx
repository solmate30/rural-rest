import { ClaimButton } from "./ClaimButton";
import { CancelPositionButton } from "./CancelPositionButton";
import { RefundButton } from "~/components/rwa/RefundButton";

import { KRW_PER_USDC } from "~/lib/constants";
import { fmtUsdc, fmtKrw } from "~/lib/formatters";

interface Holding {
    id: string;          // listingId
    rwaTokenId: string;
    tokenMint: string;
    propertyName: string;
    tokenName: string;
    tokensOwned: number;
    totalValue: number;  // USDC
    dividendStatus: "claimed" | "pending";
    dividendAmount: number; // USDC
    tokenStatus: string;
    totalSupply: number;
    minFundingBps: number;
    fundingDeadlineMs: number;
}

interface Props {
    holdings: Holding[];
    walletAddress: string;
}

export function HoldingsTable({ holdings, walletAddress }: Props) {
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
                            <th className="py-3.5 px-5 text-right">Value</th>
                            <th className="py-3.5 px-5 text-right">Pending Dividend</th>
                            <th className="py-3.5 px-5" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {holdings.map((h) => (
                            <tr key={h.id} className="hover:bg-stone-50/40 transition-colors cursor-pointer" onClick={() => window.location.href = `/invest/${h.id}`}>
                                <td className="py-4 px-5 font-semibold text-stone-800 text-sm hover:text-primary transition-colors">{h.propertyName}</td>
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
                                    {h.dividendStatus === "pending" ? (
                                        <p className="font-semibold text-amber-600">{fmtUsdc(h.dividendAmount)}</p>
                                    ) : (
                                        <span className="text-xs text-stone-300">—</span>
                                    )}
                                </td>
                                <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-col items-end gap-1.5">
                                        {h.dividendStatus === "pending" && (
                                            <ClaimButton
                                                listingId={h.id}
                                                rwaTokenId={h.rwaTokenId}
                                                tokenMint={h.tokenMint}
                                                walletAddress={walletAddress}
                                                onClaimed={() => window.location.reload()}
                                            />
                                        )}
                                        {(h.tokenStatus === "funding" || h.tokenStatus === "funded") &&
                                            Date.now() <= h.fundingDeadlineMs && (
                                            <CancelPositionButton
                                                listingId={h.id}
                                                rwaTokenId={h.rwaTokenId}
                                                propertyName={h.propertyName}
                                                tokensOwned={h.tokensOwned}
                                                refundUsdc={h.totalValue}
                                                onCancelled={() => window.location.reload()}
                                            />
                                        )}
                                        {(() => {
                                            const deadlineExpired = Date.now() > h.fundingDeadlineMs;
                                            const isRefundable = h.tokenStatus === "failed" ||
                                                (h.tokenStatus === "funding" && deadlineExpired);
                                            return isRefundable ? (
                                                <RefundButton listingId={h.id} rwaTokenId={h.rwaTokenId} />
                                            ) : null;
                                        })()}
                                        {h.dividendStatus !== "pending" &&
                                            !(h.tokenStatus === "funding" || h.tokenStatus === "funded") &&
                                            h.tokenStatus !== "failed" && (
                                            <span className="text-xs text-stone-300">—</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
