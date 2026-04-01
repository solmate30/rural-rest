/**
 * USDC 표시 (소수점 자동 조절)
 * 0 → "0 USDC", 1.5 → "1.50 USDC", 0.00012 → "0.0001 USDC"
 */
export function fmtUsdc(v: number): string {
    if (v === 0) return "0 USDC";
    if (v >= 0.01) return `${v.toFixed(2)} USDC`;
    if (v >= 0.0001) return `${v.toFixed(4)} USDC`;
    return `${v.toFixed(6)} USDC`;
}

/**
 * KRW 표시 — ₩ 접두사 (테이블/카드용)
 * 1500 → "₩1,500", 0.5 → "₩0.50"
 */
export function fmtKrw(v: number): string {
    if (v >= 1) return `₩${Math.floor(v).toLocaleString()}`;
    return `₩${v.toFixed(2)}`;
}

/**
 * KRW 표시 — 억/만 단위 (큰 금액용, locale 지원)
 *
 * ko (기본): 150000000 → "1.5억 원", 50000 → "5만 원", 3000 → "3,000원"
 * en:        150000000 → "₩150M",    50000 → "₩50K",    3000 → "₩3,000"
 */
export function formatKrwLabel(won: number, locale: "ko" | "en" = "ko"): string {
    if (locale === "en") {
        if (won >= 1_000_000) {
            const m = won / 1_000_000;
            return `₩${m % 1 === 0 ? m : m.toFixed(1)}M`;
        }
        if (won >= 1_000) {
            const k = won / 1_000;
            return `₩${k % 1 === 0 ? k : k.toFixed(0)}K`;
        }
        return `₩${won.toLocaleString("en-US")}`;
    }

    // 한국어 (기존 로직 유지)
    if (won >= 1_0000_0000) {
        const eok = won / 1_0000_0000;
        return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억 원`;
    }
    if (won >= 1_0000) {
        const man = won / 1_0000;
        return `${man % 1 === 0 ? man : man.toFixed(0)}만 원`;
    }
    return `${won.toLocaleString()}원`;
}
