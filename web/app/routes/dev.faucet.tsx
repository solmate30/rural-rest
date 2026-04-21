/**
 * /dev/faucet — Localnet 전용 USDC/SOL 충전 페이지
 * RPC가 localhost를 가리킬 때만 동작. production에서는 API가 403 반환.
 */

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function DevFaucetPage() {
    const [wallet, setWallet] = useState("");
    const [sol, setSol] = useState(2);
    const [usdc, setUsdc] = useState(10_000);
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [msg, setMsg] = useState("");

    async function handleFund() {
        if (!wallet.trim()) return;
        setStatus("loading");
        setMsg("");
        try {
            const res = await fetch("/api/dev/faucet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress: wallet.trim(), sol, usdc }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "충전 실패");
            setStatus("done");
            setMsg(`완료 — ${sol} SOL + ${usdc.toLocaleString()} USDC 충전됨`);
        } catch (e: any) {
            setStatus("error");
            setMsg(e.message);
        }
    }

    return (
        <div className="min-h-screen bg-[#fcfaf7] flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-6">
                {/* 헤더 */}
                <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Dev Only</p>
                    <h1 className="text-2xl font-bold text-[#4a3b2c]">Localnet Faucet</h1>
                    <p className="text-sm text-stone-400">테스트 지갑에 SOL과 USDC를 충전합니다.</p>
                </div>

                {/* 폼 */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-500">지갑 주소</label>
                        <Input
                            placeholder="Base58 지갑 주소"
                            value={wallet}
                            onChange={(e) => setWallet(e.target.value)}
                            className="rounded-xl font-mono text-sm"
                            disabled={status === "loading"}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-500">SOL</label>
                            <Input
                                type="number"
                                value={sol}
                                onChange={(e) => setSol(Number(e.target.value))}
                                min={0}
                                className="rounded-xl text-sm"
                                disabled={status === "loading"}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-stone-500">USDC</label>
                            <Input
                                type="number"
                                value={usdc}
                                onChange={(e) => setUsdc(Number(e.target.value))}
                                min={0}
                                className="rounded-xl text-sm"
                                disabled={status === "loading"}
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleFund}
                        disabled={status === "loading" || !wallet.trim()}
                        className="w-full rounded-xl h-11 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                    >
                        {status === "loading" ? "충전 중..." : "충전하기"}
                    </Button>

                    {msg && (
                        <p className={`text-sm text-center font-medium ${status === "done" ? "text-emerald-600" : "text-red-500"}`}>
                            {msg}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
