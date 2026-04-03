import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";

interface Props {
    listingId: string;
    rwaTokenId: string;
}

const REFUND_ERRORS: Record<string, string> = {
    "RefundNotAvailable": "환불 조건 미충족 (펀딩 기간 중이거나 목표가 달성됨)",
    "AlreadyRefunded": "이미 환불 완료된 포지션입니다",
};

export function RefundButton({ listingId, rwaTokenId }: Props) {
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const { toast } = useToast();
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
            const { propertyToken, fundingVault, investorPosition } = await derivePdas(listingId, investor);

            const usdcMint = new PublicKey(USDC_MINT);
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );

            const signature = await program.methods
                .refund(listingId)
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
            toast({ title: "환불 완료", description: `${displayUsdc.toFixed(2)} USDC가 지갑으로 반환되었습니다.`, variant: "success" });
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
                toast({ title: "환불 완료", description: "이미 환불 처리되었습니다.", variant: "success" });
                setTimeout(() => window.location.reload(), 1500);
                return;
            } else {
                setErrorMsg(parseAnchorError(err, REFUND_ERRORS));
                setTxStatus("error");
            }
        }
    }

    // 지갑 미준비
    if (!wallet) {
        return (
            <p className="text-sm text-stone-400 text-center py-2">지갑 준비 중...</p>
        );
    }

    // 투자 정보 로딩 중
    if (fetchingInvestment) {
        return <p className="text-sm text-stone-400 text-center py-2">투자 내역 확인 중...</p>;
    }

    // 투자 내역 없음
    if (!myInvestment || myInvestment.investedUsdc == null) {
        return (
            <p className="text-sm text-stone-400 text-center py-2">이 지갑으로 투자한 내역이 없습니다.</p>
        );
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
                    ? "환불 처리 중..."
                    : `환불 받기 (${displayUsdc < 0.01 ? displayUsdc.toFixed(6) : displayUsdc.toFixed(2)} USDC)`}
            </Button>
            {txStatus === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
