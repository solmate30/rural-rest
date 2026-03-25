import React, { createContext, useContext, useEffect, useState } from "react";

interface KycContextType {
    isKycCompleted: boolean;
    completeKyc: () => void;
    resetKyc: () => void;
}

const KycContext = createContext<KycContextType | undefined>(undefined);

export function KycProvider({ children }: { children: React.ReactNode }) {
    const [isKycCompleted, setIsKycCompleted] = useState<boolean>(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // localStorage에서 낙관적으로 먼저 읽기 (깜빡임 방지)
        const cached = localStorage.getItem("ruralrest_kyc");
        if (cached === "true") setIsKycCompleted(true);

        // DB에서 실제 상태 동기화
        fetch("/api/user/kyc-status")
            .then((res) => {
                if (!res.ok) {
                    // 로그인 안 된 경우 (401) → false
                    setIsKycCompleted(false);
                    localStorage.removeItem("ruralrest_kyc");
                    return null;
                }
                return res.json() as Promise<{ kycVerified: boolean }>;
            })
            .then((data) => {
                if (!data) return;
                setIsKycCompleted(data.kycVerified);
                if (data.kycVerified) {
                    localStorage.setItem("ruralrest_kyc", "true");
                } else {
                    localStorage.removeItem("ruralrest_kyc");
                }
            })
            .catch(() => {
                // 네트워크 오류 시 localStorage 값 유지
            })
            .finally(() => setIsLoaded(true));
    }, []);

    const completeKyc = () => {
        setIsKycCompleted(true);
        localStorage.setItem("ruralrest_kyc", "true");
    };

    const resetKyc = () => {
        setIsKycCompleted(false);
        localStorage.removeItem("ruralrest_kyc");
    };

    if (!isLoaded) return null;

    return (
        <KycContext.Provider value={{ isKycCompleted, completeKyc, resetKyc }}>
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
