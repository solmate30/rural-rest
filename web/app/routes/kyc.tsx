import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useKyc } from "../components/KycProvider";
import { Button, Card, Header, Footer } from "../components/ui-mockup";
import { authClient } from "~/lib/auth.client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function meta() {
    return [
        { title: "KYC Verification | Rural Rest" },
        { name: "description", content: "Complete identity verification to invest in RWA." },
    ];
}

export default function KycRoute() {
    const navigate = useNavigate();
    const { isKycCompleted, completeKyc } = useKyc();
    const sessionRes = authClient?.useSession();

    const { connected } = useWallet();
    const { setVisible } = useWalletModal();

    const [step, setStep] = useState<"intro" | "scanning" | "success" | "onboarding">("intro");

    // Protect route: Must be logged in
    useEffect(() => {
        if (!sessionRes?.isPending && !sessionRes?.data) {
            navigate("/auth");
        }
    }, [sessionRes, navigate]);

    // If already KYC'd AND Wallet Connected, go straight to invest
    useEffect(() => {
        if (isKycCompleted && connected) {
            navigate("/invest");
        }
    }, [isKycCompleted, connected, navigate]);

    // Listen for wallet connection during onboarding
    useEffect(() => {
        if (connected && step === "onboarding") {
            completeKyc();
            navigate("/invest");
        }
    }, [connected, step, completeKyc, navigate]);

    const handleStartScan = () => {
        setStep("scanning");
        // Simulate scanning process
        setTimeout(() => {
            setStep("success");

            // Auto transition to onboarding after showing success for 2 seconds
            setTimeout(() => {
                setStep("onboarding");
            }, 2000);

        }, 3000); // 3 seconds demo scan
    };

    const handleFinishKycOnly = () => {
        completeKyc();
        navigate("/invest");
    };

    return (
        <div className="min-h-screen bg-[#FAF9F6] font-sans flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
                <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

                    {/* Left: Branding & Trust (Desktop & Tablet) */}
                    <div className="hidden lg:flex flex-col space-y-8 animate-in fade-in slide-in-from-left-8 duration-700 pt-8">
                        <div>
                            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold text-[#17cf54] bg-[#17cf54]/10 border border-[#17cf54]/20 rounded-full tracking-widest uppercase">
                                Security First
                            </span>
                            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-[1.2]">
                                안전하고 투명한<br />
                                <span className="text-[#8D6E63] font-['Gaegu'] text-5xl md:text-6xl mt-2 block">RWA 조각 투자</span>
                            </h1>
                            <p className="mt-6 text-stone-500 text-lg max-w-md leading-relaxed">
                                루럴 레스트는 관련 법령을 철저히 준수하며, 블록체인 기술을 통해 위변조 불가능하고 투명한 소유권 증명을 제공합니다.
                            </p>
                        </div>

                        <div className="space-y-6 pt-4 border-t border-stone-200/60 max-w-sm">
                            <div className="flex gap-4 group cursor-default">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-stone-100 group-hover:bg-stone-50 transition-colors">
                                    <span className="material-symbols-outlined text-[#17cf54] text-[24px]">verified_user</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-800">철저한 신원 확인</h3>
                                    <p className="text-sm text-stone-500 mt-1">안전한 금융 거래를 위해 모든 투자자의 신원을 사전에 확인합니다.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 group cursor-default">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-stone-100 group-hover:bg-stone-50 transition-colors">
                                    <span className="material-symbols-outlined text-amber-500 text-[24px]">lock</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-800">개인정보 보호</h3>
                                    <p className="text-sm text-stone-500 mt-1">수집된 정보는 암호화되어 분리 관리되며 다른 목적으로 사용되지 않습니다.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 group cursor-default">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-stone-100 group-hover:bg-stone-50 transition-colors">
                                    <span className="material-symbols-outlined text-[#ab9ff2] text-[24px]">account_balance_wallet</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-800">Web3 지갑 연동</h3>
                                    <p className="text-sm text-stone-500 mt-1">KYC 완료 후 본인 소유의 디지털 지갑을 연결해 배당금을 직접 수령합니다.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: The KYC Card */}
                    <div className="w-full max-w-md mx-auto relative lg:mr-0 z-10">
                        {/* Decorative background blur (Desktop only) */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#8D6E63]/10 blur-3xl -z-10 rounded-full hidden lg:block" />

                        <Card className="w-full p-8 md:p-10 space-y-8 bg-white/95 backdrop-blur-sm rounded-[calc(var(--radius)*2)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-stone-100 relative overflow-hidden">

                            {step === "intro" && (
                                <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <span className="material-symbols-outlined text-[40px] text-stone-600">
                                            badge
                                        </span>
                                    </div>
                                    <h1 className="text-2xl font-bold text-foreground font-['Gaegu']">투자를 위한 실명 인증 (KYC)</h1>
                                    <p className="text-stone-500 text-sm max-w-xs mx-auto">
                                        부동산 조각 투자를 위해서는 관련 법률에 따라 본인 확인 및 신분증 제출이 필수적입니다.
                                    </p>

                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start text-left mt-6">
                                        <span className="material-symbols-outlined text-amber-600 mt-0.5 text-[18px]">
                                            lock
                                        </span>
                                        <p className="text-xs text-amber-800 leading-relaxed">
                                            수집된 신분증 정보는 본인 확인 용도로만 사용됩니다.
                                        </p>
                                    </div>

                                    <Button
                                        className="w-full h-12 text-md font-bold bg-[#8D6E63] hover:bg-[#7a5e55] text-white mt-8"
                                        onClick={handleStartScan}
                                    >
                                        신분증 스캔 시작하기
                                    </Button>
                                    <button
                                        className="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors mt-4"
                                        onClick={() => navigate("/")}
                                    >
                                        나중에 하기 (홈으로)
                                    </button>
                                </div>
                            )}

                            {step === "scanning" && (
                                <div className="text-center space-y-6 animate-in fade-in duration-300">
                                    <div className="relative w-64 h-40 mx-auto rounded-xl border-4 border-dashed border-[#17cf54] p-2 flex items-center justify-center bg-stone-50 overflow-hidden">
                                        <div className="absolute inset-0 bg-[#17cf54]/10 animate-pulse" />
                                        <div className="absolute top-0 left-0 w-full h-1 bg-[#17cf54] shadow-[0_0_15px_#17cf54] z-10 animate-[scan_2s_ease-in-out_infinite]" />
                                        <span className="material-symbols-outlined text-stone-300 text-[60px]">
                                            id_card
                                        </span>
                                        <style>{`
                                    @keyframes scan {
                                        0% { top: 0; }
                                        50% { top: 100%; }
                                        100% { top: 0; }
                                    }
                                `}</style>
                                    </div>
                                    <h2 className="text-xl font-bold text-foreground">신분증 스캔 중...</h2>
                                    <p className="text-sm text-stone-500">카메라에 신분증을 맞춰주세요.</p>
                                </div>
                            )}

                            {step === "success" && (
                                <div className="text-center space-y-6 animate-in zoom-in-95 fade-in duration-500">
                                    <div className="w-24 h-24 bg-[#17cf54]/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                        <span className="material-symbols-outlined text-[48px] text-[#17cf54]">
                                            check_circle
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-foreground">인증 완료!</h2>
                                    <p className="text-sm text-stone-500">잠시 후 지갑 준비 단계로 이동합니다...</p>
                                </div>
                            )}

                            {step === "onboarding" && (
                                <div className="text-center space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
                                    <div className="w-20 h-20 bg-[#ab9ff2]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                        <span className="material-symbols-outlined text-[40px] text-[#ab9ff2]">
                                            account_balance_wallet
                                        </span>
                                    </div>

                                    <h2 className="text-2xl font-bold text-foreground">수익금을 받을 지갑 준비하기</h2>

                                    <div className="text-stone-600 text-sm space-y-4 max-w-sm mx-auto bg-stone-50 p-6 rounded-2xl text-left border border-stone-100">
                                        <p>
                                            부동산 조각 투자의 소유권과 매월 들어오는 임대 수익금은 고객님의 <b>개인 디지털 지갑(Web3 Wallet)</b>으로 안전하게 직접 지급됩니다.
                                        </p>
                                        <p className="text-xs text-stone-500 flex items-start gap-2 pt-2 border-t border-stone-200">
                                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-stone-400">info</span>
                                            <span>은행 계좌와 같은 역할을 하며, 솔라나(Solana) 네트워크를 지원하는 지갑 앱(예: Solflare 등)이 필요합니다.</span>
                                        </p>
                                    </div>

                                    <div className="space-y-3 pt-4">
                                        <Button
                                            className="w-full h-12 text-md font-bold bg-[#17cf54] hover:bg-[#14b847] text-white shadow-md"
                                            onClick={() => setVisible(true)}
                                        >
                                            지갑 연결하기
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 text-md font-bold text-stone-600 border-stone-300 hover:bg-stone-50"
                                            onClick={() => window.open('https://solflare.com/', '_blank')}
                                        >
                                            지갑이 없다면?
                                        </Button>
                                        <button
                                            className="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors mt-4 underline underline-offset-4"
                                            onClick={handleFinishKycOnly}
                                        >
                                            지갑 연결은 나중에 할게요 (둘러보기)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
