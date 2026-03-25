import { useState } from "react";

interface Props {
    settlementId: string;
    amountUsdc: number;
    onClaimed?: () => void;
}

export function OperatorClaimButton({ settlementId, amountUsdc, onClaimed }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

    async function handleClaim() {
        setStatus("loading");
        try {
            const claimTx = `demo_settlement_${Date.now()}`;
            const res = await fetch("/api/operator/claim-settlement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settlementId, claimTx }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "청구 실패");
            setStatus("done");
            onClaimed?.();
        } catch {
            setStatus("error");
        }
    }

    if (status === "done") {
        return <span className="text-xs text-[#17cf54] font-medium">수령 완료</span>;
    }

    return (
        <button
            onClick={handleClaim}
            disabled={status === "loading"}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#17cf54] text-white hover:bg-[#14b847] transition-colors disabled:opacity-50"
        >
            {status === "loading" ? "처리 중..." : status === "error" ? "재시도" : `${(amountUsdc / 1_000_000).toFixed(2)} USDC 수령`}
        </button>
    );
}
