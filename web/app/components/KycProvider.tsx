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
        // Load from localStorage on mount
        const stored = localStorage.getItem("ruralrest_kyc");
        if (stored === "true") {
            setIsKycCompleted(true);
        }
        setIsLoaded(true);
    }, []);

    const completeKyc = () => {
        setIsKycCompleted(true);
        localStorage.setItem("ruralrest_kyc", "true");
    };

    const resetKyc = () => {
        setIsKycCompleted(false);
        localStorage.removeItem("ruralrest_kyc");
    };

    // Prevent hydration mismatch or premature redirects by not rendering until loaded
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
