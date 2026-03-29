import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface Props {
    currentWalletAddress: string | null;
}

export function WalletConnectSection({ currentWalletAddress }: Props) {
    const { connected, publicKey, signMessage, disconnect } = useWallet();
    const { setVisible } = useWalletModal();
    const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [savedAddress, setSavedAddress] = useState(currentWalletAddress);

    // 지갑 연결 후 SIWS 서명 자동 실행
    useEffect(() => {
        if (!connected || !publicKey || !signMessage) return;
        if (publicKey.toBase58() === savedAddress) return; // 이미 저장된 지갑이면 skip
        if (status !== "idle") return;

        setStatus("signing");

        (async () => {
            try {
                const nonceRes = await fetch("/api/user/wallet-nonce");
                if (!nonceRes.ok) throw new Error("nonce 발급 실패");
                const { nonce } = await nonceRes.json() as { nonce: string };

                const messageBytes = new TextEncoder().encode(nonce);
                const sig = await signMessage(messageBytes);

                const res = await fetch("/api/user/connect-wallet", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        walletAddress: publicKey.toBase58(),
                        signature: Array.from(sig),
                        nonce,
                    }),
                });

                if (!res.ok) {
                    const { error } = await res.json() as { error: string };
                    throw new Error(error);
                }

                setSavedAddress(publicKey.toBase58());
                setStatus("done");
            } catch (e: any) {
                console.error("[WalletConnectSection] SIWS 실패:", e);
                setErrorMsg(e.message?.slice(0, 80) ?? "서명 실패");
                setStatus("error");
                disconnect();
            }
        })();
    }, [connected, publicKey, signMessage]);

    return (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 space-y-4">
            <div>
                <h3 className="text-sm font-bold text-stone-800">정산 지갑 등록</h3>
                <p className="text-xs text-stone-400 mt-0.5">수익금(USDC)을 수령할 Solana 지갑을 등록하세요.</p>
            </div>

            {savedAddress ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-[#17cf54]/5 border border-[#17cf54]/20 rounded-xl px-4 py-3">
                        <span className="material-symbols-outlined text-[#17cf54] text-[18px]">check_circle</span>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-[#17cf54]">등록됨</p>
                            <p className="text-xs text-stone-500 font-mono truncate">{savedAddress}</p>
                        </div>
                    </div>
                    <button
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                        onClick={() => {
                            setSavedAddress(null);
                            setStatus("idle");
                            disconnect();
                        }}
                    >
                        다른 지갑으로 변경
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {status === "signing" ? (
                        <div className="flex items-center gap-2 text-sm text-stone-500 py-2">
                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            지갑에서 서명 요청 중...
                        </div>
                    ) : (
                        <button
                            className="w-full h-10 rounded-xl bg-[#17cf54] hover:bg-[#14b847] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                            onClick={() => setVisible(true)}
                        >
                            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                            지갑 등록하기
                        </button>
                    )}
                    {status === "error" && (
                        <p className="text-xs text-red-500">{errorMsg}</p>
                    )}
                    <p className="text-xs text-stone-400">Solana 네트워크 지원 지갑 (Solflare 등)</p>
                </div>
            )}
        </div>
    );
}
