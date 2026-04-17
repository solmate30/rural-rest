import { describe, it, expect } from "vitest";
import {
    calcNights,
    calcTotalPrice,
    calcPreviewUsdc,
    calcEscrowRelease,
} from "./booking-calc";

// ──────────────────────────────────────────────
// calcNights
// ──────────────────────────────────────────────
describe("calcNights", () => {
    it("1박: 당일 체크인~익일 체크아웃", () => {
        expect(calcNights("2026-05-01", "2026-05-02")).toBe(1);
    });

    it("3박", () => {
        expect(calcNights("2026-05-01", "2026-05-04")).toBe(3);
    });

    it("시간 차이가 정확히 24h 미만이어도 ceil로 1박 처리", () => {
        expect(calcNights("2026-05-01T14:00:00", "2026-05-02T11:00:00")).toBe(1);
    });

    it("체크아웃 < 체크인 → 에러", () => {
        expect(() => calcNights("2026-05-05", "2026-05-01")).toThrow("체크아웃은 체크인 이후여야 합니다");
    });

    it("같은 날짜 (0박) → 에러", () => {
        expect(() => calcNights("2026-05-01", "2026-05-01")).toThrow("체크아웃은 체크인 이후여야 합니다");
    });
});

// ──────────────────────────────────────────────
// calcTotalPrice
// ──────────────────────────────────────────────
describe("calcTotalPrice", () => {
    it("1박 100,000원", () => {
        expect(calcTotalPrice(100_000, 1)).toBe(100_000);
    });

    it("3박 120,000원/박 = 360,000원", () => {
        expect(calcTotalPrice(120_000, 3)).toBe(360_000);
    });
});

// ──────────────────────────────────────────────
// calcPreviewUsdc (fallback rate 1350 KRW/USDC)
// ──────────────────────────────────────────────
describe("calcPreviewUsdc", () => {
    it("1,350,000 KRW → 1,000,000,000 micro-USDC (= 1,000 USDC)", () => {
        // 1,350,000 / 1350 = 1,000 USDC = 1,000 * 1_000_000 micro-USDC
        expect(calcPreviewUsdc(1_350_000)).toBe(1_000_000_000);
    });

    it("135,000 KRW → 100,000,000 micro-USDC (= 100 USDC)", () => {
        expect(calcPreviewUsdc(135_000)).toBe(100_000_000);
    });

    it("커스텀 환율 적용", () => {
        // 1,400 KRW/USDC, 700,000 KRW → 500 USDC → 500,000,000 micro-USDC
        expect(calcPreviewUsdc(700_000, 1400)).toBe(500_000_000);
    });

    it("krwPerUsdc = 0 → 에러", () => {
        expect(() => calcPreviewUsdc(100_000, 0)).toThrow("krwPerUsdc는 양수여야 합니다");
    });

    it("krwPerUsdc 음수 → 에러", () => {
        expect(() => calcPreviewUsdc(100_000, -1350)).toThrow("krwPerUsdc는 양수여야 합니다");
    });
});

// ──────────────────────────────────────────────
// calcEscrowRelease (온체인 Anchor 로직 미러)
// ──────────────────────────────────────────────
describe("calcEscrowRelease", () => {
    it("1,000,000 micro-USDC → host 900,000 / treasury 100,000", () => {
        const { hostAmount, treasuryAmount } = calcEscrowRelease(1_000_000);
        expect(hostAmount).toBe(900_000);
        expect(treasuryAmount).toBe(100_000);
    });

    it("host + treasury 합이 원금과 동일", () => {
        const amount = 1_234_567;
        const { hostAmount, treasuryAmount } = calcEscrowRelease(amount);
        expect(hostAmount + treasuryAmount).toBe(amount);
    });

    it("floor 반올림: 9 micro-USDC → treasury 0, host 9 (Anchor 정수 나눗셈 동일)", () => {
        const { hostAmount, treasuryAmount } = calcEscrowRelease(9);
        expect(treasuryAmount).toBe(0);
        expect(hostAmount).toBe(9);
    });

    it("10 micro-USDC → treasury 1, host 9", () => {
        const { hostAmount, treasuryAmount } = calcEscrowRelease(10);
        expect(treasuryAmount).toBe(1);
        expect(hostAmount).toBe(9);
    });

    it("실제 예약 금액: 1박 100,000 KRW 기준 USDC 에스크로 분배", () => {
        // 100,000 KRW / 1350 = ~74,074 micro-USDC (rounded)
        const microUsdc = calcPreviewUsdc(100_000);
        const { hostAmount, treasuryAmount } = calcEscrowRelease(microUsdc);
        expect(hostAmount + treasuryAmount).toBe(microUsdc);
        expect(treasuryAmount).toBe(Math.floor(microUsdc / 10));
    });
});
