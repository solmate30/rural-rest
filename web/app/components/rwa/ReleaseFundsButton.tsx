import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";

interface Props {
    listingId: string;
    rwaTokenId: string;
    tokenMint: string;
    authorityWallet: string | null;
}

export function ReleaseFundsButton({ rwaTokenId }: Props) {
    const { t } = useTranslation("admin");
    const [txStatus, setTxStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleRelease() {
        setTxStatus("loading");
        setErrorMsg("");

        try {
            const res = await fetch("/api/rwa/release-funds", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Unknown error");
            if (!data.activated) throw new Error(data.note ?? "온체인 활성화 실패 — CRANK_SECRET_KEY가 설정되지 않았습니다");

            setTxStatus("done");
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setErrorMsg(err.message ?? "오류가 발생했습니다");
            setTxStatus("error");
        }
    }

    if (txStatus === "done") {
        return (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center space-y-1">
                <p className="text-sm font-bold text-green-700">{t("rwa.release.activationComplete")}</p>
                <p className="text-xs text-stone-400">{t("rwa.release.reloading")}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <Button
                onClick={handleRelease}
                disabled={txStatus === "loading"}
                variant="wood"
                className="w-full py-3"
            >
                {txStatus === "loading" ? t("rwa.release.step1") : t("rwa.release.button")}
            </Button>
            {txStatus === "error" && (
                <p className="text-xs text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
