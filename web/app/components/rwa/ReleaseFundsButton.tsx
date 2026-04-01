import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "~/components/ui/button";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, deriveRwaConfigPda, parseAnchorError } from "~/lib/anchor-client";

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
    const { setVisible } = useWalletModal();
    const [txStatus, setTxStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [step, setStep] = useState<"release" | "activate" | "db">("release");
    const [txSig, setTxSig] = useState("");
    const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "unauthorized" | "unknown">("checking");

    useEffect(() => {
        if (!walletCtx.publicKey) {
            setAuthStatus("unknown");
            return;
        }
        let cancelled = false;
        async function checkAuth() {
            try {
                const program = await getProgram(connection, walletCtx);
                const rwaConfigPda = await deriveRwaConfigPda();
                const config = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
                if (cancelled) return;
                const wallet = walletCtx.publicKey!.toBase58();
                const isAuthorized =
                    wallet === config.authority.toBase58() ||
                    wallet === config.crankAuthority.toBase58();
                setAuthStatus(isAuthorized ? "ok" : "unauthorized");
            } catch {
                if (!cancelled) setAuthStatus("unknown");
            }
        }
        checkAuth();
        return () => { cancelled = true; };
    }, [walletCtx.publicKey, connection]);

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
            const rwaConfig = await deriveRwaConfigPda();

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
                    operator: authority,
                    rwaConfig,
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
                    operator: authority,
                    rwaConfig,
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
            <Button
                variant="outline"
                className="w-full py-3"
                onClick={() => setVisible(true)}
            >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                지갑 연결
            </Button>
        );
    }

    if (txStatus === "done") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
                <p className="text-sm font-bold text-green-700">운영 전환 완료</p>
                <p className="text-xs text-green-600 font-mono">{txSig.slice(0, 16)}...</p>
                <p className="text-xs text-stone-400">페이지를 새로고침합니다...</p>
            </div>
        );
    }

    const loadingLabel =
        step === "release" ? "투자금 수령 중... (1/3)" :
        step === "activate" ? "운영 전환 처리 중... (2/3)" :
        "저장 중... (3/3)";

    return (
        <div className="space-y-3">
            {authStatus === "unauthorized" && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                    <span className="shrink-0 mt-0.5">&#9888;</span>
                    <span>
                        연결된 지갑이 authority 또는 crank 지갑이 아닙니다.
                        트랜잭션이 실패할 수 있습니다.
                    </span>
                </div>
            )}
            <Button
                onClick={handleRelease}
                disabled={txStatus === "loading" || authStatus === "unauthorized"}
                variant="wood"
                className="w-full py-3"
            >
                {txStatus === "loading" ? loadingLabel : "운영 개시"}
            </Button>
            {txStatus === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
