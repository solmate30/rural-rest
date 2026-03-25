import { useState } from "react";

interface Props {
    rwaTokenId: string;
}

export function ActivateButton({ rwaTokenId }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleActivate() {
        setStatus("loading");
        setErrorMsg("");
        try {
            const res = await fetch("/api/rwa/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "활성화 실패");
            setStatus("done");
            // 페이지 새로고침으로 상태 반영
            window.location.reload();
        } catch (e: any) {
            setErrorMsg(e.message);
            setStatus("error");
        }
    }

    if (status === "done") {
        return (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17cf54]/10 text-[#17cf54] font-bold text-sm border border-[#17cf54]/20">
                활성화 완료
            </span>
        );
    }

    return (
        <div className="space-y-2">
            <button
                onClick={handleActivate}
                disabled={status === "loading"}
                className="w-full py-3 rounded-xl bg-[#17cf54] hover:bg-[#14b847] text-white font-bold transition-colors disabled:opacity-50"
            >
                {status === "loading" ? "활성화 중..." : "운영 시작 (Active)"}
            </button>
            {status === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
