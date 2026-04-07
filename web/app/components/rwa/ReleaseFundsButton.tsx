import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
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
    const { t } = useTranslation("admin");
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const [txStatus, setTxStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [step, setStep] = useState<"release" | "activate" | "db">("release");
    const [txSig, setTxSig] = useState("");
    const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "unauthorized" | "unknown">("checking");

    useEffect(() => {
        if (!wallet?.publicKey) {
            setAuthStatus("unknown");
            return;
        }
        let cancelled = false;
        async function checkAuth() {
            try {
                const program = await getProgram(connection, wallet!);
                const rwaConfigPda = await deriveRwaConfigPda();
                const config = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
                if (cancelled) return;
                const walletAddress = wallet!.publicKey.toBase58();
                const isAuthorized =
                    walletAddress === config.authority.toBase58() ||
                    walletAddress === config.crankAuthority.toBase58();
                setAuthStatus(isAuthorized ? "ok" : "unauthorized");
            } catch {
                if (!cancelled) setAuthStatus("unknown");
            }
        }
        checkAuth();
        return () => { cancelled = true; };
    }, [wallet?.publicKey, connection]);

    async function handleRelease() {
        if (!wallet || !wallet.publicKey) return;
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

            const program = await getProgram(connection, wallet!);
            const { propertyToken, fundingVault } = await derivePdas(listingId);
            const rwaConfig = await deriveRwaConfigPda();

            const usdcMint = new PublicKey(USDC_MINT);
            const authority = wallet!.publicKey;
            const authorityUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, authority, false, TOKEN_PROGRAM_ID
            );

            // authority USDC ATA가 없으면 생성
            const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                authority, authorityUsdcAccount, authority, usdcMint, TOKEN_PROGRAM_ID
            );

            // 온체인 상태 확인 후 필요한 instruction만 구성
            const ptData = await (program.account as any).propertyToken.fetch(propertyToken);
            const onchainFunding = !!ptData.status?.funding;
            const onchainFunded = !!ptData.status?.funded;
            const onchainActive = !!ptData.status?.active;

            const { Transaction } = await import("@solana/web3.js");
            const tx = new Transaction().add(createAtaIx);

            if (onchainFunding) {
                // funding → release_funds + activate 둘 다 필요
                tx.add(
                    await program.methods
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
                        .instruction()
                );
                tx.add(
                    await program.methods
                        .activateProperty(listingId)
                        .accounts({
                            propertyToken,
                            operator: authority,
                            rwaConfig,
                            tokenMint: new PublicKey(tokenMint),
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                        })
                        .instruction()
                );
            } else if (onchainFunded) {
                // 이미 release됨 → activate만
                tx.add(
                    await program.methods
                        .activateProperty(listingId)
                        .accounts({
                            propertyToken,
                            operator: authority,
                            rwaConfig,
                            tokenMint: new PublicKey(tokenMint),
                            tokenProgram: TOKEN_2022_PROGRAM_ID,
                        })
                        .instruction()
                );
            }
            // onchainActive면 온체인 tx 불필요, DB sync만 진행

            if (!onchainActive) {
                tx.feePayer = authority;
                tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                const signed = await wallet.signTransaction(tx);
                const sig = await connection.sendRawTransaction(signed.serialize());
                await connection.confirmTransaction(sig, "confirmed");
                setTxSig(sig);
            }

            setStep("activate");

            setStep("db");

            // 3단계: DB 동기화 (순차: funding→funded→active)
            await fetch("/api/rwa/release-funds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId }),
            });
            await fetch("/api/rwa/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId }),
            });

            setTxStatus("done");
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setErrorMsg(parseAnchorError(err, RELEASE_ERRORS));
            setTxStatus("error");
        }
    }

    if (!wallet) {
        return (
            <Button variant="outline" className="w-full py-3" disabled>
                {t("rwa.release.connecting")}
            </Button>
        );
    }

    if (txStatus === "done") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
                <p className="text-sm font-bold text-green-700">{t("rwa.release.activationComplete")}</p>
                <p className="text-xs text-green-600 font-mono">{txSig.slice(0, 16)}...</p>
                <p className="text-xs text-stone-400">{t("rwa.release.reloading")}</p>
            </div>
        );
    }

    const loadingLabel =
        step === "release" ? t("rwa.release.step1") :
        step === "activate" ? t("rwa.release.step2") :
        t("rwa.release.step3");

    return (
        <div className="space-y-3">
            {authStatus === "unauthorized" && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                    <span className="shrink-0 mt-0.5">&#9888;</span>
                    <span>
                        {t("rwa.release.unauthorized")}
                    </span>
                </div>
            )}
            <Button
                onClick={handleRelease}
                disabled={txStatus === "loading" || authStatus === "unauthorized"}
                variant="wood"
                className="w-full py-3"
            >
                {txStatus === "loading" ? loadingLabel : t("rwa.release.button")}
            </Button>
            {txStatus === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
