import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { PROGRAM_ID, USDC_MINT, TOTAL_SUPPLY, KRW_PER_USDC } from "~/lib/constants";
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
}

type Status = "idle" | "loading" | "done" | "error";

export function InitializePropertyButton({ listingId, values, disabled }: Props) {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { setVisible } = useWalletModal();
    const [status, setStatus] = useState<Status>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleInitialize = async () => {
        if (!wallet.connected || !wallet.publicKey) {
            setVisible(true);
            return;
        }

        setStatus("loading");
        setErrorMsg("");

        try {
            const { BN } = await import("@coral-xyz/anchor");
            const { Keypair, PublicKey } = await import("@solana/web3.js");
            const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

            const program = await getProgram(connection, wallet);
            const { propertyToken, fundingVault } = await derivePdas(listingId);

            const usdcMint = new PublicKey(USDC_MINT);
            const mintKeypair = Keypair.generate();
            const usdcVault = getAssociatedTokenAddressSync(
                usdcMint, propertyToken, true, TOKEN_PROGRAM_ID  // USDC는 표준 SPL
            );

            const pricePerTokenUsdc = Math.round(
                (values.valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000
            );

            const sig = await program.methods
                .initializeProperty(
                    listingId,
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
            setTimeout(() => window.location.reload(), 1200);
        } catch (e: unknown) {
            setErrorMsg(parseAnchorError(e));
            setStatus("error");
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
                    온체인 발행 완료. 페이지를 새로 고침 중...
                </div>
            )}
            <Button
                onClick={handleInitialize}
                disabled={disabled || status === "loading" || status === "done"}
                variant="success"
                size="xl"
                className="w-full shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
            >
                {status === "loading"
                    ? "트랜잭션 전송 중..."
                    : !wallet.connected
                    ? "지갑 연결 후 발행하기"
                    : "발행하기 →"}
            </Button>
            {!wallet.connected && (
                <p className="text-xs text-center text-muted-foreground">
                    Solflare 지갑을 연결하면 Devnet에서 발행할 수 있습니다
                </p>
            )}
        </div>
    );
}
