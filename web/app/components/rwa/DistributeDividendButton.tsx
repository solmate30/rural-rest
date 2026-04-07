import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
    rwaTokenId: string;
    listingTitle: string;
}

export function DistributeDividendButton({ rwaTokenId, listingTitle }: Props) {
    const { t } = useTranslation("admin");
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
            setMessage(t("rwa.distribute.invalidAmount"));
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
            if (!res.ok) throw new Error(data.error ?? t("rwa.distribute.error"));
            setStatus("done");
            setMessage(t("rwa.distribute.success", { count: data.distributed }));
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
                {t("rwa.distribute.button")}
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
            <div className="bg-white rounded-2xl p-6 w-80 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-[#4a3b2c]">{t("rwa.distribute.title")}</h3>
                <p className="text-xs text-stone-500">{listingTitle}</p>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">{t("rwa.distribute.monthLabel")}</label>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-stone-600">{t("rwa.distribute.amountLabel")}</label>
                        <input
                            type="number"
                            placeholder={t("rwa.distribute.amountPlaceholder")}
                            value={revenueUsdc}
                            onChange={(e) => setRevenueUsdc(e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#17cf54]/30"
                        />
                        <p className="text-[10px] text-stone-400">{t("rwa.distribute.amountHint")}</p>
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
                        {t("rwa.distribute.cancel")}
                    </button>
                    <button
                        onClick={handleDistribute}
                        disabled={status === "loading" || status === "done"}
                        className="flex-1 py-2 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-colors disabled:opacity-50"
                    >
                        {status === "loading" ? t("rwa.distribute.processing") : status === "done" ? t("rwa.distribute.done") : t("rwa.distribute.distribute")}
                    </button>
                </div>
            </div>
        </div>
    );
}
