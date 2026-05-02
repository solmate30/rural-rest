import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";
import { useTranslation } from "react-i18next";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";

interface Props {
    listingId: string;
    rwaTokenId: string;
}

const REFUND_ERRORS: Record<string, string> = {
    "RefundNotAvailable": "Refund not available (funding in progress or goal already met)",
    "AlreadyRefunded": "This position has already been refunded.",
};

export function RefundButton({ listingId, rwaTokenId }: Props) {
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const { toast } = useToast();
    const { t } = useTranslation("invest");
    const [txStatus, setTxStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // 현재 지갑의 투자 정보
    const [myInvestment, setMyInvestment] = useState<{
        investedUsdc: number | null;
        refundTx: string | null;
    } | null>(null);
    const [fetchingInvestment, setFetchingInvestment] = useState(false);

    useEffect(() => {
        if (!wallet?.publicKey) {
            setMyInvestment(null);
            return;
        }
        setFetchingInvestment(true);
        fetch(`/api/rwa/my-investment?rwaTokenId=${encodeURIComponent(rwaTokenId)}&wallet=${wallet.publicKey.toBase58()}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => setMyInvestment(data))
            .catch(() => setMyInvestment(null))
            .finally(() => setFetchingInvestment(false));
    }, [wallet?.publicKey, rwaTokenId]);

    async function handleRefund() {
        if (!wallet || !wallet.publicKey) return;
        setTxStatus("loading");
        setErrorMsg("");

        try {
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");

            const investor = wallet!.publicKey;
            const program = await getProgram(connection, wallet!);
            const seedId = listingId.replace(/-/g, "");
            const { propertyToken, fundingVault, investorPosition } = await derivePdas(listingId, investor);

            const usdcMint = new PublicKey(USDC_MINT);
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );

            const signature = await program.methods
                .refund(seedId)
                .accounts({
                    investor,
                    propertyToken,
                    investorPosition,
                    fundingVault,
                    investorUsdcAccount,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            const walletAddress = investor.toBase58();
            const res = await fetch("/api/rwa/refund", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId, walletAddress, refundTx: signature }),
            });
            if (!res.ok) {
                const data = await res.json();
                setErrorMsg(data.error ?? "DB 기록 실패 (환불은 완료됨)");
                setTxStatus("error");
                return;
            }
            toast({ title: t("refund.successTitle"), description: t("refund.successDesc", { amount: displayUsdc.toFixed(2) }), variant: "success" });
            setTimeout(() => window.location.reload(), 1000);
            return;
        } catch (err: any) {
            if (err?.message?.includes("AlreadyRefunded")) {
                // 온체인에서 이미 환불됨 — DB에도 마킹해서 목록에서 제거
                try {
                    const markRes = await fetch("/api/rwa/mark-refunded", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rwaTokenId }),
                    });
                    if (!markRes.ok) {
                        console.warn("[RefundButton] mark-refunded 실패:", await markRes.text());
                    }
                } catch (markErr) {
                    console.warn("[RefundButton] mark-refunded 요청 실패:", markErr);
                }
                toast({ title: t("refund.successTitle"), description: t("refund.alreadyRefunded"), variant: "success" });
                setTimeout(() => window.location.reload(), 1500);
                return;
            } else {
                setErrorMsg(parseAnchorError(err, REFUND_ERRORS));
                setTxStatus("error");
            }
        }
    }

    if (!wallet) {
        return (
            <p className="text-sm text-stone-400 text-center py-2">{t("purchase.walletLoading")}</p>
        );
    }

    if (fetchingInvestment) {
        return <p className="text-sm text-stone-400 text-center py-2">{t("purchase.balanceLoading")}</p>;
    }

    if (!myInvestment || myInvestment.investedUsdc == null) {
        return null;
    }

    // 이미 환불 완료 — 목록에서 사라지기 전 잠깐 보일 수 있음
    if (myInvestment.refundTx || txStatus === "done") {
        return null;
    }

    // 환불 가능
    const displayUsdc = myInvestment.investedUsdc ?? 0;
    return (
        <div className="space-y-2">
            <Button
                onClick={handleRefund}
                disabled={txStatus === "loading"}
                variant="destructive"
                className="w-full py-3"
            >
                {txStatus === "loading"
                    ? t("refund.processing")
                    : `${t("refund.button")} (${displayUsdc < 0.01 ? displayUsdc.toFixed(6) : displayUsdc.toFixed(2)} USDC)`}
            </Button>
            {txStatus === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
