import { useState } from "react";
import { useNavigate } from "react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Transaction, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Card, Input } from "~/components/ui-mockup";
import { useToast } from "~/hooks/use-toast";
import { useKyc } from "~/components/KycProvider";

interface Props {
    tokenName: string;
    tokenPrice: number;
    usdcPrice: number;
    apy: number;
    fundingProgress: number;
}

export function PurchaseCard({ tokenName, tokenPrice, usdcPrice, apy, fundingProgress }: Props) {
    const { connected, publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isKycCompleted } = useKyc();

    const [tokenCount, setTokenCount] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    const subtotalUsdc = usdcPrice * tokenCount;
    const subtotal = tokenPrice * tokenCount;
    const estAnnualReturn = Math.floor(subtotal * (apy / 100));
    const isSoldOut = fundingProgress >= 100;

    const handleInvest = async () => {
        if (!publicKey) return;
        setIsProcessing(true);
        try {
            // TODO: replace with actual purchase_tokens Anchor instruction
            const memoText = `Rural Rest Investment: ${tokenCount} tokens of ${tokenName}`;
            const memoInstruction = new TransactionInstruction({
                keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
                data: Buffer.from(memoText, "utf-8") as any,
                programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
            });
            const transaction = new Transaction().add(memoInstruction);
            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, "processed");
            toast({
                title: "투자가 완료되었습니다!",
                description: `성공적으로 온체인에 기록되었습니다. (서명: ${signature.slice(0, 8)}...)`,
                variant: "success",
            });
        } catch {
            toast({ title: "결제 실패", description: "트랜잭션이 취소되었거나 실패했습니다.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Card className="p-6 shadow-2xl border-none bg-white rounded-3xl space-y-4">
            <h3 className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Purchase Tokens</h3>

            {/* Token Input */}
            <div>
                <label className="text-xs font-medium text-stone-600 block mb-1.5">Amount</label>
                <div className="flex items-center gap-2">
                    <button
                        className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.max(1, c - 1))}
                        disabled={isSoldOut}
                    >−</button>
                    <Input
                        type="number"
                        min="1"
                        value={tokenCount}
                        onChange={(e) => setTokenCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center text-lg font-semibold disabled:opacity-50"
                        disabled={isSoldOut}
                    />
                    <button
                        className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => c + 1)}
                        disabled={isSoldOut}
                    >+</button>
                </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-600">
                    <span>{tokenCount} tokens × ₩{tokenPrice.toLocaleString()}</span>
                    <span className="font-semibold text-stone-800">{subtotalUsdc.toFixed(1)} USDC</span>
                </div>
                <div className="flex justify-between text-stone-600">
                    <span>플랫폼 수수료 (1%)</span>
                    <span className="font-semibold text-stone-800">{(subtotalUsdc * 0.01).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between text-[#17cf54] text-xs">
                    <span>Est. Annual Return</span>
                    <span className="font-bold">₩{estAnnualReturn.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-3 font-bold text-stone-900">
                    <span>Total</span>
                    <span>
                        {(subtotalUsdc * 1.01).toFixed(1)} USDC
                        <span className="text-xs text-stone-400 font-normal ml-1">
                            (≈₩{Math.floor(subtotal * 1.01).toLocaleString()})
                        </span>
                    </span>
                </div>
            </div>

            {/* CTA */}
            {isSoldOut ? (
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
                        <span className="font-bold">투자 위험 고지</span><br />
                        본 투자는 원금 손실 가능성이 있으며, 숙박 수익률은 계절·시장 상황에 따라 변동될 수 있습니다.
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
