// 클라이언트 + 서버 공용 상수
// 환경변수는 VITE_ prefix (브라우저에서 접근 가능)

export const PROGRAM_ID = import.meta.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
export const DAO_PROGRAM_ID = import.meta.env.VITE_DAO_PROGRAM_ID ?? "3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX";
export const USDC_MINT = import.meta.env.VITE_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// Pyth USD/KRW 피드 (1 KRW당 USD 가격, 온체인에서 역수로 변환)
// 실제 계산은 Anchor 프로그램 내에서 수행 (Pyth oracle 사용)
export const PYTH_USD_KRW_FEED_DEVNET  = "Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD";
export const PYTH_USD_KRW_FEED_MAINNET = "GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU";
export const PYTH_USD_KRW_FEED = import.meta.env.VITE_PYTH_USD_KRW_FEED ?? PYTH_USD_KRW_FEED_DEVNET;

// Pyth Hermes REST 피드 ID (오프체인 환율 미리보기용)
export const PYTH_USD_KRW_FEED_ID = "e539120487c29b4defdf9a53d337316ea022a2688978a468f9efd847201be7e3";

// UI 표시용 fallback 환율 (Hermes 호출 실패 시)
export const KRW_PER_USDC_FALLBACK = 1350;

export const TOTAL_SUPPLY = 100_000_000;
