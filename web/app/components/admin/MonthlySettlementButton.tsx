import { useState, useEffect } from "react";

interface Props {
    listingId: string;
    listingTitle: string;
}

type Step = "input" | "preview" | "done";

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

export function MonthlySettlementButton({ listingId, listingTitle }: Props) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>("input");
    const [month, setMonth] = useState(() => {
        const now = new Date();
        const m = now.getMonth();
        const y = m === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const pm = m === 0 ? 12 : m;
        return `${y}-${String(pm).padStart(2, "0")}`;
    });
    const [costKrw, setCostKrw] = useState("");
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const DEMO_OPERATING_COST = 150000; // 데모 고정값

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
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "오류 발생");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirm() {
        if (!preview) return;
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
                    dryRun: false,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "정산 실패");
            setDone(data as DoneData);
            setStep("done");
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "오류 발생");
        } finally {
            setLoading(false);
        }
    }

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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={handleClose}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-stone-100 text-center">
                    <h3 className="font-bold text-[#4a3b2c] text-base">월 정산</h3>
                    <p className="text-xs text-stone-400 mt-0.5">{listingTitle}</p>
                </div>

                <div className="px-6 py-5 space-y-5">

                    {/* Step 1: 입력 */}
                    {step === "input" && (
                        <>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">정산 월</label>
                                    <input
                                        type="month"
                                        value={month}
                                        onChange={(e) => setMonth(e.target.value)}
                                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                                    />
                                </div>

                                {/* 숙박 매출 자동 표시 */}
                                <div className="bg-stone-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs text-stone-500">숙박 매출</span>
                                    {revenueLoading ? (
                                        <span className="text-xs text-stone-400">계산 중...</span>
                                    ) : revenueInfo ? (
                                        <span className="text-sm font-semibold text-[#4a3b2c]">
                                            {krwFmt(revenueInfo.grossRevenueKrw)}원
                                            <span className="text-xs text-stone-400 ml-1">({revenueInfo.bookingCount}건)</span>
                                        </span>
                                    ) : (
                                        <span className="text-xs text-stone-400">-</span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">운영 보고서</label>
                                    <label className={`flex flex-col items-center justify-center gap-1.5 w-full border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition-colors ${uploadedFile ? "border-[#17cf54]/40 bg-[#17cf54]/5" : "border-stone-200 hover:border-stone-300 bg-stone-50"}`}>
                                        <input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                                        {uploadedFile ? (
                                            <>
                                                <svg className="w-5 h-5 text-[#17cf54]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span className="text-xs font-medium text-[#17cf54]">{uploadedFile}</span>
                                                <span className="text-[10px] text-stone-400">운영비 자동 입력됨</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <span className="text-xs text-stone-400">PDF / Excel 업로드</span>
                                                <span className="text-[10px] text-stone-300">클릭하여 파일 선택</span>
                                            </>
                                        )}
                                    </label>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-stone-600">운영비 (KRW)</label>
                                    <input
                                        type="number"
                                        placeholder="직접 입력 또는 보고서 업로드"
                                        value={costKrw}
                                        onChange={(e) => setCostKrw(e.target.value)}
                                        min="0"
                                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                            <div className="flex gap-2">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handlePreview}
                                    disabled={loading}
                                    className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                                >
                                    {loading ? "계산 중..." : "미리 계산"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 2: 미리보기 */}
                    {step === "preview" && preview && (
                        <>
                            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                                {monthYear}년 {monthNum}월 미리보기
                            </div>

                            {/* 수익/비용 */}
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">수익 / 비용</p>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>숙박 매출</span>
                                    <span className="font-medium">
                                        {krwFmt(preview.grossRevenueKrw)}원
                                        <span className="text-xs text-stone-400 ml-1">({preview.bookingCount}건)</span>
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>운영비</span>
                                    <span>- {krwFmt(preview.operatingCostKrw)}원</span>
                                </div>
                                <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-semibold text-[#4a3b2c]">
                                    <span>영업이익</span>
                                    <span>{krwFmt(preview.operatingProfitKrw)}원</span>
                                </div>
                            </div>

                            {/* 분배 내역 */}
                            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-3">분배 내역</p>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>지자체 <span className="text-xs text-stone-400">(40%)</span></span>
                                    <span>{usdcFmt(preview.localGovUsdc)} USDC</span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>운영자 <span className="text-xs text-stone-400">(30%)</span></span>
                                    <span className={preview.hasOperator ? "text-[#17cf54] font-medium" : "text-stone-400"}>
                                        {usdcFmt(preview.operatorUsdc)} USDC
                                        {!preview.hasOperator && <span className="ml-1 text-xs">(운영자 미배정)</span>}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm text-stone-600">
                                    <span>
                                        투자자 <span className="text-xs text-stone-400">(30%)</span>
                                        {preview.hasActiveToken && preview.investorCount > 0 && (
                                            <span className="ml-1 text-xs text-stone-400">{preview.investorCount}명</span>
                                        )}
                                    </span>
                                    <span className={preview.hasActiveToken && preview.investorCount > 0 ? "text-[#17cf54] font-medium" : "text-stone-400"}>
                                        {usdcFmt(preview.investorUsdc)} USDC
                                        {!preview.hasActiveToken && <span className="ml-1 text-xs">(미운영)</span>}
                                        {preview.hasActiveToken && preview.investorCount === 0 && <span className="ml-1 text-xs">(투자자 없음)</span>}
                                    </span>
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setStep("input"); setError(""); }}
                                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                                >
                                    수정
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={loading || preview.operatingProfitKrw === 0}
                                    className="flex-1 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                                >
                                    {loading ? "처리 중..." : "정산 확정"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 3: 완료 */}
                    {step === "done" && done && (
                        <>
                            <div className="text-center space-y-3 py-2">
                                <div className="w-12 h-12 rounded-full bg-[#17cf54]/10 flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6 text-[#17cf54]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="font-bold text-[#4a3b2c]">정산 완료</p>
                            </div>

                            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-sm">
                                {done.localGovSettlement && (
                                    <div className="flex justify-between text-stone-600">
                                        <span>지자체 분배 (40%)</span>
                                        <span className="font-medium text-[#17cf54]">{done.localGovSettlement}</span>
                                    </div>
                                )}
                                {done.operatorSettlement && (
                                    <div className="flex justify-between text-stone-600">
                                        <span>운영자 지급 (30%)</span>
                                        <span className="font-medium text-[#17cf54]">{done.operatorSettlement}</span>
                                    </div>
                                )}
                                {done.dividends && (
                                    <div className="flex justify-between text-stone-600">
                                        <span>투자자 배당 (30%)</span>
                                        <span className="font-medium text-[#17cf54]">{done.dividends}</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleClose}
                                className="w-full py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors"
                            >
                                닫기
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
