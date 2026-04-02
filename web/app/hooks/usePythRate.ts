import { useState, useEffect } from "react";
import { fetchPythKrwRate } from "~/lib/pyth";
import { KRW_PER_USDC_FALLBACK } from "~/lib/constants";

/**
 * Pyth Hermes에서 실시간 KRW/USD 환율을 가져오는 React hook.
 * initialRate: 서버 loader에서 넘겨준 초기값 (없으면 fallback 사용).
 */
export function usePythRate(initialRate?: number): { rate: number; loading: boolean } {
    const [rate, setRate] = useState(initialRate ?? KRW_PER_USDC_FALLBACK);
    const [loading, setLoading] = useState(!initialRate);

    useEffect(() => {
        fetchPythKrwRate()
            .then(setRate)
            .finally(() => setLoading(false));
    }, []);

    return { rate, loading };
}
