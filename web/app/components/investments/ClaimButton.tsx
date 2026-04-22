import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Button } from "~/components/ui/button";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";

interface Props {
    listingId: string;
    rwaTokenId: string;
    tokenMint: string;
    walletAddress: string;
    onClaimed?: () => void;
}

export function ClaimButton({ listingId, rwaTokenId, tokenMint, walletAddress, onClaimed }: Props) {
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleClaim() {
        if (!wallet) return;
        const investor = wallet.publicKey;
        setStatus("loading");
        setErrorMsg("");

        try {
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");
            const { SystemProgram } = await import("@solana/web3.js");

            const program = await getProgram(connection, wallet);
            const seedId = listingId.replace(/-/g, "");
            const { propertyToken, investorPosition } = await derivePdas(listingId, investor);

            const usdcMint = new PublicKey(USDC_MINT);
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );
            const usdcVault = getAssociatedTokenAddressSync(
                usdcMint, propertyToken, true, TOKEN_PROGRAM_ID
            );

            const signature = await program.methods
                .claimDividend(seedId)
                .accounts({
                    investor,
                    propertyToken,
                    investorPosition,
                    usdcVault,
                    investorUsdcAccount,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            await connection.confirmTransaction(signature, "confirmed");
            await recordClaim(signature);
        } catch (err: any) {
            console.error("[ClaimButton] 온체인 클레임 실패:", err.message);
            setErrorMsg(parseAnchorError(err));
            setStatus("error");
        }
    }

    async function recordClaim(claimTx: string) {
        const res = await fetch("/api/rwa/claim-dividend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rwaTokenId, walletAddress, claimTx }),
        });
        if (!res.ok) {
            const data = await res.json();
            setErrorMsg(data.error ?? "수령 실패");
            setStatus("error");
            return;
        }
        setStatus("done");
        onClaimed?.();
    }

    if (status === "done") {
        return <span className="text-xs text-[#17cf54] font-bold">수령 완료</span>;
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                onClick={handleClaim}
                disabled={status === "loading" || !wallet}
                size="sm"
                variant="success"
                className="text-xs gap-1.5 shadow-sm shadow-[#17cf54]/20"
            >
                <span className="material-symbols-outlined text-[14px]">payments</span>
                {status === "loading" ? "처리 중..." : "Claim"}
            </Button>
            {status === "error" && (
                <span className="text-[10px] text-red-500">{errorMsg}</span>
            )}
        </div>
    );
}
