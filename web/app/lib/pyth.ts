import { KRW_PER_USDC_FALLBACK, PYTH_USD_KRW_FEED_ID } from "~/lib/constants";

const PYTH_HERMES_URL = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_USD_KRW_FEED_ID}`;

/**
 * Pyth Hermes REST API에서 실시간 KRW/USD 환율 가져오기.
 * 서버 loader + 클라이언트 양쪽에서 사용 가능.
 * 실패 시 KRW_PER_USDC_FALLBACK 반환.
 */
export async function fetchPythKrwRate(): Promise<number> {
    try {
        const res = await fetch(PYTH_HERMES_URL, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return KRW_PER_USDC_FALLBACK;
        const data = await res.json();
        const p = data?.parsed?.[0]?.price;
        if (!p) return KRW_PER_USDC_FALLBACK;
        // KRW/USD feed: price × 10^expo = KRW per USD
        const krwPerUsd = Number(p.price) * Math.pow(10, Number(p.expo));
        if (krwPerUsd > 100 && krwPerUsd < 10000) return Math.round(krwPerUsd);
        return KRW_PER_USDC_FALLBACK;
    } catch {
        return KRW_PER_USDC_FALLBACK;
    }
}
