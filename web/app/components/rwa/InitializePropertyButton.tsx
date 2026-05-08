import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";

import { PROGRAM_ID, USDC_MINT, TOTAL_SUPPLY, KRW_PER_USDC_FALLBACK } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";
import { Button } from "~/components/ui/button";

export interface TokenFormValues {
    valuationKrw: number;
    minFundingBps: number;       // e.g. 6000 = 60%
    fundingDeadlineTs: number;   // Unix timestamp (seconds)
}

interface Props {
    listingId: string;
    values: TokenFormValues;
    disabled?: boolean;
    onStatusChange?: (status: Status) => void;
}

type Status = "idle" | "loading" | "done" | "error";

export function InitializePropertyButton({ listingId, values, disabled, onStatusChange }: Props) {
    const { t } = useTranslation("admin");
    const { connection } = useConnection();
    const wallet = usePrivyAnchorWallet();
    const [status, setStatus] = useState<Status>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleInitialize = async () => {
        if (!wallet || !wallet.publicKey) return;

        setStatus("loading");
        onStatusChange?.("loading");
        setErrorMsg("");

        try {
            const { BN } = await import("@coral-xyz/anchor");
            const { Keypair, PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
            const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

            // initialize_property는 여러 계정 생성이 포함되어 SOL(수수료+렌트)이 필요하다.
            // 0 SOL 상태에서 "USDC 부족"으로 오인되는 케이스를 줄이기 위해 사전 점검한다.
            // property_token PDA + funding_vault PDA + USDC vault ATA + token mint
            // 계정 rent 합산 약 0.01 SOL + tx fee 버퍼를 반영한 최소 권장치
            const minSolRequired = 0.02;
            const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
            const solBalance = lamports / LAMPORTS_PER_SOL;
            if (solBalance < minSolRequired) {
                throw new Error(`SOL 잔액이 부족합니다. 최소 ${minSolRequired} SOL 이상 필요합니다. (현재 ${solBalance.toFixed(4)} SOL)`);
            }

            const program = await getProgram(connection, wallet!);
            const seedId = listingId.replace(/-/g, ""); // UUID 36 → 32 bytes
            const { propertyToken, fundingVault } = await derivePdas(listingId);

            const usdcMint = new PublicKey(USDC_MINT);
            const mintKeypair = Keypair.generate();
            const usdcVault = getAssociatedTokenAddressSync(
                usdcMint, propertyToken, true, TOKEN_PROGRAM_ID  // USDC는 표준 SPL
            );

            const pricePerTokenUsdc = Math.round(
                (values.valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC_FALLBACK * 1_000_000
            );

            const sig = await program.methods
                .initializeProperty(
                    seedId,
                    new BN(TOTAL_SUPPLY),
                    new BN(values.valuationKrw),
                    new BN(pricePerTokenUsdc),
                    new BN(values.fundingDeadlineTs),
                    values.minFundingBps,
                )
                .accounts({
                    authority: wallet.publicKey,
                    propertyToken,
                    tokenMint: mintKeypair.publicKey,
                    fundingVault,
                    usdcVault,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,     // RWA 민트용 Token-2022
                    usdcTokenProgram: TOKEN_PROGRAM_ID,     // USDC용 표준 SPL Token
                })
                .signers([mintKeypair])
                .rpc();

            await fetch("/api/rwa/save-mint", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId,
                    tokenMint: mintKeypair.publicKey.toBase58(),
                    valuationKrw: values.valuationKrw,
                    pricePerTokenUsdc,
                    minFundingBps: values.minFundingBps,
                    fundingDeadlineTs: values.fundingDeadlineTs,
                }),
            });

            setStatus("done");
            onStatusChange?.("done");
            setTimeout(() => window.location.reload(), 1200);
        } catch (e: unknown) {
            setErrorMsg(parseAnchorError(e));
            setStatus("error");
            onStatusChange?.("error");
        }
    };

    return (
        <div className="space-y-3">
            {status === "error" && errorMsg && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    {errorMsg}
                </div>
            )}
            {status === "done" && (
                <div className="px-4 py-3 rounded-xl bg-[#17cf54]/10 border border-[#17cf54]/20 text-sm text-[#17cf54] font-medium">
                    {t("rwa.initialize.done")}
                </div>
            )}
            <Button
                onClick={handleInitialize}
                disabled={disabled || !wallet || status === "loading" || status === "done"}
                variant="success"
                size="xl"
                className="w-full shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
                {status === "loading"
                    ? t("rwa.initialize.sending")
                    : !wallet
                    ? t("rwa.initialize.connecting")
                    : t("rwa.initialize.button")}
            </Button>
        </div>
    );
}

