// 서버 전용 상수 (process.env — 브라우저에서 접근 불가)

export const RPC_URL = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
export const SERVER_PROGRAM_ID = process.env.RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
export const SERVER_DAO_PROGRAM_ID = process.env.DAO_PROGRAM_ID ?? "3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX";
// USDC Mint: 서버에서 crank 자동화 시 ATA 계산에 사용
export const SERVER_USDC_MINT = process.env.USDC_MINT ?? process.env.VITE_USDC_MINT ?? "";
// Crank 자동화 키 (base58 인코딩 private key)
// set_crank_authority 로 RwaConfig에 등록된 키와 일치해야 함
export const CRANK_SECRET_KEY = process.env.CRANK_SECRET_KEY ?? "";
// 지자체·운영자 고정 수령 지갑 (서버 전용 — VITE_ 아님)
export const LOCAL_GOV_WALLET = process.env.LOCAL_GOV_WALLET ?? "";
export const OPERATOR_WALLET = process.env.OPERATOR_WALLET ?? "";
