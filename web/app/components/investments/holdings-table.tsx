import { ClaimButton } from "./ClaimButton";
import { CancelPositionButton } from "./CancelPositionButton";
import { RefundButton } from "~/components/rwa/RefundButton";
import { useTranslation } from "react-i18next";

import { fmtUsdc, fmtKrw } from "~/lib/formatters";
import { usePythRate } from "~/hooks/usePythRate";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t } = useTranslation("invest") as any;
    const { rate: krwPerUsdc } = usePythRate();

    if (holdings.length === 0) {
        return (
            <div className="py-16 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                <p className="text-stone-400 font-medium">{t("holdings.empty")}</p>
                <a href="/invest" className="mt-4 inline-block text-sm font-bold text-primary underline underline-offset-2">
                    {t("holdings.emptyLink")}
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
                            <th className="py-3.5 px-5">{t("holdings.colProperty")}</th>
                            <th className="py-3.5 px-5">{t("holdings.colToken")}</th>
                            <th className="py-3.5 px-5 text-right">{t("holdings.colHoldings")}</th>
                            <th className="py-3.5 px-5 text-right">{t("holdings.colValue")}</th>
                            <th className="py-3.5 px-5 text-right">{t("holdings.colDividend")}</th>
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
                                    {h.tokensOwned.toLocaleString()} <span className="text-xs font-normal text-stone-400">{t("holdings.tokens")}</span>
                                </td>
                                <td className="py-4 px-5 text-right text-sm">
                                    <p className="font-semibold text-stone-800">{fmtUsdc(h.totalValue)}</p>
                                    <p className="text-xs text-stone-400">{fmtKrw(h.totalValue * krwPerUsdc)}</p>
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
                                        {h.tokenStatus === "failed" && (
                                            <RefundButton listingId={h.id} rwaTokenId={h.rwaTokenId} />
                                        )}
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
