import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Button } from "~/components/ui/button";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";

interface Props {
    listingId: string;
    rwaTokenId: string;
    tokenMint: string;
    authorityWallet: string | null;
}

const RELEASE_ERRORS: Record<string, string> = {
    "FundsAlreadyReleased": "이미 자금이 해제되었습니다",
    "FundingGoalNotMet": "최소 모집 목표 미달 (기간 중이거나 목표 미달성)",
};

export function ReleaseFundsButton({ listingId, rwaTokenId, tokenMint, authorityWallet }: Props) {
    const walletCtx = useWallet();
    const { connection } = useConnection();
    const [txStatus, setTxStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [step, setStep] = useState<"release" | "activate" | "db">("release");
    const [txSig, setTxSig] = useState("");

    async function handleRelease() {
        if (!walletCtx.publicKey) return;
        setTxStatus("loading");
        setErrorMsg("");
        setStep("release");

        try {
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                createAssociatedTokenAccountIdempotentInstruction,
                TOKEN_PROGRAM_ID,
                TOKEN_2022_PROGRAM_ID,
            } = await import("@solana/spl-token");

            const program = await getProgram(connection, walletCtx);
            const { propertyToken, fundingVault } = await derivePdas(listingId);

            const usdcMint = new PublicKey(USDC_MINT);
            const authority = walletCtx.publicKey;
            const authorityUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, authority, false, TOKEN_PROGRAM_ID
            );

            // authority USDC ATA가 없으면 생성
            const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                authority, authorityUsdcAccount, authority, usdcMint, TOKEN_PROGRAM_ID
            );

            // 1단계: 자금 인출 (funding_vault → authority 지갑, funds_released = true)
            const releaseSig = await program.methods
                .releaseFunds(listingId)
                .accounts({
                    propertyToken,
                    authority,
                    fundingVault,
                    authorityUsdcAccount,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions([createAtaIx])
                .rpc();

            setTxSig(releaseSig);
            setStep("activate");

            // 2단계: 운영 시작 (Funded → Active, 민트 권한 영구 소각)
            await program.methods
                .activateProperty(listingId)
                .accounts({
                    propertyToken,
                    authority,
                    tokenMint: new PublicKey(tokenMint),
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                })
                .rpc();

            setStep("db");

            // 3단계: DB 동기화
            await Promise.all([
                fetch("/api/rwa/release-funds", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rwaTokenId, txSignature: releaseSig }),
                }),
                fetch("/api/rwa/activate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rwaTokenId }),
                }),
            ]);

            setTxStatus("done");
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setErrorMsg(parseAnchorError(err, RELEASE_ERRORS));
            setTxStatus("error");
        }
    }

    if (!walletCtx.connected) {
        return (
            <p className="text-sm text-stone-400 text-center py-2">authority 지갑을 연결하세요.</p>
        );
    }

    if (txStatus === "done") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
                <p className="text-sm font-bold text-green-700">운영이 시작되었습니다</p>
                <p className="text-xs text-green-600 font-mono">{txSig.slice(0, 16)}...</p>
                <p className="text-xs text-stone-400">페이지를 새로고침합니다...</p>
            </div>
        );
    }

    const loadingLabel =
        step === "release" ? "투자금 수령 중... (1/2)" :
        step === "activate" ? "운영 전환 중... (2/2)" :
        "저장 중...";

    return (
        <div className="space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                <span className="font-bold">관리자 전용</span> — 펀딩된 투자금을 수령하고 매물을 <span className="font-bold">운영 상태</span>로 전환합니다. 이후 예약이 오픈됩니다.
            </div>
            <Button
                onClick={handleRelease}
                disabled={txStatus === "loading"}
                variant="wood"
                className="w-full py-3 flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">
                    {txStatus === "loading" ? "hourglass_empty" : "lock_open"}
                </span>
                {txStatus === "loading" ? loadingLabel : "운영 시작"}
            </Button>
            {txStatus === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
