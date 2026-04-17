/**
 * booking-calc.ts
 * 예약/결제 계산 순수 함수 모음.
 * 서버/클라이언트 모두 import 가능 (외부 의존 없음).
 */

/** 체크인~체크아웃 박수 계산 */
export function calcNights(checkIn: string | Date, checkOut: string | Date): number {
    const inMs  = new Date(checkIn).getTime();
    const outMs = new Date(checkOut).getTime();
    const nights = Math.ceil((outMs - inMs) / (1000 * 60 * 60 * 24));
    if (nights <= 0) throw new Error("체크아웃은 체크인 이후여야 합니다");
    return nights;
}

/** 총 숙박료 (KRW) */
export function calcTotalPrice(pricePerNight: number, nights: number): number {
    return pricePerNight * nights;
}

/**
 * KRW → micro-USDC 변환 (fallback 환율 사용, 미리보기 전용).
 * 온체인 실제 금액은 Pyth 오라클로 계산됨.
 * @param totalKrw  총 KRW 금액
 * @param krwPerUsdc  1 USDC = N KRW (기본값 1350)
 * @returns micro-USDC (소수점 6자리, e.g. 1000 USDC = 1_000_000_000)
 */
export function calcPreviewUsdc(totalKrw: number, krwPerUsdc = 1350): number {
    if (krwPerUsdc <= 0) throw new Error("krwPerUsdc는 양수여야 합니다");
    return Math.round((totalKrw / krwPerUsdc) * 1_000_000);
}

/**
 * 에스크로 릴리스 분배 계산 (온체인 Anchor 로직 미러).
 * Anchor: treasury_amount = amount / 10 (정수 나눗셈 = floor)
 *         host_amount = amount - treasury_amount
 *
 * @param amountMicroUsdc  총 에스크로 금액 (micro-USDC)
 * @returns { hostAmount, treasuryAmount }
 */
export function calcEscrowRelease(amountMicroUsdc: number): {
    hostAmount: number;
    treasuryAmount: number;
} {
    const treasuryAmount = Math.floor(amountMicroUsdc / 10);
    const hostAmount = amountMicroUsdc - treasuryAmount;
    return { hostAmount, treasuryAmount };
}
