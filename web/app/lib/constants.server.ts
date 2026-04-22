// 서버 전용 상수
// VITE_ 값은 process.env.VITE_*로 서버에서도 접근 가능 (Vite SSR)
// 시크릿은 VITE_ 없이 process.env.*로만 접근

export const RPC_URL = process.env.VITE_SOLANA_RPC ?? "http://127.0.0.1:8899";
export const SERVER_PROGRAM_ID = process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
export const SERVER_DAO_PROGRAM_ID = process.env.VITE_DAO_PROGRAM_ID ?? "3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX";
export const SERVER_USDC_MINT = process.env.VITE_USDC_MINT ?? "";
export const TREASURY_PUBKEY = process.env.VITE_TREASURY_PUBKEY ?? "9uAQniNkxo4zvxLVgrardFUnJdrafMod76GJiNG5T3Zc";
export const COUNCIL_MINT = process.env.VITE_COUNCIL_MINT ?? "";
export const PRIVY_APP_ID = process.env.VITE_PRIVY_APP_ID ?? "";

// 서버 전용 시크릿 (절대 VITE_ prefix 붙이지 말 것)
export const CRANK_SECRET_KEY = process.env.CRANK_SECRET_KEY ?? "";
export const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";
export const LOCAL_GOV_WALLET = process.env.VITE_LOCAL_GOV_WALLET ?? "";
export const OPERATOR_WALLET = process.env.VITE_OPERATOR_WALLET ?? "";
