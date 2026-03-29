// 서버 전용 상수 (process.env — 브라우저에서 접근 불가)

export const RPC_URL = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
export const SERVER_PROGRAM_ID = process.env.RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";
