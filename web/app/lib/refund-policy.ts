/**
 * 확정 예약 취소 환불 정책
 * cancel-confirmed 라우트와 단위 테스트 양쪽에서 공유하는 순수 함수.
 */

/**
 * 체크인까지 남은 일수를 기준으로 환불율(basis points)을 반환한다.
 * - 7일 이상 전: 10000 (100%)
 * - 3일 이상 7일 미만: 5000 (50%)
 * - 3일 미만: 0 (0%)
 */
export function calcRefundBps(checkIn: Date, now: Date): number {
    const daysUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilCheckIn >= 7 ? 10000 : daysUntilCheckIn >= 3 ? 5000 : 0;
}
