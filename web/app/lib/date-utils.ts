/**
 * date-utils.ts — 날짜/시간 파싱·포맷 유틸리티
 *
 * 핵심 원칙:
 *   new Date("YYYY-MM-DD")는 UTC 자정으로 파싱됨 → KST(UTC+9)에서 9시간 오차 발생.
 *   모든 날짜 파싱은 이 파일의 함수를 통해 로컬 시간 기준으로 처리한다.
 */

// ── 파싱 ────────────────────────────────────────────────────────────────────

/**
 * "YYYY-MM-DD" 문자열 → 로컬 자정 Date
 * (new Date("YYYY-MM-DD")의 UTC 파싱 버그 방지)
 */
export function parseLocalDate(s: string): Date {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/**
 * "YYYY-MM-DD" 문자열 → 로컬 자정 Unix timestamp (초)
 */
export function parseLocalDateToUnix(s: string): number {
    return Math.floor(parseLocalDate(s).getTime() / 1000);
}

// ── 포맷 ────────────────────────────────────────────────────────────────────

/**
 * Date → "YYYY-MM-DD" (로컬 날짜 컴포넌트 사용)
 */
export function toLocalDateStr(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Date → "YYYY-MM-DDTHH:mm" (datetime-local input용, 로컬 시간)
 * (toISOString()은 UTC라 KST와 9h 차이남)
 */
export function toLocalDatetimeStr(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * DB에서 꺼낸 Date 객체 → "YYYY-MM-DD" 표시용 문자열
 * DB에 UTC 자정으로 저장된 날짜를 로컬 날짜로 변환
 */
export function dbDateToLocalStr(d: Date): string {
    return toLocalDateStr(d);
}
