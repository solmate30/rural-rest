/**
 * setup-devnet.ts — Devnet 초기화 스크립트
 *
 * 한 번에 처리:
 *   1. Fake USDC Mint 생성 (SPL Token, decimals=6)
 *   2. RwaConfig 초기화 + crankAuthority 등록
 *   3. Council Mint (Token-2022) 생성 + DaoConfig 초기화
 *   4. .env의 VITE_USDC_MINT / VITE_COUNCIL_MINT / VITE_SOLANA_RPC 자동 업데이트
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/setup-devnet.ts
 *
 * 전제조건:
 *   - anchor deploy --provider.cluster devnet 완료
 *   - ~/.config/solana/id.json 에 admin keypair (devnet SOL 보유)
 *   - .env에 VITE_RWA_PROGRAM_ID, VITE_DAO_PROGRAM_ID 설정됨
 *   - CRANK_SECRET_KEY .env에 설정됨 (없으면 admin keypair 사용)
 */

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    createMint,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = "https://api.devnet.solana.com";
const ENV_PATH = path.join(__dirname, "../.env");
const ENV_LOCAL_PATH = path.join(__dirname, "../.env.local");
const KEYPAIR_PATH = path.join(process.env.HOME!, ".config/solana/id.json");

const VOTING_PERIOD = new BN(7 * 24 * 60 * 60); // 7일
const QUORUM_BPS = 1000;                          // 10%
const APPROVAL_THRESHOLD_BPS = 5000;             // 50%
const VOTING_CAP_BPS = 10000;

// ── .env 업데이트 헬퍼 ────────────────────────────────────────────────────────

function patchEnvFile(filePath: string, key: string, value: string) {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const regex = new RegExp(`^(#\\s*)?${key}=.*$`, "m");
    const newLine = `${key}=${value}`;
    if (regex.test(content)) {
        content = content.replace(regex, newLine);
    } else {
        content += `\n${newLine}\n`;
    }
    fs.writeFileSync(filePath, content, "utf-8");
}

function updateEnv(key: string, value: string) {
    patchEnvFile(ENV_PATH, key, value);
    if (fs.existsSync(ENV_LOCAL_PATH)) {
        patchEnvFile(ENV_LOCAL_PATH, key, value);
        console.log(`  → .env.local ${key} 도 업데이트`);
    }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("=== Devnet 초기화 시작 ===\n");

    // .env 로드
    const dotenv = await import("dotenv");
    dotenv.config({ path: ENV_PATH });

    const RWA_PROGRAM_ID = new PublicKey(
        process.env.VITE_RWA_PROGRAM_ID ?? (() => { throw new Error("VITE_RWA_PROGRAM_ID 미설정"); })()
    );
    const DAO_PROGRAM_ID = new PublicKey(
        process.env.VITE_DAO_PROGRAM_ID ?? (() => { throw new Error("VITE_DAO_PROGRAM_ID 미설정"); })()
    );

    // admin keypair 로드
    if (!fs.existsSync(KEYPAIR_PATH)) {
        console.error(`keypair 없음: ${KEYPAIR_PATH}`);
        process.exit(1);
    }
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
    );

    // crank keypair 로드
    const crankSecretKeyStr = process.env.CRANK_SECRET_KEY;
    let crankKeypair: Keypair;
    if (crankSecretKeyStr) {
        const bs58 = await import("bs58");
        crankKeypair = Keypair.fromSecretKey(bs58.default.decode(crankSecretKeyStr));
    } else {
        console.warn("CRANK_SECRET_KEY 미설정 — admin keypair를 council mint authority로 사용");
        crankKeypair = authority;
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });

    console.log(`RPC:        ${RPC_URL}`);
    console.log(`Authority:  ${authority.publicKey.toBase58()}`);
    console.log(`Crank:      ${crankKeypair.publicKey.toBase58()}`);
    console.log(`RWA ID:     ${RWA_PROGRAM_ID.toBase58()}`);
    console.log(`DAO ID:     ${DAO_PROGRAM_ID.toBase58()}`);
    console.log();

    // SOL 잔액 확인
    const adminSol = await connection.getBalance(authority.publicKey);
    console.log(`Admin SOL:  ${(adminSol / LAMPORTS_PER_SOL).toFixed(3)}`);
    if (adminSol < 0.1 * LAMPORTS_PER_SOL) {
        console.error("SOL 부족. https://faucet.solana.com 에서 devnet SOL을 충전하세요.");
        process.exit(1);
    }
    console.log();

    // ── Step 1: Devnet 공식 USDC Mint ────────────────────────────────────────
    // Circle 공식 devnet USDC — Phantom 등 지갑에서 그대로 인식됨
    console.log("[ 1/3 ] USDC Mint 설정...");
    const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
    const usdcMint = new PublicKey(DEVNET_USDC);
    updateEnv("VITE_USDC_MINT", DEVNET_USDC);
    console.log(`  Circle devnet USDC: ${DEVNET_USDC}`);
    console.log(`  VITE_USDC_MINT 업데이트 완료`);
    console.log(`  ※ 테스트 지갑 USDC 충전: https://faucet.circle.com`);
    console.log();

    // ── Step 2: RwaConfig 초기화 ──────────────────────────────────────────────
    console.log("[ 2/3 ] RwaConfig 초기화...");
    const RWA_IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );
    const rwaProgram = new Program(RWA_IDL, provider);

    const [rwaConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        RWA_PROGRAM_ID,
    );

    const existingRwa = await connection.getAccountInfo(rwaConfigPda);
    if (!existingRwa) {
        const tx = await (rwaProgram.methods as any)
            .initializeConfig()
            .accounts({
                authority: authority.publicKey,
                rwaConfig: rwaConfigPda,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        console.log(`  PDA: ${rwaConfigPda.toBase58()}`);
        console.log(`  tx:  ${tx}`);
    } else {
        console.log(`  이미 초기화됨: ${rwaConfigPda.toBase58()}`);
    }

    const setCrankTx = await (rwaProgram.methods as any)
        .setCrankAuthority(crankKeypair.publicKey)
        .accounts({
            authority: authority.publicKey,
            rwaConfig: rwaConfigPda,
        })
        .rpc();
    console.log(`  crankAuthority 설정: ${crankKeypair.publicKey.toBase58()}`);
    console.log(`  tx: ${setCrankTx}`);
    console.log();

    // ── Step 3: Council Mint + DaoConfig 초기화 ───────────────────────────────
    console.log("[ 3/3 ] Council Mint + DAO 초기화...");
    const DAO_IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_dao.json"), "utf-8")
    );
    const daoProgram = new Program(DAO_IDL, provider);

    const [daoConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")],
        DAO_PROGRAM_ID,
    );

    const existingDao = await connection.getAccountInfo(daoConfigPda);
    if (existingDao) {
        console.log(`  DaoConfig 이미 초기화됨: ${daoConfigPda.toBase58()}`);
        if (!process.env.VITE_COUNCIL_MINT) {
            const cfg = await (daoProgram.account as any).daoConfig.fetch(daoConfigPda);
            const mintAddr = (cfg as any).councilMint.toBase58();
            updateEnv("VITE_COUNCIL_MINT", mintAddr);
            console.log(`  VITE_COUNCIL_MINT 복구: ${mintAddr}`);
        }
    } else {
        const councilMint = await createMint(
            connection,
            authority,
            crankKeypair.publicKey,
            null,
            0,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID,
        );
        console.log(`  Council Mint: ${councilMint.toBase58()}`);
        updateEnv("VITE_COUNCIL_MINT", councilMint.toBase58());

        const tx = await daoProgram.methods
            .initializeDao(
                VOTING_PERIOD,
                QUORUM_BPS,
                APPROVAL_THRESHOLD_BPS,
                VOTING_CAP_BPS,
                RWA_PROGRAM_ID,
            )
            .accounts({
                authority: authority.publicKey,
                daoConfig: daoConfigPda,
                councilMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .rpc();
        console.log(`  DaoConfig: ${daoConfigPda.toBase58()}`);
        console.log(`  tx:        ${tx}`);
    }

    // ── .env VITE_SOLANA_RPC devnet으로 업데이트 ──────────────────────────────
    updateEnv("VITE_SOLANA_RPC", RPC_URL);
    console.log(`\n  VITE_SOLANA_RPC → ${RPC_URL}`);

    console.log("\n==========================================");
    console.log("  Devnet 초기화 완료");
    console.log("==========================================");
    console.log();
    console.log("다음 단계:");
    console.log("  1. 개발 서버 재시작: npm run dev");
    console.log("  2. 테스트 매물 추가: npx tsx scripts/seed-test-listing.ts");
    console.log("  3. 테스트 지갑 USDC 충전: npx tsx scripts/dev-faucet.ts (있는 경우)");
}

main().catch((e) => {
    console.error("\n초기화 실패:", e.message ?? e);
    process.exit(1);
});
