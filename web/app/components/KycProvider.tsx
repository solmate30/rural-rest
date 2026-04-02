import React, { createContext, useContext, useEffect, useState } from "react";

interface KycContextType {
    isKycCompleted: boolean;
    /** DB에 등록된 지갑 주소 (KYC 완료 시 저장됨) */
    registeredWallet: string | null;
    completeKyc: () => void;
    resetKyc: () => void;
}

const KycContext = createContext<KycContextType | undefined>(undefined);

export function KycProvider({ children }: { children: React.ReactNode }) {
    const [isKycCompleted, setIsKycCompleted] = useState<boolean>(false);
    const [registeredWallet, setRegisteredWallet] = useState<string | null>(null);

    useEffect(() => {
        // localStorage에서 낙관적으로 먼저 읽기 (깜빡임 방지)
        const cached = localStorage.getItem("ruralrest_kyc");
        if (cached === "true") setIsKycCompleted(true);

        // DB에서 실제 상태 동기화
        fetch("/api/user/kyc-status")
            .then((res) => {
                if (!res.ok) {
                    setIsKycCompleted(false);
                    setRegisteredWallet(null);
                    localStorage.removeItem("ruralrest_kyc");
                    return null;
                }
                return res.json() as Promise<{ kycVerified: boolean; walletAddress: string | null }>;
            })
            .then((data) => {
                if (!data) return;
                setIsKycCompleted(data.kycVerified);
                setRegisteredWallet(data.walletAddress);
                if (data.kycVerified) {
                    localStorage.setItem("ruralrest_kyc", "true");
                } else {
                    localStorage.removeItem("ruralrest_kyc");
                }
            })
            .catch(() => {
                // 네트워크 오류 시 localStorage 값 유지
            });
    }, []);

    const completeKyc = () => {
        setIsKycCompleted(true);
        localStorage.setItem("ruralrest_kyc", "true");
    };

    const resetKyc = () => {
        setIsKycCompleted(false);
        setRegisteredWallet(null);
        localStorage.removeItem("ruralrest_kyc");
    };

    return (
        <KycContext.Provider value={{ isKycCompleted, registeredWallet, completeKyc, resetKyc }}>
            {children}
        </KycContext.Provider>
    );
}

export function useKyc() {
    const context = useContext(KycContext);
    if (!context) {
        throw new Error("useKyc must be used within a KycProvider");
    }
    return context;
}
