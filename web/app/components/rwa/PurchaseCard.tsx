import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Card, Input } from "~/components/ui-mockup";
import { Button } from "~/components/ui/button";
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

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";
import { fmtUsdc } from "~/lib/formatters";

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
    totalSupply: number;
    holders: number;
    soldTokens: number;
    fundingDeadlineMs: number;
}

export function PurchaseCard({
    listingId, tokenMint, tokenId,
    tokenName, tokenPrice, usdcPrice, apy, fundingProgress, availableTokens,
    totalSupply, holders, soldTokens, fundingDeadlineMs,
}: Props) {
    const walletCtx = useWallet();
    const { connected, publicKey } = walletCtx;
    const { connection } = useConnection();
    const { setVisible } = useWalletModal();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isKycCompleted, registeredWallet } = useKyc();
    const isWalletMismatch = connected && publicKey && registeredWallet
        ? publicKey.toBase58() !== registeredWallet
        : false;

    const [tokenCount, setTokenCount] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    const subtotalUsdc = usdcPrice * tokenCount;
    const subtotalKrw = tokenPrice * tokenCount;
    const estAnnualReturn = subtotalKrw * (apy / 100);
    const isSoldOut = fundingProgress >= 100;
    const isNotMinted = !tokenMint;
    const isDeadlineExpired = fundingDeadlineMs > 0 && Date.now() > fundingDeadlineMs;
    // 인당 구매 상한 = min(잔여수량, 총공급의 30%) — Anchor 온체인 로직과 동일하게 맞춤
    // 의결권 캡(10%)은 DAO 구현 시 별도 처리
    const maxPerInvestor = Math.floor(totalSupply * 3 / 10);
    const maxBuyable = Math.min(availableTokens, maxPerInvestor);

    const handleInvest = async () => {
        if (!publicKey || !tokenMint) return;
        setIsProcessing(true);
        try {
            const { BN } = await import("@coral-xyz/anchor");
            const { PublicKey } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                createAssociatedTokenAccountIdempotentInstruction,
                TOKEN_2022_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");

            const program = await getProgram(connection, walletCtx);
            const { propertyToken, fundingVault, investorPosition, programId } = await derivePdas(listingId, publicKey);

            const usdcMint = new PublicKey(USDC_MINT);
            const tokenMintPubkey = new PublicKey(tokenMint);

            // ATAs
            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, publicKey, false, TOKEN_PROGRAM_ID
            );
            const investorRwaAccount = getAssociatedTokenAddressSync(
                tokenMintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID
            );

            // investor_position이 없으면 open_position을 preInstruction으로 추가
            const positionAccount = await connection.getAccountInfo(investorPosition);
            const preIxs = [];

            // investor_usdc_account — 없으면 생성 (idempotent)
            preIxs.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    publicKey, investorUsdcAccount, publicKey, usdcMint, TOKEN_PROGRAM_ID
                )
            );

            if (!positionAccount) {
                preIxs.push(
                    await program.methods
                        .openPosition(listingId)
                        .accounts({
                            investor: publicKey,
                            propertyToken,
                            investorPosition,
                        })
                        .instruction()
                );
            }

            const signature = await program.methods
                .purchaseTokens(listingId, new BN(tokenCount))
                .accounts({
                    investor: publicKey,
                    propertyToken,
                    tokenMint: tokenMintPubkey,
                    investorPosition,
                    investorUsdcAccount,
                    fundingVault,
                    investorRwaAccount,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions(preIxs)
                .rpc();

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
            const msg = parseAnchorError(err);
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
                <div className="flex items-start justify-between mb-1.5">
                    <label className="text-xs font-medium text-stone-600">Amount</label>
                    <div className="text-xs text-stone-400 text-right">
                        <div>Available: {availableTokens.toLocaleString()}</div>
                        <div>Max per wallet: {maxPerInvestor.toLocaleString()}</div>
                    </div>
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
                        onChange={(e) => setTokenCount(Math.max(1, Math.min(parseInt(e.target.value) || 1, maxBuyable)))}
                        className="text-center text-lg font-semibold disabled:opacity-50"
                        disabled={isSoldOut || isNotMinted}
                    />
                    <button
                        className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.min(c + 1, maxBuyable))}
                        disabled={isSoldOut || isNotMinted || tokenCount >= maxBuyable}
                    >+</button>
                </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 text-sm">
                <div className="flex justify-between text-stone-600">
                    <span>{tokenCount} tokens × {tokenPrice >= 1 ? `₩${Math.round(tokenPrice).toLocaleString()}` : `₩${tokenPrice.toFixed(4)}`}</span>
                    <span className="font-semibold text-stone-800">{fmtUsdc(subtotalUsdc)}</span>
                </div>
                {apy > 1000 && (
                    <div className="text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                        감정가가 낮게 설정되어 수익률이 과장될 수 있습니다.
                    </div>
                )}
                <div className={`flex justify-between text-xs ${apy > 1000 ? "text-amber-500" : "text-[#17cf54]"}`}>
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
            {countdown ? (
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
            ) : isDeadlineExpired ? (
                <div className="bg-stone-50 border border-stone-100 rounded-2xl px-4 pt-3.5 pb-4">
                    <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">Funding Ended</p>
                    <div className="grid grid-cols-4 gap-2">
                        {["Days", "Hrs", "Min", "Sec"].map((label, i) => (
                            <div key={label} className="text-center relative">
                                {i < 3 && <span className="absolute -right-1.5 top-2 text-base font-bold text-stone-300 select-none">:</span>}
                                <div className="bg-stone-100 rounded-xl py-2.5">
                                    <span className="text-2xl font-bold text-stone-300 tabular-nums">00</span>
                                </div>
                                <p className="text-[10px] text-stone-400 font-medium mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* CTA */}
            {isNotMinted ? (
                <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                    <span className="material-symbols-outlined text-[20px]">schedule</span>
                    Not Minted
                </Button>
            ) : isDeadlineExpired ? (
                <div className="space-y-2">
                    <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]">event_busy</span>
                        Funding Ended
                    </Button>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 text-center">
                        펀딩 기간이 종료되었습니다.<br />목표 미달 시 투자금이 환불됩니다.
                    </div>
                </div>
            ) : isSoldOut ? (
                <div className="space-y-2">
                    <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]">lock</span>
                        Sold Out
                    </Button>
                    <p className="text-center text-xs text-stone-400 leading-relaxed">
                        펀딩 목표가 달성되었습니다.<br />첫 배당은 운영 시작 익월에 지급됩니다.
                    </p>
                </div>
            ) : connected ? (
                isWalletMismatch ? (
                    <div className="space-y-2">
                        <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                            <span className="material-symbols-outlined text-[20px]">block</span>
                            인증된 지갑으로 연결해주세요
                        </Button>
                        <p className="text-center text-xs text-stone-500 leading-relaxed">
                            KYC 인증된 지갑과 다릅니다.<br />
                            인증된 지갑으로 변경 후 다시 시도해주세요.
                        </p>
                    </div>
                ) : isKycCompleted ? (
                    <Button
                        variant="success"
                        size="xl"
                        className="w-full shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                        onClick={handleInvest}
                        disabled={isProcessing}
                    >
                        <span className="material-symbols-outlined text-[20px]">
                            {isProcessing ? "hourglass_empty" : "account_balance_wallet"}
                        </span>
                        {isProcessing ? "Processing Transaction..." : "Buy with USDC"}
                    </Button>
                ) : (
                    <Button
                        variant="success"
                        size="xl"
                        className="w-full shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => navigate("/kyc")}
                    >
                        Complete KYC to Invest
                    </Button>
                )
            ) : (
                <Button
                    variant="success"
                    size="xl"
                    className="w-full shadow-xl shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                    onClick={() => setVisible(true)}
                >
                    Connect Wallet to Invest
                </Button>
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

            <Button variant="ghost" size="sm" className="w-full text-stone-400 hover:text-stone-600">
                <span className="material-symbols-outlined text-[14px]">flag</span>
                문제 신고
            </Button>
        </Card>
    );
}
