import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

const PROGRAM_ID_STR = import.meta.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const USDC_MINT_STR = import.meta.env.VITE_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface Props {
    listingId: string;
    rwaTokenId: string;
    tokenMint: string;
    walletAddress: string;
    onClaimed?: () => void;
}

export function ClaimButton({ listingId, rwaTokenId, tokenMint, walletAddress, onClaimed }: Props) {
    const walletCtx = useWallet();
    const { connection } = useConnection();
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleClaim() {
        if (!walletCtx.publicKey) return;
        setStatus("loading");
        setErrorMsg("");

        try {
            const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");
            const { SystemProgram } = await import("@solana/web3.js");
            const { default: IDL } = await import("~/anchor-idl/rural_rest_rwa.json");

            const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

            const programId = new PublicKey(PROGRAM_ID_STR);
            const usdcMint = new PublicKey(USDC_MINT_STR);
            const investor = walletCtx.publicKey;

            const [propertyToken] = PublicKey.findProgramAddressSync(
                [Buffer.from("property"), Buffer.from(listingId)],
                programId
            );
            const [investorPosition] = PublicKey.findProgramAddressSync(
                [Buffer.from("investor"), propertyToken.toBuffer(), investor.toBuffer()],
                programId
            );
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );
            // usdcVault: propertyToken의 USDC ATA (배당 적립 vault)
            const usdcVault = getAssociatedTokenAddressSync(
                usdcMint, propertyToken, true, TOKEN_PROGRAM_ID
            );

            const provider = new AnchorProvider(connection, walletCtx as any, { commitment: "confirmed" });
            const program = new Program(IDL as any, provider);

            const signature = await program.methods
                .claimDividend(listingId)
                .accounts({
                    investor,
                    propertyToken,
                    investorPosition,
                    usdcVault,
                    investorUsdcAccount,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            await connection.confirmTransaction(signature, "confirmed");
            await recordClaim(signature);
        } catch (err: any) {
            console.error("[ClaimButton] 온체인 클레임 실패:", err.message);
            setErrorMsg(err.message?.slice(0, 80) ?? "트랜잭션 실패");
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
            <button
                onClick={handleClaim}
                disabled={status === "loading"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17cf54] text-white text-xs font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
            >
                <Sparkles className="w-3 h-3" />
                {status === "loading" ? "처리 중..." : "Claim"}
            </button>
            {status === "error" && (
                <span className="text-[10px] text-red-500">{errorMsg}</span>
            )}
        </div>
    );
}
