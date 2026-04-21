/**
 * _state.ts — 시나리오 단계 간 공유 상태 (state.json)
 *
 * 각 스크립트는 이 모듈로 state를 읽고/쓴다.
 * state.json은 gitignore 대상 (keypair 포함).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STATE_PATH = path.join(__dirname, "state.json");

export interface ScenarioState {
    investor1:  string; // bs58 secret key
    investor2:  string;
    investor3:  string;
    guest:      string;
    treasury:   string;
    mintKp1:    string; // e2e001 token mint
    mintKp2:    string; // e2e002 token mint
    mintKp3:    string; // e2e003 token mint
    inv1Usdc:   string; // PublicKey (USDC ATA)
    inv2Usdc:   string;
    inv3Usdc:   string;
    guestUsdc:  string;
}

export function loadState(): ScenarioState {
    if (!fs.existsSync(STATE_PATH)) {
        throw new Error(`state.json 없음. 먼저 01-tokenize.ts를 실행하세요.\n경로: ${STATE_PATH}`);
    }
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

export function saveState(state: ScenarioState) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function kp(secretKey: string): Keypair {
    return Keypair.fromSecretKey(bs58.decode(secretKey));
}

export function pk(addr: string): PublicKey {
    return new PublicKey(addr);
}
