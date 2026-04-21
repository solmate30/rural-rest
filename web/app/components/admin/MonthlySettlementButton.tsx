import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";
import { useTranslation } from "react-i18next";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas } from "~/lib/anchor-client";
const LOCAL_GOV_WALLET_STR = import.meta.env.VITE_LOCAL_GOV_WALLET ?? "";
const OPERATOR_WALLET_STR = import.meta.env.VITE_OPERATOR_WALLET ?? "";

interface Props {
    listingId: string;
    listingTitle: string;
    month: string;
    onSuccess?: () => void;
}

type Step = "input" | "preview" | "done";
type TxStatus = "idle" | "pending" | "done" | "error";

interface TxProgress {
    combined: TxStatus;
}

interface PreviewData {
    grossRevenueKrw: number;
    operatingCostKrw: number;
    operatingProfitKrw: number;
    bookingCount: number;
    localGovUsdc: number;
    operatorUsdc: number;
    investorUsdc: number;
    investorCount: number;
    hasOperator: boolean;
    hasActiveToken: boolean;
    operatorWalletAddress: string | null;
}

interface DoneData {
    localGovSettlement?: string;
    operatorSettlement?: string;
    dividends?: string;
    investorCount?: number;
}

function usdcFmt(microUsdc: number) {
    return (microUsdc / 1_000_000).toFixed(2);
}

function krwFmt(krw: number) {
    return krw.toLocaleString("ko-KR");
}

export function MonthlySettlementButton({ listingId, listingTitle, month, onSuccess }: Props) {
    const { t } = useTranslation("admin");
    const { connection } = useConnection();
    const wallet = usePrivyAnchorWallet();

    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("input");
    const [costKrw, setCostKrw] = useState("");
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFile(file.name);
        // 매출의 30%를 운영비로 자동 입력 (매출 미로드 시 0)
        const autoCost = revenueInfo ? Math.floor(revenueInfo.grossRevenueKrw * 0.3) : 0;
        setCostKrw(String(autoCost));
    }

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [done, setDone] = useState<DoneData | null>(null);
    const [revenueInfo, setRevenueInfo] = useState<{ grossRevenueKrw: number; bookingCount: number } | null>(null);
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [txProgress, setTxProgress] = useState<TxProgress>({ combined: "idle" });
    const [savedTxs, setSavedTxs] = useState<{ combinedTx?: string }>({});
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);

    useEffect(() => {
        if (!open || !month) return;
        setRevenueInfo(null);
        setRevenueLoading(true);
        fetch("/api/admin/monthly-settlement", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId, month, operatingCostKrw: 0, dryRun: true }),
        })
            .then((r) => r.json())
            .then((d) => setRevenueInfo({ grossRevenueKrw: d.grossRevenueKrw ?? 0, bookingCount: d.bookingCount ?? 0 }))
            .catch(() => setRevenueInfo(null))
            .finally(() => setRevenueLoading(false));
    }, [open, month, listingId]);

    function reset() {
        setStep("input");
        setError("");
        setPreview(null);
        setDone(null);
        setLoading(false);
        setUploadedFile(null);
        setTxProgress({ combined: "idle" });
        setSavedTxs({});
    }

    function handleClose() {
        setOpen(false);
        reset();
    }

    async function handlePreview() {
        if (!month) return;
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/monthly-settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId,
                    month,
                    operatingCostKrw: parseInt(costKrw) || 0,
                    dryRun: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "계산 실패");
            setPreview(data as PreviewData);
            setStep("preview");

            // 어드민 USDC 잔액 조회
            if (wallet?.publicKey) {
                try {
                    const { getAssociatedTokenAddressSync, getAccount, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
                    const { PublicKey } = await import("@solana/web3.js");
                    const usdcMint = new PublicKey(USDC_MINT);
                    const ata = getAssociatedTokenAddressSync(usdcMint, wallet!.publicKey, false, TOKEN_PROGRAM_ID);
                    const account = await getAccount(connection, ata, "confirmed", TOKEN_PROGRAM_ID);
                    setUsdcBalance(Number(account.amount));
                } catch {
                    setUsdcBalance(null);
                }
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "오류 발생");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirm() {
        if (!preview || !wallet?.publicKey) return;
        setLoading(true);
        setError("");

        try {
            const { BN } = await import("@coral-xyz/anchor");
            const { PublicKey, Transaction } = await import("@solana/web3.js");
            const {
                getAssociatedTokenAddressSync,
                createAssociatedTokenAccountIdempotentInstruction,
                createTransferCheckedInstruction,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
            } = await import("@solana/spl-token");

            const program = await getProgram(connection, wallet!);
            const { propertyToken } = await derivePdas(listingId);

            const usdcMint = new PublicKey(USDC_MINT);
            const authority = wallet!.publicKey;
            const authorityUsdcAccount = getAssociatedTokenAddressSync(usdcMint, authority, false, TOKEN_PROGRAM_ID);
            const [usdcVault] = PublicKey.findProgramAddressSync(
                [propertyToken.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), usdcMint.toBuffer()],
                ASSOCIATED_TOKEN_PROGRAM_ID
            );

            setTxProgress({ combined: "pending" });

            const tx = new Transaction();

            // 투자자 30% → usdc_vault (Anchor 인스트럭션)
            if (preview.hasActiveToken && preview.investorUsdc > 0) {
                const distributeTxObj = await program.methods
                    .distributeMonthlyRevenue(listingId, new BN(preview.investorUsdc))
                    .accounts({
                        propertyToken,
                        authority,
                        authorityUsdcAccount,
                        usdcVault,
                        usdcMint,
                        usdcTokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    })
                    .transaction();
                tx.add(...distributeTxObj.instructions);
            }

            // 운영자 30% 이체
            const effectiveOpWallet = preview.operatorWalletAddress || OPERATOR_WALLET_STR;
            if (effectiveOpWallet && preview.operatorUsdc > 0) {
                const operatorPubkey = new PublicKey(effectiveOpWallet);
                const operatorUsdcAccount = getAssociatedTokenAddressSync(usdcMint, operatorPubkey, false, TOKEN_PROGRAM_ID);
                tx.add(createAssociatedTokenAccountIdempotentInstruction(authority, operatorUsdcAccount, operatorPubkey, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
                tx.add(createTransferCheckedInstruction(authorityUsdcAccount, usdcMint, operatorUsdcAccount, authority, preview.operatorUsdc, 6, [], TOKEN_PROGRAM_ID));
            }

            // 지자체 40% 이체
            if (LOCAL_GOV_WALLET_STR && preview.localGovUsdc > 0) {
                const govPubkey = new PublicKey(LOCAL_GOV_WALLET_STR);
                const govUsdcAccount = getAssociatedTokenAddressSync(usdcMint, govPubkey, false, TOKEN_PROGRAM_ID);
                tx.add(createAssociatedTokenAccountIdempotentInstruction(authority, govUsdcAccount, govPubkey, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
                tx.add(createTransferCheckedInstruction(authorityUsdcAccount, usdcMint, govUsdcAccount, authority, preview.localGovUsdc, 6, [], TOKEN_PROGRAM_ID));
            }

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = authority;
            const signedTx = await wallet!.signTransaction(tx);
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

            setSavedTxs({ combinedTx: sig });
            setTxProgress({ combined: "done" });

            // DB 기록
            const res = await fetch("/api/admin/monthly-settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId,
                    month,
                    operatingCostKrw: parseInt(costKrw) || 0,
                    dryRun: false,
                    distributeTx: (preview.hasActiveToken && preview.investorUsdc > 0) ? sig : null,
                    opPayoutTx: (effectiveOpWallet && preview.operatorUsdc > 0) ? sig : null,
                    govPayoutTx: (LOCAL_GOV_WALLET_STR && preview.localGovUsdc > 0) ? sig : null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "DB 기록 실패");
            setDone(data as DoneData);
            setStep("done");
            onSuccess?.();
        } catch (e: unknown) {
            setTxProgress({ combined: "error" });
            setError(e instanceof Error ? e.message : "오류 발생");
        } finally {
            setLoading(false);
        }
    }

    const txStatusIcon = (s: TxStatus) => {
        if (s === "pending") return <span className="inline-block w-3 h-3 rounded-full border-2 border-[#17cf54] border-t-transparent animate-spin" />;
        if (s === "done") return <span className="text-[#17cf54] text-xs font-bold">완료</span>;
        if (s === "error") return <span className="text-red-500 text-xs font-bold">실패</span>;
        return <span className="text-stone-300 text-xs">대기</span>;
    };

    const hasPartialFailure = txProgress.combined === "error";
    const hasSavedTx = Boolean(savedTxs.combinedTx);

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-xs font-semibold text-[#4a3b2c] border border-stone-300 hover:border-[#17cf54] hover:text-[#17cf54] px-3 py-1.5 rounded-lg transition-colors"
            >
                {t("settlements.modal.button")}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={loading ? undefined : handleClose}>

            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 pt-6 pb-4 border-b border-stone-100 text-center">
                    <h3 className="font-bold text-[#4a3b2c] text-base">{t("settlements.modal.title", { month })}</h3>
                    <p className="text-xs text-stone-400 mt-0.5">{listingTitle}</p>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {step === "input" && (
                        <>
                            <div className="space-y-3">
                                <div className="bg-stone-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs text-stone-500">{t("settlements.modal.revenue")}</span>
                                    {revenueLoading ? <span className="text-xs text-stone-400">{t("settlements.modal.calculating")}</span>
                                        : revenueInfo ? <span className="text-sm font-semibold text-[#4a3b2c]">{krwFmt(revenueInfo.grossRevenueKrw)} <span className="text-xs text-stone-400">{t("settlements.modal.bookings", { count: revenueInfo.bookingCount })}</span></span>
                                        : <span className="text-xs text-stone-400">-</span>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">{t("settlements.modal.reportLabel")}</label>
                                    <label className={`flex flex-col items-center justify-center gap-1.5 w-full border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${uploadedFile ? "border-[#17cf54]/40 bg-[#17cf54]/5" : "border-stone-200 hover:border-stone-300 bg-stone-50"}`}>
                                        <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                                        {uploadedFile
                                            ? <><svg className="w-5 h-5 text-[#17cf54]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs font-medium text-[#17cf54]">{uploadedFile}</span><span className="text-[10px] text-stone-400">{t("settlements.modal.reportAutoFilled")}</span></>
                                            : <><svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg><span className="text-xs text-stone-400">{t("settlements.modal.reportUpload")}</span><span className="text-[10px] text-stone-300">{t("settlements.modal.reportClick")}</span></>}
                                    </label>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">{t("settlements.modal.costLabel")}</label>
                                    <input
                                        type="number" placeholder={t("settlements.modal.costPlaceholder")}
                                        value={costKrw} onChange={(e) => setCostKrw(e.target.value)} min="0"
                                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                                    />
                                </div>
                            </div>
                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                            <div className="flex gap-2">
                                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors">{t("settlements.modal.cancel")}</button>
                                <button onClick={handlePreview} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50">
                                    {loading ? t("settlements.modal.calculating") : t("settlements.modal.previewBtn")}
                                </button>
                            </div>
                        </>
                    )}

                    {step === "preview" && preview && (
                        <>
                            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{t("settlements.modal.preview", { month })}</div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">{t("settlements.modal.revenueSection")}</p>
                                <div className="flex justify-between text-sm text-stone-600"><span>{t("settlements.modal.revenue")}</span><span className="font-medium">{krwFmt(preview.grossRevenueKrw)} <span className="text-xs text-stone-400">{t("settlements.modal.bookings", { count: preview.bookingCount })}</span></span></div>
                                <div className="flex justify-between text-sm text-stone-600"><span>{t("settlements.operatingCost", { amount: "" }).trim()}</span><span>- {krwFmt(preview.operatingCostKrw)}</span></div>
                                <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-semibold text-[#4a3b2c]"><span>{t("settlements.operatingProfit")}</span><span>{krwFmt(preview.operatingProfitKrw)}</span></div>
                            </div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">{t("settlements.modal.distributionSection")}</p>
                                <div className="flex justify-between text-sm text-stone-600"><span>{t("settlements.modal.municipality")} <span className="text-xs text-stone-400">(40%)</span></span><span>{usdcFmt(preview.localGovUsdc)} USDC</span></div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>{t("settlements.modal.operator")} <span className="text-xs text-stone-400">(30%)</span></span>
                                    <span className={preview.hasOperator && preview.operatorWalletAddress ? "text-[#17cf54] font-medium" : "text-red-400"}>
                                        {usdcFmt(preview.operatorUsdc)} USDC
                                        {!preview.hasOperator && <span className="ml-1 text-xs">{t("settlements.modal.operatorUnassigned")}</span>}
                                        {preview.hasOperator && !preview.operatorWalletAddress && <span className="ml-1 text-xs">{t("settlements.modal.operatorNoWallet")}</span>}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>{t("settlements.modal.investor")} <span className="text-xs text-stone-400">(30%)</span>{preview.hasActiveToken && preview.investorCount > 0 && <span className="ml-1 text-xs text-stone-400">{t("settlements.investorCount", { count: preview.investorCount })}</span>}</span>
                                    <span className={preview.hasActiveToken && preview.investorCount > 0 ? "text-[#17cf54] font-medium" : "text-stone-400"}>
                                        {usdcFmt(preview.investorUsdc)} USDC
                                        {!preview.hasActiveToken && <span className="ml-1 text-xs">{t("settlements.modal.investorInactive")}</span>}
                                        {preview.hasActiveToken && preview.investorCount === 0 && <span className="ml-1 text-xs">{t("settlements.modal.investorNone")}</span>}
                                    </span>
                                </div>
                            </div>
                            {preview.hasOperator && !preview.operatorWalletAddress && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
                                    {t("settlements.modal.operatorNoWalletWarning")}
                                </div>
                            )}
                            {usdcBalance !== null && (preview.operatorUsdc + preview.localGovUsdc) > usdcBalance && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
                                    {t("settlements.modal.adminUsdcLow", {
                                        balance: (usdcBalance / 1_000_000).toFixed(2),
                                        required: ((preview.operatorUsdc + preview.localGovUsdc) / 1_000_000).toFixed(2),
                                    })}
                                </div>
                            )}
                            {!wallet && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                    {t("settlements.modal.walletPreparing")}
                                </div>
                            )}
                            {loading && (
                                <div className="bg-stone-50 rounded-xl p-4 flex items-center justify-between text-xs text-stone-600">
                                    <span>{t("settlements.modal.onchainRunning")}</span>
                                    {txStatusIcon(txProgress.combined)}
                                </div>
                            )}
                            {hasPartialFailure && !loading && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                    <p className="text-xs text-amber-700 font-medium">{t("settlements.modal.partialFailure")}</p>
                                    <button onClick={() => handleConfirm()} className="w-full mt-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
                                        {t("settlements.modal.retry")}
                                    </button>
                                </div>
                            )}
                            {error && !hasPartialFailure && <p className="text-xs text-red-500 font-medium">{error}</p>}
                            <div className="flex gap-2">
                                <button onClick={() => { setStep("input"); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors">{t("settlements.modal.edit")}</button>
                                <button
                                    onClick={() => handleConfirm()}
                                    disabled={loading || preview.operatingProfitKrw === 0 || !wallet || (preview.hasOperator && !preview.operatorWalletAddress)}
                                    className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                                >
                                    {loading ? t("settlements.modal.processing") : t("settlements.modal.confirm")}
                                </button>
                            </div>
                        </>
                    )}

                    {step === "done" && done && (
                        <>
                            <div className="text-center space-y-3 py-2">
                                <div className="w-12 h-12 rounded-full bg-[#17cf54]/10 flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6 text-[#17cf54]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <p className="font-bold text-[#4a3b2c]">{t("settlements.modal.done")}</p>
                            </div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
                                {done.localGovSettlement && <div className="flex justify-between text-stone-600"><span>{t("settlements.modal.govDistribution")}</span><span className="font-medium text-[#17cf54]">{done.localGovSettlement}</span></div>}
                                {done.operatorSettlement && <div className="flex justify-between text-stone-600"><span>{t("settlements.modal.operatorPayout")}</span><span className="font-medium text-[#17cf54]">{done.operatorSettlement}</span></div>}
                                {done.dividends && <div className="flex justify-between text-stone-600"><span>{t("settlements.modal.investorDividends")}</span><span className="font-medium text-[#17cf54]">{done.dividends}</span></div>}
                            </div>
                            <button onClick={handleClose} className="w-full py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors">{t("settlements.modal.close")}</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
