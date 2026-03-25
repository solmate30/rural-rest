import { useState } from "react";

interface Props {
    rwaTokenId: string;
    listingTitle: string;
}

export function DistributeDividendButton({ rwaTokenId, listingTitle }: Props) {
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const [revenueUsdc, setRevenueUsdc] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [message, setMessage] = useState("");

    async function handleDistribute() {
        const totalRevenueUsdc = Math.round(parseFloat(revenueUsdc) * 1_000_000);
        if (!month || isNaN(totalRevenueUsdc) || totalRevenueUsdc <= 0) {
            setMessage("금액을 올바르게 입력해주세요");
            return;
        }
        setStatus("loading");
        setMessage("");
        try {
            const res = await fetch("/api/rwa/distribute-dividend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId, month, totalRevenueUsdc }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "분배 실패");
            setStatus("done");
            setMessage(`${data.distributed}명에게 배당 분배 완료`);
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
                배당 분배
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-2xl p-6 w-80 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-[#4a3b2c]">배당 분배</h3>
                <p className="text-xs text-stone-500">{listingTitle}</p>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">배당 월</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">투자자 배분 총액 (USDC)</label>
                        <input
                            type="number"
                            placeholder="예: 150.00"
                            value={revenueUsdc}
                            onChange={(e) => setRevenueUsdc(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                        <p className="text-[10px] text-stone-400">영업이익의 70% 중 투자자 몫 (지분 비율로 자동 분배)</p>
                    </div>
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
                        disabled={status === "loading" || status === "done"}
                        className="flex-1 py-2 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                    >
                        {status === "loading" ? "처리 중..." : status === "done" ? "완료" : "분배"}
                    </button>
                </div>
            </div>
        </div>
    );
}
