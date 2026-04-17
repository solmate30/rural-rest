/**
 * 확정 예약 취소 환불 정책 단위 테스트
 *
 * ~/lib/refund-policy.ts의 calcRefundBps 함수를 직접 import해서 검증한다.
 * 외부 의존성(DB, Solana, PayPal) 없음 — 순수 수학 계산만
 */

import { describe, it, expect } from "vitest";
import { calcRefundBps } from "~/lib/refund-policy";

// 테스트 헬퍼: 오늘 기준 N일 후 날짜 반환
function daysFromNow(days: number, now: Date = new Date()): Date {
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("확정 예약 취소 환불 정책 — refundBps 계산", () => {
    const now = new Date("2025-01-15T10:00:00Z");

    describe("100% 환불 (10000 bps) — 체크인 7일 이상 전", () => {
        it("정확히 7일 전 → 10000", () => {
            const checkIn = daysFromNow(7, now);
            expect(calcRefundBps(checkIn, now)).toBe(10000);
        });

        it("10일 전 → 10000", () => {
            const checkIn = daysFromNow(10, now);
            expect(calcRefundBps(checkIn, now)).toBe(10000);
        });

        it("30일 전 → 10000", () => {
            const checkIn = daysFromNow(30, now);
            expect(calcRefundBps(checkIn, now)).toBe(10000);
        });
    });

    describe("50% 환불 (5000 bps) — 체크인 3일 이상 7일 미만 전", () => {
        it("정확히 3일 전 → 5000", () => {
            const checkIn = daysFromNow(3, now);
            expect(calcRefundBps(checkIn, now)).toBe(5000);
        });

        it("5일 전 → 5000", () => {
            const checkIn = daysFromNow(5, now);
            expect(calcRefundBps(checkIn, now)).toBe(5000);
        });

        it("6.9일 전 (7일 미만) → 5000", () => {
            const checkIn = daysFromNow(6.9, now);
            expect(calcRefundBps(checkIn, now)).toBe(5000);
        });
    });

    describe("0% 환불 (0 bps) — 체크인 3일 미만 전", () => {
        it("2일 전 → 0", () => {
            const checkIn = daysFromNow(2, now);
            expect(calcRefundBps(checkIn, now)).toBe(0);
        });

        it("당일 → 0", () => {
            const checkIn = daysFromNow(0, now);
            expect(calcRefundBps(checkIn, now)).toBe(0);
        });

        it("이미 체크인 지남 (음수) → 0", () => {
            const checkIn = daysFromNow(-1, now);
            expect(calcRefundBps(checkIn, now)).toBe(0);
        });
    });

    describe("경계값 — 정확히 3일 / 7일", () => {
        it("3일 = 72시간 정확히 → 5000 (3일 이상)", () => {
            const checkIn = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            expect(calcRefundBps(checkIn, now)).toBe(5000);
        });

        it("7일 = 168시간 정확히 → 10000 (7일 이상)", () => {
            const checkIn = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            expect(calcRefundBps(checkIn, now)).toBe(10000);
        });

        it("2일 23시간 59분 → 0 (3일 미만)", () => {
            const checkIn = new Date(now.getTime() + (3 * 24 * 60 * 60 - 1) * 1000);
            expect(calcRefundBps(checkIn, now)).toBe(0);
        });

        it("6일 23시간 59분 → 5000 (7일 미만)", () => {
            const checkIn = new Date(now.getTime() + (7 * 24 * 60 * 60 - 1) * 1000);
            expect(calcRefundBps(checkIn, now)).toBe(5000);
        });
    });
});

// ── PayPal 부분 환불 금액 계산 ───────────────────────────────────────────
describe("PayPal 50% 환불 KRW→USD 변환", () => {
    function calcPartialRefundUsd(totalPriceKrw: number, krwPerUsd: number): string {
        const refundKrw = Math.floor(totalPriceKrw * 0.5);
        return (refundKrw / krwPerUsd).toFixed(2);
    }

    it("100,000 KRW / 1350 KRW per USD → $37.04", () => {
        expect(calcPartialRefundUsd(100_000, 1350)).toBe("37.04");
    });

    it("200,000 KRW / 1300 KRW per USD → $76.92", () => {
        expect(calcPartialRefundUsd(200_000, 1300)).toBe("76.92");
    });

    it("홀수 KRW → Math.floor 적용", () => {
        // 100,001 KRW → floor(50000.5) = 50000 → 50000/1350 = 37.04
        const refundKrw = Math.floor(100_001 * 0.5);
        expect(refundKrw).toBe(50000);
        expect(calcPartialRefundUsd(100_001, 1350)).toBe("37.04");
    });
});
