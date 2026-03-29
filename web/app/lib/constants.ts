// 클라이언트 + 서버 공용 상수
// 환경변수는 VITE_ prefix (브라우저에서 접근 가능)

export const PROGRAM_ID = import.meta.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
export const USDC_MINT = import.meta.env.VITE_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// TODO: Pyth oracle로 교체
export const KRW_PER_USDC = 1350;

export const TOTAL_SUPPLY = 100_000_000;
