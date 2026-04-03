/**
 * 스크립트용 .env 로더 + 공통 상수
 * 사용: import { RPC_URL, RWA_PROGRAM_ID, ... } from "./_env";
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PublicKey } from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");

// .env 수동 로드 (스크립트는 Vite 밖에서 실행되므로)
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("export ")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

export const RPC_URL = process.env.VITE_SOLANA_RPC || "http://127.0.0.1:8899";
export const RWA_PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID || "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
export const DAO_PROGRAM_ID = new PublicKey(process.env.VITE_DAO_PROGRAM_ID || "3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX");
export const USDC_MINT = new PublicKey(process.env.VITE_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const COUNCIL_MINT_ADDR = process.env.VITE_COUNCIL_MINT || "";
export const CRANK_SECRET_KEY = process.env.CRANK_SECRET_KEY || "";
export const KRW_PER_USDC = 1350;
