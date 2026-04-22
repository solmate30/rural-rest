import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { Card } from "~/components/ui-mockup";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";
import { useKyc } from "~/components/KycProvider";
import { usePrivy } from "@privy-io/react-auth";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

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

const PCT_BTNS = [
    { label: "25%", pct: 0.25 },
    { label: "50%", pct: 0.5 },
    { label: "75%", pct: 0.75 },
    { label: "MAX", pct: 1 },
];

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
    const [inputStr, setInputStr] = useState("1");
    const [isProcessing, setIsProcessing] = useState(false);
    const [myHoldings, setMyHoldings] = useState<number | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

    const step: Step = useMemo(() => {
        if (!ready) return "wallet-loading";
        if (!wallet && authenticated) return "wallet-loading";
        if (!wallet) return "need-wallet";
        if (!isKycCompleted) return "need-kyc";
        return "buy";
    }, [ready, wallet, authenticated, isKycCompleted]);

    // 지갑 연결 시 내 보유량 + USDC 잔액 조회
    useEffect(() => {
        if (!wallet || !tokenMint) { setMyHoldings(null); setUsdcBalance(null); return; }
        let cancelled = false;

        (async () => {
            const { PublicKey } = await import("@solana/web3.js");
            const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");

            // USDC 잔액 조회
            try {
                const usdcMint = new PublicKey(USDC_MINT);
                const usdcAta = getAssociatedTokenAddressSync(usdcMint, wallet.publicKey, false, TOKEN_PROGRAM_ID);
                const balInfo = await connection.getTokenAccountBalance(usdcAta);
                if (!cancelled) setUsdcBalance(Number(balInfo.value.uiAmount));
            } catch {
                if (!cancelled) setUsdcBalance(0);
            }

            // 내 보유량 조회
            try {
                const prog = await getProgram(connection, wallet);
                const { investorPosition } = await derivePdas(listingId, wallet.publicKey);
                const info = await connection.getAccountInfo(investorPosition);
                if (!info || cancelled) { if (!cancelled) setMyHoldings(0); return; }
                const pos: any = await (prog.account as any).investorPosition.fetch(investorPosition);
                if (!cancelled) setMyHoldings(Number(pos.amount));
            } catch {
                if (!cancelled) setMyHoldings(0);
            }
        })();

        return () => { cancelled = true; };
    }, [wallet, tokenMint, listingId, connection]);

    const maxPerInvestor = Math.floor(totalSupply * 3 / 10);
    const remainingAllowance = myHoldings !== null ? Math.max(0, maxPerInvestor - myHoldings) : maxPerInvestor;
    // 잔액 기준 최대 구매 가능 수량
    const maxAffordable = usdcBalance !== null && usdcPrice > 0
        ? Math.floor(usdcBalance / usdcPrice)
        : null;
    // 지갑 한도·잔여 공급·잔액 세 가지 모두 고려
    const maxBuyable = Math.min(
        availableTokens,
        remainingAllowance,
        maxAffordable ?? Infinity,
    );
    // 지갑 한도 초과 여부
    const isWalletCapReached = myHoldings !== null && remainingAllowance === 0;

    const isSoldOut = fundingProgress >= 100;
    const isNotMinted = !tokenMint;
    const isDeadlineExpired = fundingDeadlineMs > 0 && Date.now() > fundingDeadlineMs;
    const isInsufficientBalance = usdcBalance !== null && usdcBalance < usdcPrice * tokenCount;

    const subtotalUsdc = usdcPrice * tokenCount;
    const subtotalKrw = tokenPrice * tokenCount;
    const estAnnualReturn = subtotalKrw * (apy / 100);

    function applyCount(count: number) {
        const clamped = Math.max(1, Math.min(count, maxBuyable > 0 ? maxBuyable : 1));
        setTokenCount(clamped);
        setInputStr(String(clamped));
    }

    function handlePctClick(pct: number) {
        if (!maxAffordable && maxAffordable !== 0) return;
        const target = pct >= 1
            ? maxBuyable
            : Math.max(1, Math.floor((usdcBalance! * pct) / usdcPrice));
        applyCount(target);
    }

    function handleInputChange(raw: string) {
        setInputStr(raw);
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed > 0) {
            applyCount(parsed);
        }
    }

    function handleInputBlur() {
        setInputStr(String(tokenCount));
    }

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
            const seedId = listingId.replace(/-/g, "");
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
                        .openPosition(seedId)
                        .accounts({ investor: publicKey, propertyToken, investorPosition })
                        .instruction()
                );
            }

            const signature = await program.methods
                .purchaseTokens(seedId, new BN(tokenCount))
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
                title: t("purchase.successTitle"),
                description: t("purchase.successDesc", { count: tokenCount, tx: signature.slice(0, 8) }),
                variant: "success",
            });

            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            console.error("[PurchaseCard] tx error:", err);
            const msg = parseAnchorError(err);
            toast({ title: t("purchase.processing"), description: msg, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const countdown = useCountdown(fundingDeadlineMs);

    const canBuy = step === "buy" && !isSoldOut && !isNotMinted && !isDeadlineExpired;

    return (
        <Card className="p-0 shadow-2xl border-none bg-white rounded-3xl overflow-hidden">

            {/* 헤더 — 토큰 가격 */}
            <div className="px-6 pt-5 pb-4 border-b border-stone-100">
                <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-1">
                    {t("purchase.title")}
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[#4a3b2c] tabular-nums">
                        {fmtUsdc(usdcPrice)}
                    </span>
                    <span className="text-sm text-stone-400">{t("purchase.perToken")}</span>
                </div>
            </div>

            <div className="px-6 py-5 space-y-5">

                {/* 수량 입력 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                            {t("purchase.amount")}
                        </label>
                        <span className="text-xs text-stone-400">
                            {t("purchase.available", { count: availableTokens.toLocaleString() })}
                        </span>
                    </div>

                    {/* 수량 인풋 */}
                    <div className="relative">
                        <input
                            type="number"
                            min="1"
                            value={inputStr}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onBlur={handleInputBlur}
                            disabled={!canBuy}
                            className={cn(
                                "w-full h-14 rounded-2xl border bg-stone-50 px-4 text-right text-2xl font-bold text-[#4a3b2c] tabular-nums",
                                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40",
                                "disabled:opacity-40 disabled:cursor-not-allowed",
                                isInsufficientBalance && canBuy ? "border-red-300 bg-red-50" : "border-stone-200"
                            )}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">
                            {tokenName}
                        </span>
                    </div>

                    {/* % 퀵필 버튼 */}
                    <div className="grid grid-cols-4 gap-1.5">
                        {PCT_BTNS.map(({ label, pct }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => handlePctClick(pct)}
                                disabled={!canBuy || usdcBalance === null || usdcBalance === 0}
                                className={cn(
                                    "h-8 rounded-xl text-xs font-bold transition-colors",
                                    "bg-stone-100 text-stone-500 hover:bg-primary/10 hover:text-primary",
                                    "disabled:opacity-30 disabled:cursor-not-allowed",
                                    label === "MAX" && "hover:bg-red-50 hover:text-red-500"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 최대 구매 가능 / 보유 현황 */}
                    <div className="space-y-1">
                        {canBuy && !isWalletCapReached && maxAffordable !== null && (
                            <div className="flex justify-between text-xs">
                                <span className="text-stone-400">{t("purchase.maxAffordable")}</span>
                                <span className={cn(
                                    "font-semibold tabular-nums",
                                    maxBuyable === 0 ? "text-red-500" : "text-[#4a3b2c]"
                                )}>
                                    {maxBuyable === 0
                                        ? t("purchase.insufficientBalance")
                                        : t("purchase.tokenCount", { count: maxBuyable.toLocaleString() })}
                                </span>
                            </div>
                        )}
                        {myHoldings !== null && myHoldings > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-stone-400">{t("purchase.myHoldings", { count: "" }).trim()}</span>
                                <span className="font-semibold text-primary tabular-nums">
                                    {t("purchase.tokenCount", { count: myHoldings.toLocaleString() })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 금액 요약 */}
                <div className="rounded-2xl bg-stone-50 border border-stone-100 px-4 py-3 space-y-2 text-sm">
                    <div className="flex justify-between text-stone-500">
                        <span>{tokenCount.toLocaleString()} × {fmtUsdc(usdcPrice)}</span>
                        <span className="font-semibold text-[#4a3b2c] tabular-nums">{fmtUsdc(subtotalUsdc)}</span>
                    </div>
                    {apy > 1000 ? (
                        <div className="text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                            감정가가 낮게 설정되어 수익률이 과장될 수 있습니다.
                        </div>
                    ) : (
                        <div className="flex justify-between text-xs text-invest">
                            <span>{t("purchase.estReturn")}</span>
                            <span className="font-bold tabular-nums">
                                +{estAnnualReturn >= 1 ? `₩${Math.round(estAnnualReturn).toLocaleString()}` : `₩${estAnnualReturn.toFixed(4)}`} / yr
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-[#4a3b2c]">
                        <span>{t("purchase.total")}</span>
                        <div className="text-right">
                            <div className="tabular-nums">{fmtUsdc(subtotalUsdc)}</div>
                            <div className="text-xs text-stone-400 font-normal">
                                ≈ {subtotalKrw >= 1 ? `₩${Math.round(subtotalKrw).toLocaleString()}` : `₩${subtotalKrw.toFixed(4)}`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 카운트다운 */}
                {(countdown || isDeadlineExpired) && (
                    <div className="bg-stone-50 border border-stone-100 rounded-2xl px-4 pt-3 pb-3.5">
                        <p className="text-xs uppercase font-bold text-stone-400 tracking-wider mb-2">
                            {countdown ? t("purchase.fundingEndsIn") : t("purchase.fundingEnded")}
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: t("purchase.days"), value: countdown?.days ?? 0 },
                                { label: t("purchase.hrs"),  value: countdown?.hours ?? 0 },
                                { label: t("purchase.min"),  value: countdown?.minutes ?? 0 },
                                { label: t("purchase.sec"),  value: countdown?.seconds ?? 0 },
                            ].map(({ label, value }, i) => (
                                <div key={label} className="text-center relative">
                                    {i < 3 && (
                                        <span className="absolute -right-1.5 top-2 text-base font-bold text-stone-300 select-none" aria-hidden="true">:</span>
                                    )}
                                    <div className="bg-stone-100 rounded-xl py-2.5">
                                        <span className={cn(
                                            "text-2xl font-bold tabular-nums",
                                            countdown ? "text-[#4a3b2c]" : "text-stone-300"
                                        )}>
                                            {String(value).padStart(2, "0")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-stone-400 font-medium mt-1">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                    <Button variant="success" size="xl" className="w-full shadow-xl shadow-invest/20 hover:scale-[1.02] active:scale-[0.98]" onClick={login}>
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
                ) : isWalletCapReached ? (
                    <Button
                        variant="success"
                        size="xl"
                        className="w-full shadow-xl shadow-invest/20"
                        onClick={() => toast({
                            title: t("purchase.walletCapToastTitle"),
                            description: t("purchase.walletCapToastDesc", { max: maxPerInvestor.toLocaleString() }),
                        })}
                    >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">account_balance_wallet</span>
                        {t("purchase.invest")}
                    </Button>
                ) : isInsufficientBalance ? (
                    <Button disabled variant="secondary" size="xl" className="w-full cursor-not-allowed">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">account_balance_wallet</span>
                        {t("purchase.insufficientBalance")}
                    </Button>
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
            </div>
        </Card>
    );
}
