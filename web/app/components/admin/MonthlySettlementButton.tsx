import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivyAnchorWallet } from "~/lib/privy-wallet";

import { PROGRAM_ID, USDC_MINT } from "~/lib/constants";
import { getProgram, derivePdas } from "~/lib/anchor-client";
const LOCAL_GOV_WALLET_STR = import.meta.env.VITE_LOCAL_GOV_WALLET ?? "";
const OPERATOR_WALLET_STR = import.meta.env.VITE_OPERATOR_WALLET ?? "";

interface Props {
    listingId: string;
    listingTitle: string;
    month: string;
}

type Step = "input" | "preview" | "done";
type TxStatus = "idle" | "pending" | "done" | "error";

interface TxProgress {
    distribute: TxStatus;
    operatorPayout: TxStatus;
    govPayout: TxStatus;
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

export function MonthlySettlementButton({ listingId, listingTitle, month }: Props) {
    const { connection } = useConnection();
    const wallet = usePrivyAnchorWallet();

    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("input");
    const [costKrw, setCostKrw] = useState("");
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const DEMO_OPERATING_COST = 150000;

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFile(file.name);
        setCostKrw(String(DEMO_OPERATING_COST));
    }

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [done, setDone] = useState<DoneData | null>(null);
    const [revenueInfo, setRevenueInfo] = useState<{ grossRevenueKrw: number; bookingCount: number } | null>(null);
    const [revenueLoading, setRevenueLoading] = useState(false);
    const [txProgress, setTxProgress] = useState<TxProgress>({ distribute: "idle", operatorPayout: "idle", govPayout: "idle" });
    const [savedTxs, setSavedTxs] = useState<{ distributeTx?: string; opPayoutTx?: string; govPayoutTx?: string }>({});
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
        setTxProgress({ distribute: "idle", operatorPayout: "idle", govPayout: "idle" });
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

        const currentSaved = savedTxs;

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

            let distributeTx: string | undefined = currentSaved.distributeTx;
            let opPayoutTx: string | undefined = currentSaved.opPayoutTx;
            let govPayoutTx: string | undefined = currentSaved.govPayoutTx;

            // TX1: distribute_monthly_revenue (투자자 30% → usdc_vault)
            if (!distributeTx && preview.hasActiveToken && preview.investorUsdc > 0) {
                setTxProgress((p) => ({ ...p, distribute: "pending" }));
                try {
                    distributeTx = await program.methods
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
                        .rpc();
                    setSavedTxs((s) => ({ ...s, distributeTx }));
                    setTxProgress((p) => ({ ...p, distribute: "done" }));
                } catch (err: any) {
                    setTxProgress((p) => ({ ...p, distribute: "error" }));
                    throw new Error("[TX1] distribute 실패: " + (err.message?.slice(0, 80) ?? ""));
                }
            } else if (distributeTx) {
                setTxProgress((p) => ({ ...p, distribute: "done" }));
            }

            // TX2+TX3: 운영자(30%) + 지자체(40%) 한 트랜잭션으로 묶음
            const effectiveOpWallet = preview.operatorWalletAddress || OPERATOR_WALLET_STR;
            const needPayout = !opPayoutTx && (
                (effectiveOpWallet && preview.operatorUsdc > 0) ||
                (LOCAL_GOV_WALLET_STR && preview.localGovUsdc > 0)
            );
            if (needPayout) {
                setTxProgress((p) => ({ ...p, operatorPayout: "pending", govPayout: LOCAL_GOV_WALLET_STR ? "pending" : "idle" }));
                try {
                    const combinedTx = new Transaction();
                    if (effectiveOpWallet && preview.operatorUsdc > 0) {
                        const operatorPubkey = new PublicKey(effectiveOpWallet);
                        const operatorUsdcAccount = getAssociatedTokenAddressSync(usdcMint, operatorPubkey, false, TOKEN_PROGRAM_ID);
                        combinedTx.add(createAssociatedTokenAccountIdempotentInstruction(authority, operatorUsdcAccount, operatorPubkey, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
                        combinedTx.add(createTransferCheckedInstruction(authorityUsdcAccount, usdcMint, operatorUsdcAccount, authority, preview.operatorUsdc, 6, [], TOKEN_PROGRAM_ID));
                    }
                    if (LOCAL_GOV_WALLET_STR && preview.localGovUsdc > 0) {
                        const govPubkey = new PublicKey(LOCAL_GOV_WALLET_STR);
                        const govUsdcAccount = getAssociatedTokenAddressSync(usdcMint, govPubkey, false, TOKEN_PROGRAM_ID);
                        combinedTx.add(createAssociatedTokenAccountIdempotentInstruction(authority, govUsdcAccount, govPubkey, usdcMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
                        combinedTx.add(createTransferCheckedInstruction(authorityUsdcAccount, usdcMint, govUsdcAccount, authority, preview.localGovUsdc, 6, [], TOKEN_PROGRAM_ID));
                    }
                    // sign + send (wallet adapter의 sendTransaction 대체)
                    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                    combinedTx.recentBlockhash = blockhash;
                    combinedTx.feePayer = wallet!.publicKey;
                    const signedTx = await wallet!.signTransaction(combinedTx);
                    const payoutSig = await connection.sendRawTransaction(signedTx.serialize());
                    await connection.confirmTransaction({ signature: payoutSig, blockhash, lastValidBlockHeight });
                    opPayoutTx = payoutSig;
                    govPayoutTx = payoutSig;
                    setSavedTxs((s) => ({ ...s, opPayoutTx: payoutSig, govPayoutTx: payoutSig }));
                    setTxProgress((p) => ({ ...p, operatorPayout: "done", govPayout: LOCAL_GOV_WALLET_STR ? "done" : "idle" }));
                } catch (err: any) {
                    setTxProgress((p) => ({ ...p, operatorPayout: "error", govPayout: LOCAL_GOV_WALLET_STR ? "error" : "idle" }));
                    throw new Error("[TX Payout] 전송 실패: " + (err.message?.slice(0, 80) ?? ""));
                }
            } else if (opPayoutTx) {
                setTxProgress((p) => ({ ...p, operatorPayout: "done", govPayout: govPayoutTx ? "done" : "idle" }));
            }

            // DB 기록 (실제 tx 서명 전달)
            const res = await fetch("/api/admin/monthly-settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId,
                    month,
                    operatingCostKrw: parseInt(costKrw) || 0,
                    dryRun: false,
                    distributeTx: distributeTx ?? null,
                    opPayoutTx: opPayoutTx ?? null,
                    govPayoutTx: govPayoutTx ?? null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "DB 기록 실패");
            setDone(data as DoneData);
            setStep("done");
        } catch (e: unknown) {
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

    const hasPartialFailure = Object.values(txProgress).some((s) => s === "error");
    const hasSavedTx = Object.values(savedTxs).some(Boolean);

    const TX_STEPS = [
        { key: "distribute" as const, label: "투자자 배당 분배" },
        { key: "operatorPayout" as const, label: "운영자 USDC 전송 (30%)" },
        { key: "govPayout" as const, label: "지자체 USDC 전송 (40%)" },
    ];

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-xs font-semibold text-[#4a3b2c] border border-stone-300 hover:border-[#17cf54] hover:text-[#17cf54] px-3 py-1.5 rounded-lg transition-colors"
            >
                정산하기
            </button>
        );
    }

    const [monthYear, monthNum] = month.split("-");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={loading ? undefined : handleClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 pt-6 pb-4 border-b border-stone-100 text-center">
                    <h3 className="font-bold text-[#4a3b2c] text-base">{month} 정산</h3>
                    <p className="text-xs text-stone-400 mt-0.5">{listingTitle}</p>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {step === "input" && (
                        <>
                            <div className="space-y-3">
                                <div className="bg-stone-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs text-stone-500">숙박 매출</span>
                                    {revenueLoading ? <span className="text-xs text-stone-400">계산 중...</span>
                                        : revenueInfo ? <span className="text-sm font-semibold text-[#4a3b2c]">{krwFmt(revenueInfo.grossRevenueKrw)}원 <span className="text-xs text-stone-400">({revenueInfo.bookingCount}건)</span></span>
                                        : <span className="text-xs text-stone-400">-</span>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">운영 보고서</label>
                                    <label className={`flex flex-col items-center justify-center gap-1.5 w-full border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${uploadedFile ? "border-[#17cf54]/40 bg-[#17cf54]/5" : "border-stone-200 hover:border-stone-300 bg-stone-50"}`}>
                                        <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                                        {uploadedFile
                                            ? <><svg className="w-5 h-5 text-[#17cf54]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs font-medium text-[#17cf54]">{uploadedFile}</span><span className="text-[10px] text-stone-400">운영비 자동 입력됨</span></>
                                            : <><svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg><span className="text-xs text-stone-400">PDF / Excel 업로드</span><span className="text-[10px] text-stone-300">클릭하여 파일 선택</span></>}
                                    </label>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">운영비 (KRW)</label>
                                    <input
                                        type="number" placeholder="직접 입력 또는 보고서 업로드"
                                        value={costKrw} onChange={(e) => setCostKrw(e.target.value)} min="0"
                                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                                    />
                                </div>
                            </div>
                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                            <div className="flex gap-2">
                                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors">취소</button>
                                <button onClick={handlePreview} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50">
                                    {loading ? "계산 중..." : "미리 계산"}
                                </button>
                            </div>
                        </>
                    )}

                    {step === "preview" && preview && (
                        <>
                            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{monthYear}년 {monthNum}월 미리보기</div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">수익 / 비용</p>
                                <div className="flex justify-between text-sm text-stone-600"><span>숙박 매출</span><span className="font-medium">{krwFmt(preview.grossRevenueKrw)}원 <span className="text-xs text-stone-400">({preview.bookingCount}건)</span></span></div>
                                <div className="flex justify-between text-sm text-stone-600"><span>운영비</span><span>- {krwFmt(preview.operatingCostKrw)}원</span></div>
                                <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-semibold text-[#4a3b2c]"><span>영업이익</span><span>{krwFmt(preview.operatingProfitKrw)}원</span></div>
                            </div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">분배 내역</p>
                                <div className="flex justify-between text-sm text-stone-600"><span>지자체 <span className="text-xs text-stone-400">(40%)</span></span><span>{usdcFmt(preview.localGovUsdc)} USDC</span></div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>운영자 <span className="text-xs text-stone-400">(30%)</span></span>
                                    <span className={preview.hasOperator && preview.operatorWalletAddress ? "text-[#17cf54] font-medium" : "text-red-400"}>
                                        {usdcFmt(preview.operatorUsdc)} USDC
                                        {!preview.hasOperator && <span className="ml-1 text-xs">(미배정)</span>}
                                        {preview.hasOperator && !preview.operatorWalletAddress && <span className="ml-1 text-xs">(지갑 미등록)</span>}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>투자자 <span className="text-xs text-stone-400">(30%)</span>{preview.hasActiveToken && preview.investorCount > 0 && <span className="ml-1 text-xs text-stone-400">{preview.investorCount}명</span>}</span>
                                    <span className={preview.hasActiveToken && preview.investorCount > 0 ? "text-[#17cf54] font-medium" : "text-stone-400"}>
                                        {usdcFmt(preview.investorUsdc)} USDC
                                        {!preview.hasActiveToken && <span className="ml-1 text-xs">(미운영)</span>}
                                        {preview.hasActiveToken && preview.investorCount === 0 && <span className="ml-1 text-xs">(투자자 없음)</span>}
                                    </span>
                                </div>
                            </div>
                            {preview.hasOperator && !preview.operatorWalletAddress && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
                                    운영자가 지갑을 등록하지 않았습니다. 운영자 대시보드에서 먼저 등록해야 합니다.
                                </div>
                            )}
                            {usdcBalance !== null && (preview.operatorUsdc + preview.localGovUsdc) > usdcBalance && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
                                    어드민 USDC 잔액 부족 — 보유 {(usdcBalance / 1_000_000).toFixed(2)} USDC,
                                    필요 {((preview.operatorUsdc + preview.localGovUsdc) / 1_000_000).toFixed(2)} USDC.
                                    <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="ml-1 underline font-bold">Circle faucet</a>에서 충전하세요.
                                </div>
                            )}
                            {!wallet && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                    온체인 정산을 위해 지갑을 준비 중입니다...
                                </div>
                            )}
                            {loading && (
                                <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                    <p className="text-xs font-semibold text-stone-500 mb-2">온체인 트랜잭션 실행 중</p>
                                    {TX_STEPS.map(({ key, label }) => (
                                        <div key={key} className="flex items-center justify-between text-xs text-stone-600">
                                            <span>{label}</span>{txStatusIcon(txProgress[key])}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {hasPartialFailure && hasSavedTx && !loading && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                    <p className="text-xs text-amber-700 font-medium">일부 트랜잭션이 실패했습니다.</p>
                                    {TX_STEPS.map(({ key, label }) => (
                                        <div key={key} className="flex items-center justify-between text-xs text-stone-600">
                                            <span>{label}</span>{txStatusIcon(txProgress[key])}
                                        </div>
                                    ))}
                                    <button onClick={() => handleConfirm()} className="w-full mt-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">
                                        실패한 단계부터 재시도
                                    </button>
                                </div>
                            )}
                            {error && !hasPartialFailure && <p className="text-xs text-red-500 font-medium">{error}</p>}
                            <div className="flex gap-2">
                                <button onClick={() => { setStep("input"); setError(""); }} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors">수정</button>
                                <button
                                    onClick={() => handleConfirm()}
                                    disabled={loading || preview.operatingProfitKrw === 0 || !wallet || (preview.hasOperator && !preview.operatorWalletAddress)}
                                    className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                                >
                                    {loading ? "처리 중..." : "정산 확정"}
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
                                <p className="font-bold text-[#4a3b2c]">정산 완료</p>
                            </div>
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
                                {done.localGovSettlement && <div className="flex justify-between text-stone-600"><span>지자체 분배 (40%)</span><span className="font-medium text-[#17cf54]">{done.localGovSettlement}</span></div>}
                                {done.operatorSettlement && <div className="flex justify-between text-stone-600"><span>운영자 지급 (30%)</span><span className="font-medium text-[#17cf54]">{done.operatorSettlement}</span></div>}
                                {done.dividends && <div className="flex justify-between text-stone-600"><span>투자자 배당 (30%)</span><span className="font-medium text-[#17cf54]">{done.dividends}</span></div>}
                            </div>
                            <button onClick={handleClose} className="w-full py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors">닫기</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
