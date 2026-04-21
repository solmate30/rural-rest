import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Button } from "~/components/ui/button";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";

interface Props {
    listingId: string;
    rwaTokenId: string;
    propertyName: string;
    tokensOwned: number;
    refundUsdc: number;
    onCancelled?: () => void;
}

export function CancelPositionButton({ listingId, rwaTokenId, propertyName, tokensOwned, refundUsdc, onCancelled }: Props) {
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleCancel() {
        if (!wallet) return;
        const investor = wallet.publicKey;
        setLoading(true);
        setErrorMsg("");

        try {
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                TOKEN_PROGRAM_ID,
                TOKEN_2022_PROGRAM_ID,
            } = await import("@solana/spl-token");

            const program = await getProgram(connection, wallet);
            const seedId = listingId.replace(/-/g, "");
            const { propertyToken, fundingVault, investorPosition } = await derivePdas(listingId, investor);

            const usdcMint = new PublicKey(USDC_MINT);

            const onchain: any = await (program.account as any).propertyToken.fetch(propertyToken);
            const tokenMint = onchain.tokenMint;

            const investorRwaAccount = getAssociatedTokenAddressSync(
                tokenMint, investor, false, TOKEN_2022_PROGRAM_ID
            );
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, investor, false, TOKEN_PROGRAM_ID
            );

            const signature = await program.methods
                .cancelPosition(seedId)
                .accounts({
                    investor,
                    propertyToken,
                    investorPosition,
                    tokenMint,
                    investorRwaAccount,
                    fundingVault,
                    investorUsdcAccount,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            await fetch("/api/rwa/cancel-position", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId, walletAddress: investor.toBase58(), cancelTx: signature }),
            });

            setStatus("done");
            onCancelled?.();
        } catch (err: any) {
            setErrorMsg(parseAnchorError(err, {
                "FundingExpired": "펀딩 기간이 만료되었습니다",
            }));
            setStatus("error");
        } finally {
            setLoading(false);
        }
    }

    if (status === "done") {
        return <span className="text-xs text-stone-400 font-medium">Withdrawn</span>;
    }

    return (
        <>
            <Button
                onClick={() => setOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl border-stone-200 text-stone-500 text-xs font-bold hover:border-red-300 hover:text-red-500"
            >
                Withdraw
            </Button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={loading ? undefined : () => setOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-xl w-full max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 pt-6 pb-4 border-b border-stone-100 text-center">
                            <h3 className="font-bold text-[#4a3b2c] text-base">Withdraw Investment</h3>
                            <p className="text-xs text-stone-400 mt-0.5 truncate">{propertyName}</p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div className="bg-[#fcfaf7] rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-stone-500">Tokens Held</span>
                                    <span className="font-semibold text-[#4a3b2c]">
                                        {tokensOwned.toLocaleString()} <span className="text-xs font-normal text-stone-400">tokens</span>
                                    </span>
                                </div>
                                <div className="border-t border-stone-200" />
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-stone-500">Refund Amount</span>
                                    <span className="font-bold text-[#17cf54] text-base">
                                        {refundUsdc < 0.01 ? refundUsdc.toFixed(6) : refundUsdc.toFixed(2)}
                                        <span className="text-xs font-normal ml-1">USDC</span>
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-stone-400 text-center">
                                USDC will be returned to your wallet immediately.
                            </p>

                            {status === "error" && (
                                <p className="text-xs text-red-500 text-center font-medium">{errorMsg}</p>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => { setOpen(false); setStatus("idle"); setErrorMsg(""); }}
                                    variant="outline"
                                    className="flex-1 rounded-xl border-stone-200 text-stone-600"
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={handleCancel}
                                    disabled={loading || !wallet}
                                    variant="destructive"
                                    className="flex-1 rounded-xl font-bold"
                                >
                                    {loading ? "Processing..." : "Confirm Withdraw"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
