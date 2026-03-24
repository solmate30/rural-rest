import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Card, Input } from "~/components/ui-mockup";
import { useToast } from "~/hooks/use-toast";
import { useKyc } from "~/components/KycProvider";

function useCountdown(deadlineMs: number) {
    const calc = () => {
        const diff = deadlineMs - Date.now();
        if (diff <= 0) return null;
        return {
            days: Math.floor(diff / 86400000),
            hours: Math.floor((diff % 86400000) / 3600000),
            minutes: Math.floor((diff % 3600000) / 60000),
            seconds: Math.floor((diff % 60000) / 1000),
        };
    };
    const [t, setT] = useState(calc);
    useEffect(() => {
        const id = setInterval(() => setT(calc()), 1000);
        return () => clearInterval(id);
    }, [deadlineMs]);
    return t;
}

const PROGRAM_ID_STR = import.meta.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
const USDC_MINT_STR = import.meta.env.VITE_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

function fmtUsdc(usdc: number): string {
    if (usdc === 0) return "0 USDC";
    if (usdc >= 0.01) return `${usdc.toFixed(2)} USDC`;
    if (usdc >= 0.0001) return `${usdc.toFixed(4)} USDC`;
    return `${usdc.toFixed(6)} USDC`;
}

interface Props {
    listingId: string;
    tokenMint: string | null;
    tokenId: string;
    tokenName: string;
    tokenPrice: number;
    usdcPrice: number;
    apy: number;
    fundingProgress: number;
    availableTokens: number;
    holders: number;
    soldTokens: number;
    fundingDeadlineMs: number;
}

export function PurchaseCard({
    listingId, tokenMint, tokenId,
    tokenName, tokenPrice, usdcPrice, apy, fundingProgress, availableTokens,
    holders, soldTokens, fundingDeadlineMs,
}: Props) {
    const walletCtx = useWallet();
    const { connected, publicKey } = walletCtx;
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isKycCompleted } = useKyc();

    const [tokenCount, setTokenCount] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    const subtotalUsdc = usdcPrice * tokenCount;
    const subtotalKrw = tokenPrice * tokenCount;
    const estAnnualReturn = subtotalKrw * (apy / 100);
    const isSoldOut = fundingProgress >= 100;
    const isNotMinted = !tokenMint;

    const handleInvest = async () => {
        if (!publicKey || !tokenMint) return;
        setIsProcessing(true);
        try {
            const { Program, AnchorProvider, BN } = await import("@coral-xyz/anchor");
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                createAssociatedTokenAccountIdempotentInstruction,
                TOKEN_2022_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");
            const { default: IDL } = await import("~/anchor-idl/rural_rest_rwa.json");

            const programId = new PublicKey(PROGRAM_ID_STR);
            const usdcMint = new PublicKey(USDC_MINT_STR);
            const tokenMintPubkey = new PublicKey(tokenMint);

            // PDAs
            const [propertyToken] = PublicKey.findProgramAddressSync(
                [Buffer.from("property"), Buffer.from(listingId)],
                programId
            );
            const [fundingVault] = PublicKey.findProgramAddressSync(
                [Buffer.from("funding_vault"), Buffer.from(listingId)],
                programId
            );

            // ATAs
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, publicKey, false, TOKEN_PROGRAM_ID
            );
            const investorRwaAccount = getAssociatedTokenAddressSync(
                tokenMintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID
            );

            // investor_usdc_account — 없으면 생성 (idempotent: 이미 있어도 no-op)
            const createUsdcAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                publicKey, investorUsdcAccount, publicKey, usdcMint, TOKEN_PROGRAM_ID
            );

            const provider = new AnchorProvider(connection, walletCtx as any, { commitment: "confirmed" });
            const program = new Program(IDL as any, provider);

            const signature = await program.methods
                .purchaseTokens(listingId, new BN(tokenCount))
                .accounts({
                    investor: publicKey,
                    propertyToken,
                    tokenMint: tokenMintPubkey,
                    investorUsdcAccount,
                    fundingVault,
                    investorRwaAccount,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions([createUsdcAtaIx])
                .rpc();

            await connection.confirmTransaction(signature, "confirmed");

            // DB 기록
            const dbRes = await fetch("/api/rwa/record-purchase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rwaTokenId: tokenId,
                    tokenAmount: tokenCount,
                    investedUsdc: Math.round(subtotalUsdc * 1_000_000),
                    purchaseTx: signature,
                    investorWallet: publicKey.toBase58(),
                }),
            });
            if (!dbRes.ok) {
                console.error("[PurchaseCard] record-purchase failed:", dbRes.status, await dbRes.text());
            }

            toast({
                title: "Investment Complete!",
                description: `${tokenCount} tokens purchased. (tx: ${signature.slice(0, 8)}...)`,
                variant: "success",
            });
        } catch (err: any) {
            console.error("[PurchaseCard] tx error:", err);
            const errStr = err?.message ?? String(err);
            const msg = errStr.includes("0x1") ? "Insufficient USDC balance."
                : errStr.includes("User rejected") ? "Transaction rejected by wallet."
                : `Failed: ${errStr.slice(0, 80)}`;
            toast({ title: "결제 실패", description: msg, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const countdown = useCountdown(fundingDeadlineMs);

    return (
        <Card className="p-6 shadow-2xl border-none bg-white rounded-3xl space-y-4">
            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Purchase Tokens</h3>

            {/* Token Input */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-stone-600">Amount</label>
                    <span className="text-xs text-stone-400">Available: {availableTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.max(1, c - 1))}
                        disabled={isSoldOut || isNotMinted}
                    >−</button>
                    <Input
                        type="number"
                        min="1"
                        value={tokenCount}
                        onChange={(e) => setTokenCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, availableTokens)))}
                        className="text-center text-lg font-semibold disabled:opacity-50"
                        disabled={isSoldOut || isNotMinted}
                    />
                    <button
                        className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.min(c + 1, availableTokens))}
                        disabled={isSoldOut || isNotMinted || tokenCount >= availableTokens}
                    >+</button>
                </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-600">
                    <span>{tokenCount} tokens × {tokenPrice >= 1 ? `₩${Math.round(tokenPrice).toLocaleString()}` : `₩${tokenPrice.toFixed(4)}`}</span>
                    <span className="font-semibold text-stone-800">{fmtUsdc(subtotalUsdc)}</span>
                </div>
                <div className="flex justify-between text-[#17cf54] text-xs">
                    <span>Est. Annual Return</span>
                    <span className="font-bold">
                        {estAnnualReturn >= 1 ? `₩${Math.round(estAnnualReturn).toLocaleString()}` : `₩${estAnnualReturn.toFixed(4)}`}
                    </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-3 font-bold text-stone-900">
                    <span>Total</span>
                    <span>
                        {fmtUsdc(subtotalUsdc)}
                        <span className="text-xs text-stone-400 font-normal ml-1">
                            (≈{subtotalKrw >= 1 ? `₩${Math.round(subtotalKrw).toLocaleString()}` : `₩${subtotalKrw.toFixed(4)}`})
                        </span>
                    </span>
                </div>
            </div>

            {/* Countdown */}
            {countdown && (
                <div className="bg-stone-50 border border-stone-100 rounded-2xl px-4 pt-3.5 pb-4">
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Funding Ends In</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: "Days", value: countdown.days },
                            { label: "Hrs",  value: countdown.hours },
                            { label: "Min",  value: countdown.minutes },
                            { label: "Sec",  value: countdown.seconds },
                        ].map(({ label, value }, i) => (
                            <div key={label} className="text-center relative">
                                {i < 3 && <span className="absolute -right-1.5 top-2 text-base font-bold text-stone-300 select-none">:</span>}
                                <div className="bg-stone-100 rounded-xl py-2.5">
                                    <span className="text-2xl font-bold text-[#4a3b2c] tabular-nums">{String(value).padStart(2, "0")}</span>
                                </div>
                                <p className="text-[10px] text-stone-400 font-medium mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA */}
            {isNotMinted ? (
                <button disabled className="w-full h-14 rounded-2xl bg-stone-200 text-stone-400 text-base font-bold cursor-not-allowed flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                    Not Minted
                </button>
            ) : isSoldOut ? (
                <button disabled className="w-full h-14 rounded-2xl bg-stone-300 text-stone-500 text-base font-bold cursor-not-allowed flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">block</span>
                    Sold Out
                </button>
            ) : connected ? (
                isKycCompleted ? (
                    <button
                        className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        onClick={handleInvest}
                        disabled={isProcessing}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {isProcessing ? "hourglass_empty" : "account_balance_wallet"}
                        </span>
                        {isProcessing ? "Processing Transaction..." : "Buy with USDC →"}
                    </button>
                ) : (
                    <button
                        className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => navigate("/kyc")}
                    >
                        Complete KYC to Invest
                    </button>
                )
            ) : (
                <button
                    className="w-full h-14 rounded-2xl bg-[#17cf54] hover:bg-[#14b847] text-white text-base font-bold transition-all shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setVisible(true)}
                >
                    Connect Wallet to Invest
                </button>
            )}

            <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                No charge until funding goal is met
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">warning</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-bold">Investment Risk Disclosure</span><br />
                        This investment carries the risk of principal loss. Rental yields may vary depending on seasonal and market conditions.
                    </p>
                </div>
            </div>

            <button className="w-full text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[14px]">flag</span>
                문제 신고
            </button>
        </Card>
    );
}
