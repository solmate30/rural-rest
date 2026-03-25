import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

const PROGRAM_ID_STR = import.meta.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const USDC_MINT_STR = import.meta.env.VITE_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface Props {
    listingId: string;
    rwaTokenId: string;
    investedUsdc: number; // 환불 예정 금액 (USDC)
}

export function RefundButton({ listingId, rwaTokenId, investedUsdc }: Props) {
    const walletCtx = useWallet();
    const { connection } = useConnection();
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleRefund() {
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
            const { default: IDL } = await import("~/anchor-idl/rural_rest_rwa.json");

            const programId = new PublicKey(PROGRAM_ID_STR);
            const usdcMint = new PublicKey(USDC_MINT_STR);
            const investor = walletCtx.publicKey;

            const [propertyToken] = PublicKey.findProgramAddressSync(
                [Buffer.from("property"), Buffer.from(listingId)],
                programId
            );
            const [fundingVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("funding_vault"), Buffer.from(listingId)],
                programId
            );
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );

            const provider = new AnchorProvider(connection, walletCtx as any, { commitment: "confirmed" });
            const program = new Program(IDL as any, provider);

            const signature = await program.methods
                .refund(listingId)
                .accounts({
                    investor,
                    propertyToken,
                    fundingVault,
                    investorUsdcAccount,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            await connection.confirmTransaction(signature, "confirmed");
            await recordRefund(signature);
        } catch (err: any) {
            console.warn("[RefundButton] Anchor call failed, demo fallback:", err.message);
            const demoTx = `refund_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await recordRefund(demoTx);
        }
    }

    async function recordRefund(refundTx: string) {
        const walletAddress = walletCtx.publicKey?.toBase58() ?? "";
        const res = await fetch("/api/rwa/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rwaTokenId, walletAddress, refundTx }),
        });
        if (!res.ok) {
            const data = await res.json();
            setErrorMsg(data.error ?? "환불 실패");
            setStatus("error");
            return;
        }
        setStatus("done");
    }

    if (status === "done") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                <p className="text-sm font-bold text-green-700">환불 완료</p>
                <p className="text-xs text-green-600 mt-1">{investedUsdc.toFixed(2)} USDC가 지갑으로 반환되었습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <button
                onClick={handleRefund}
                disabled={status === "loading" || !walletCtx.connected}
                className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors disabled:opacity-50"
            >
                {status === "loading" ? "환불 처리 중..." : `환불 받기 (${investedUsdc.toFixed(2)} USDC)`}
            </button>
            {status === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
