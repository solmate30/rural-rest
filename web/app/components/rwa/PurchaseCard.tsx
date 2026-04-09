import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { Card, Input } from "~/components/ui-mockup";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";
import { useKyc } from "~/components/KycProvider";
import { usePrivy } from "@privy-io/react-auth";
import { useTranslation } from "react-i18next";

type Step = "buy" | "need-wallet" | "wallet-loading" | "need-kyc";

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
    const [t, setT] = useState<ReturnType<typeof calc>>(null);
    useEffect(() => {
        setT(calc());
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
    const wallet = usePrivyAnchorWallet();
    const { connection } = useConnection();
    const location = useLocation();
    const { toast } = useToast();
    const { isKycCompleted } = useKyc();
    const { login, authenticated, ready } = usePrivy();
    const { t } = useTranslation("invest");

    const [tokenCount, setTokenCount] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    const step: Step = useMemo(() => {
        if (!ready) return "wallet-loading";
        if (!wallet && authenticated) return "wallet-loading";
        if (!wallet) return "need-wallet";
        if (!isKycCompleted) return "need-kyc";
        return "buy";
    }, [ready, wallet, authenticated, isKycCompleted]);

    const subtotalUsdc = usdcPrice * tokenCount;
    const subtotalKrw = tokenPrice * tokenCount;
    const estAnnualReturn = subtotalKrw * (apy / 100);
    const isSoldOut = fundingProgress >= 100;
    const isNotMinted = !tokenMint;
    const isDeadlineExpired = fundingDeadlineMs > 0 && Date.now() > fundingDeadlineMs;
    const maxPerInvestor = Math.floor(totalSupply * 3 / 10);
    const maxBuyable = Math.min(availableTokens, maxPerInvestor);

    const handleInvest = async () => {
        if (!wallet || !tokenMint) return;
        const { publicKey } = wallet;
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

            const program = await getProgram(connection, wallet);
            const { propertyToken, fundingVault, investorPosition } = await derivePdas(listingId, publicKey);

            const usdcMint = new PublicKey(USDC_MINT);
            const tokenMintPubkey = new PublicKey(tokenMint);

            const investorUsdcAccount = getAssociatedTokenAddressSync(
                usdcMint, publicKey, false, TOKEN_PROGRAM_ID
            );
            const investorRwaAccount = getAssociatedTokenAddressSync(
                tokenMintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID
            );

            const positionAccount = await connection.getAccountInfo(investorPosition);
            const preIxs = [];

            preIxs.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    publicKey, investorUsdcAccount, publicKey, usdcMint, TOKEN_PROGRAM_ID
                )
            );

            if (!positionAccount) {
                preIxs.push(
                    await program.methods
                        .openPosition(listingId)
                        .accounts({ investor: publicKey, propertyToken, investorPosition })
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
            toast({ title: t("purchase.processing"), description: msg, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const countdown = useCountdown(fundingDeadlineMs);

    return (
        <Card className="p-6 shadow-2xl border-none bg-white rounded-3xl space-y-4">
            <h3 className="text-xs uppercase font-bold text-stone-400 tracking-wider">{t("purchase.title")}</h3>

            {/* Token Input */}
            <div>
                <div className="flex items-start justify-between mb-1.5">
                    <label className="text-xs font-medium text-stone-600">{t("purchase.amount")}</label>
                    <div className="text-xs text-stone-400 text-right">
                        <div>{t("purchase.available", { count: availableTokens.toLocaleString() })}</div>
                        <div>{t("purchase.maxPerWallet", { count: maxPerInvestor.toLocaleString() })}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="h-11 w-11 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.max(1, c - 1))}
                        disabled={isSoldOut || isNotMinted}
                        aria-label="수량 감소"
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
                        className="h-11 w-11 rounded-xl bg-stone-100 hover:bg-stone-200 font-bold text-stone-700 transition-colors shrink-0 disabled:opacity-50"
                        onClick={() => setTokenCount((c) => Math.min(c + 1, maxBuyable))}
                        disabled={isSoldOut || isNotMinted || tokenCount >= maxBuyable}
                        aria-label="수량 증가"
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
                <div className={`flex justify-between text-xs ${apy > 1000 ? "text-amber-500" : "text-invest"}`}>
                    <span>{t("purchase.estReturn")}</span>
                    <span className="font-bold">
                        {estAnnualReturn >= 1 ? `₩${Math.round(estAnnualReturn).toLocaleString()}` : `₩${estAnnualReturn.toFixed(4)}`}
                    </span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-3 font-bold text-stone-900">
                    <span>{t("purchase.total")}</span>
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
                    <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-2">{t("purchase.fundingEndsIn")}</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: t("purchase.days"), value: countdown.days },
                            { label: t("purchase.hrs"),  value: countdown.hours },
                            { label: t("purchase.min"),  value: countdown.minutes },
                            { label: t("purchase.sec"),  value: countdown.seconds },
                        ].map(({ label, value }, i) => (
                            <div key={label} className="text-center relative">
                                {i < 3 && <span className="absolute -right-1.5 top-2 text-base font-bold text-stone-300 select-none" aria-hidden="true">:</span>}
                                <div className="bg-stone-100 rounded-xl py-2.5">
                                    <span className="text-2xl font-bold text-[#4a3b2c] tabular-nums">{String(value).padStart(2, "0")}</span>
                                </div>
                                <p className="text-xs text-stone-400 font-medium mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : isDeadlineExpired ? (
                <div className="bg-stone-50 border border-stone-100 rounded-2xl px-4 pt-3.5 pb-4">
                    <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-2">{t("purchase.fundingEnded")}</p>
                    <div className="grid grid-cols-4 gap-2">
                        {[t("purchase.days"), t("purchase.hrs"), t("purchase.min"), t("purchase.sec")].map((label, i) => (
                            <div key={label} className="text-center relative">
                                {i < 3 && <span className="absolute -right-1.5 top-2 text-base font-bold text-stone-300 select-none" aria-hidden="true">:</span>}
                                <div className="bg-stone-100 rounded-xl py-2.5">
                                    <span className="text-2xl font-bold text-stone-300 tabular-nums">00</span>
                                </div>
                                <p className="text-xs text-stone-400 font-medium mt-1">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* CTA */}
            {isNotMinted ? (
                <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">schedule</span>
                    {t("purchase.notMinted")}
                </Button>
            ) : isDeadlineExpired ? (
                <div className="space-y-2">
                    <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">event_busy</span>
                        {t("purchase.fundingEnded")}
                    </Button>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 text-center">
                        {t("purchase.expiredDesc")}
                    </div>
                </div>
            ) : isSoldOut ? (
                <div className="space-y-2">
                    <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">lock</span>
                        {t("purchase.soldOut")}
                    </Button>
                    <p className="text-center text-xs text-stone-400 leading-relaxed">
                        {t("purchase.soldOutDesc")}
                    </p>
                </div>
            ) : step === "wallet-loading" ? (
                <Button disabled variant="secondary" size="xl" className="w-full">
                    <span className="material-symbols-outlined text-[20px] animate-spin" aria-hidden="true">progress_activity</span>
                    {t("purchase.walletLoading")}
                </Button>
            ) : step === "need-wallet" ? (
                <Button
                    variant="success"
                    size="xl"
                    className="w-full shadow-xl shadow-invest/20 hover:scale-[1.02] active:scale-[0.98]"
                    onClick={login}
                >
                    {t("purchase.login")}
                </Button>
            ) : step === "need-kyc" ? (
                <div className="space-y-3">
                    <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-xs text-stone-600 leading-relaxed">
                        <span className="font-semibold text-stone-800 block mb-1">{t("purchase.kycTitle")}</span>
                        {t("purchase.kycDesc")}
                    </div>
                    <Button
                        variant="success"
                        size="xl"
                        className="w-full shadow-xl shadow-invest/20 hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => window.open(`/kyc?return=${encodeURIComponent(location.pathname + location.search)}`, '_blank')}
                    >
                        {t("purchase.kycBtn")}
                    </Button>
                </div>
            ) : (
                <Button
                    variant="success"
                    size="xl"
                    className="w-full shadow-xl shadow-invest/20 hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleInvest}
                    disabled={isProcessing}
                >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                        {isProcessing ? "progress_activity" : "account_balance_wallet"}
                    </span>
                    {isProcessing ? t("purchase.processing") : t("purchase.invest")}
                </Button>
            )}

            <p className="text-center text-xs text-stone-400 font-bold uppercase tracking-widest">
                {t("purchase.noCharge")}
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5" aria-hidden="true">warning</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-bold">{t("purchase.riskTitle")}</span><br />
                        {t("purchase.riskBody")}
                    </p>
                </div>
            </div>
        </Card>
    );
}
