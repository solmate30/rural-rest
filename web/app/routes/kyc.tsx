import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useKyc } from "../components/KycProvider";
import { Button, Card, Header, Footer } from "../components/ui-mockup";
import { useSession } from "~/lib/privy-hooks";

export function meta() {
    return [
        { title: "KYC Verification | Rural Rest" },
        { name: "description", content: "Complete identity verification to invest in RWA." },
    ];
}

export default function KycRoute() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get("return") ?? "/invest";
    const { t } = useTranslation("kyc");

    const { isKycCompleted, completeKyc } = useKyc();
    const sessionRes = useSession();

    const [step, setStep] = useState<"intro" | "scanning" | "success">("intro");

    // 로그인 필수
    useEffect(() => {
        if (!sessionRes?.isPending && !sessionRes?.data) {
            navigate("/auth?return=/kyc");
        }
    }, [sessionRes, navigate]);

    // 이미 KYC 완료 시 바로 이동
    useEffect(() => {
        if (isKycCompleted && step !== "success") {
            navigate(returnUrl);
        }
    }, [isKycCompleted, step, navigate, returnUrl]);

    const handleStartScan = () => {
        setStep("scanning");
        setTimeout(() => {
            setStep("success");
            fetch("/api/user/save-kyc", { method: "POST" }).catch(() => {});
            setTimeout(() => {
                completeKyc();
                navigate(returnUrl);
            }, 2000);
        }, 3000);
    };

    return (
        <div className="min-h-screen bg-[#FAF9F6] font-sans flex flex-col">
            <Header />

            <main className="flex-1 container mx-auto px-4 py-8 md:py-16 flex items-center justify-center">
                <div className={`w-full grid grid-cols-1 gap-8 items-center ${step === "intro" ? "max-w-5xl lg:grid-cols-2 lg:gap-16" : "max-w-md"}`}>

                    {/* Left: Branding & Trust */}
                    <div className={`flex-col space-y-8 animate-in fade-in slide-in-from-left-8 duration-700 pt-8 ${step === "intro" ? "hidden lg:flex" : "hidden"}`}>
                        <div>
                            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold text-[#17cf54] bg-[#17cf54]/10 border border-[#17cf54]/20 rounded-full tracking-widest uppercase">
                                {t("badge")}
                            </span>
                            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-[1.2]">
                                {t("heading1")}<br />
                                <span className="text-[#8D6E63] font-['Gaegu'] text-5xl md:text-6xl mt-2 block">{t("heading2")}</span>
                            </h1>
                            <p className="mt-6 text-stone-500 text-lg max-w-md leading-relaxed">
                                {t("desc")}
                            </p>
                        </div>

                        <div className="space-y-6 pt-4 border-t border-stone-200/60 max-w-sm">
                            <div className="flex gap-4 group cursor-default">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-stone-100 group-hover:bg-stone-50 transition-colors">
                                    <span className="material-symbols-outlined text-[#17cf54] text-[24px]">verified_user</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-800">{t("feature.identity.title")}</h3>
                                    <p className="text-sm text-stone-500 mt-1">{t("feature.identity.desc")}</p>
                                </div>
                            </div>
                            <div className="flex gap-4 group cursor-default">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-stone-100 group-hover:bg-stone-50 transition-colors">
                                    <span className="material-symbols-outlined text-amber-500 text-[24px]">lock</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-800">{t("feature.privacy.title")}</h3>
                                    <p className="text-sm text-stone-500 mt-1">{t("feature.privacy.desc")}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: KYC Card */}
                    <div className="w-full max-w-md mx-auto relative lg:mr-0 z-10">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#8D6E63]/10 blur-3xl -z-10 rounded-full hidden lg:block" />

                        <Card className="w-full bg-white/95 backdrop-blur-sm rounded-[calc(var(--radius)*2)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-stone-100 relative overflow-hidden">
                            <div className="h-[480px] flex flex-col items-center justify-center p-8 md:p-10">

                                {step === "intro" && (
                                    <div className="w-full text-center space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                                            <span className="material-symbols-outlined text-[40px] text-stone-600">badge</span>
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold text-foreground font-['Gaegu']">{t("form.title")}</h1>
                                            <p className="text-stone-500 text-sm max-w-xs mx-auto mt-2">
                                                {t("form.desc")}
                                            </p>
                                        </div>
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start text-left">
                                            <span className="material-symbols-outlined text-amber-600 mt-0.5 text-[18px]">lock</span>
                                            <p className="text-xs text-amber-800 leading-relaxed">
                                                {t("form.privacy")}
                                            </p>
                                        </div>
                                        <Button
                                            className="w-full h-12 text-md font-bold bg-[#8D6E63] hover:bg-[#7a5e55] text-white"
                                            onClick={handleStartScan}
                                        >
                                            {t("form.start")}
                                        </Button>
                                        <button
                                            className="text-xs font-bold text-stone-400 hover:text-stone-600 transition-colors"
                                            onClick={() => navigate("/")}
                                        >
                                            {t("form.later")}
                                        </button>
                                    </div>
                                )}

                                {step === "scanning" && (
                                    <div className="w-full text-center space-y-6 animate-in fade-in duration-300">
                                        <div className="relative w-64 h-40 mx-auto rounded-xl border-4 border-dashed border-[#17cf54] p-2 flex items-center justify-center bg-stone-50 overflow-hidden">
                                            <div className="absolute inset-0 bg-[#17cf54]/10 animate-pulse" />
                                            <div className="absolute top-0 left-0 w-full h-1 bg-[#17cf54] shadow-[0_0_15px_#17cf54] z-10 animate-[scan_2s_ease-in-out_infinite]" />
                                            <span className="material-symbols-outlined text-stone-300 text-[60px]">id_card</span>
                                            <style>{`
                                                @keyframes scan {
                                                    0% { top: 0; }
                                                    50% { top: 100%; }
                                                    100% { top: 0; }
                                                }
                                            `}</style>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-foreground">{t("scan.title")}</h2>
                                            <p className="text-sm text-stone-500 mt-1">{t("scan.instruction")}</p>
                                        </div>
                                    </div>
                                )}

                                {step === "success" && (
                                    <div className="w-full text-center space-y-6 animate-in zoom-in-95 fade-in duration-500">
                                        <div className="w-24 h-24 bg-[#17cf54]/10 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                            <span className="material-symbols-outlined text-[48px] text-[#17cf54]">check_circle</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-foreground">{t("done.title")}</h2>
                                            <p className="text-sm text-stone-500 mt-1">{t("done.message")}</p>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </Card>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
