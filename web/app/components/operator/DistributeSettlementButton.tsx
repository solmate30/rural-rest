import { useState } from "react";

import { KRW_PER_USDC } from "~/lib/constants";

interface Props {
    listingId: string;
    operatorId: string;
    listingTitle: string;
}

export function DistributeSettlementButton({ listingId, operatorId, listingTitle }: Props) {
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [grossKrw, setGrossKrw] = useState("");
    const [costKrw, setCostKrw] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [message, setMessage] = useState("");

    const gross = parseInt(grossKrw) || 0;
    const cost = parseInt(costKrw) || 0;
    const profit = Math.max(0, gross - cost);
    const settlementKrw = Math.floor(profit * 0.3);
    const settlementUsdc = Math.floor((settlementKrw / KRW_PER_USDC) * 1_000_000);

    async function handleDistribute() {
        if (!month || gross <= 0) {
            setMessage("금액을 올바르게 입력해주세요");
            return;
        }
        setStatus("loading");
        setMessage("");
        try {
            const res = await fetch("/api/operator/distribute-settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    listingId,
                    operatorId,
                    month,
                    grossRevenueKrw: gross,
                    operatingCostKrw: cost,
                    operatingProfitKrw: profit,
                    settlementUsdc,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "정산 실패");
            setStatus("done");
            setMessage("정산 내역 생성 완료");
        } catch (e: any) {
            setStatus("error");
            setMessage(e.message);
        }
    }

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="text-xs text-stone-500 hover:text-[#17cf54] font-medium px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
                운영자 정산
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-2xl p-6 w-80 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-[#4a3b2c]">운영자 정산</h3>
                <p className="text-xs text-stone-500">{listingTitle}</p>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">정산 월</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">숙박 매출 (KRW)</label>
                        <input
                            type="number"
                            placeholder="예: 1500000"
                            value={grossKrw}
                            onChange={(e) => setGrossKrw(e.target.value)}
                            min="0"
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">운영비 (KRW)</label>
                        <input
                            type="number"
                            placeholder="예: 200000"
                            value={costKrw}
                            onChange={(e) => setCostKrw(e.target.value)}
                            min="0"
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                    </div>
                    {gross > 0 && (
                        <div className="bg-stone-50 rounded-xl p-3 space-y-1 text-xs text-stone-600">
                            <div className="flex justify-between">
                                <span>영업이익</span>
                                <span className="font-medium">{profit.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between font-bold text-[#17cf54]">
                                <span>운영자 정산액 (30%)</span>
                                <span>{(settlementUsdc / 1_000_000).toFixed(2)} USDC</span>
                            </div>
                        </div>
                    )}
                </div>

                {message && (
                    <p className={`text-xs font-medium ${status === "error" ? "text-red-500" : "text-[#17cf54]"}`}>
                        {message}
                    </p>
                )}

                <div className="flex gap-2 pt-1">
                    <button
                        onClick={() => { setOpen(false); setStatus("idle"); setMessage(""); }}
                        className="flex-1 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleDistribute}
                        disabled={status === "loading" || status === "done" || gross <= 0}
                        className="flex-1 py-2 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                    >
                        {status === "loading" ? "처리 중..." : status === "done" ? "완료" : "정산 생성"}
                    </button>
                </div>
            </div>
        </div>
    );
}
