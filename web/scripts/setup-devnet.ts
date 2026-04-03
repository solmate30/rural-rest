/**
 * setup-devnet.ts — Devnet 전체 초기화 스크립트
 *
 * 한 번에 처리:
 *   1. Fake USDC Mint 생성 (SPL Token, decimals=6)
 *   2. RwaConfig 초기화
 *   3. Council Mint 생성 + DaoConfig 초기화
 *   4. .env의 VITE_USDC_MINT / VITE_COUNCIL_MINT 자동 업데이트
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/setup-devnet.ts
 *
 * 전제조건:
 *   - anchor deploy --provider.cluster devnet 완료
 *   - ~/.config/solana/id.json 에 admin keypair 저장됨
 *   - admin 지갑에 devnet SOL 충분 (solana airdrop 2 <주소> --url devnet)
 *   - .env에 CRANK_SECRET_KEY 설정됨
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

// ── 상수 ──────────────────────────────────────────────────────────────────────
const RPC_URL = "https://api.devnet.solana.com";
const ENV_PATH = path.join(__dirname, "../.env");
const KEYPAIR_PATH = path.join(process.env.HOME!, ".config/solana/id.json");

const RWA_PROGRAM_ID = new PublicKey("BAJ2fSZGZMkt6dFs4Rn5u8CCSsaVtgKbr5Jfca659iZr");
const DAO_PROGRAM_ID = new PublicKey("142FMJgEw2H4EYzqHk1mEsLoT4aDkfLJJ4UR5ELxmTU1");

const VOTING_PERIOD = new BN(7 * 24 * 60 * 60); // 7일
const QUORUM_BPS = 1000;                          // 10%
const APPROVAL_THRESHOLD_BPS = 5000;             // 50%
const VOTING_CAP_BPS = 10000;                    // cap 없음

// ── .env 업데이트 헬퍼 ────────────────────────────────────────────────────────
function updateEnv(key: string, value: string) {
    let content = fs.readFileSync(ENV_PATH, "utf-8");
    const regex = new RegExp(`^(#\\s*)?${key}=.*$`, "m");
    const newLine = `${key}=${value}`;
    if (regex.test(content)) {
        content = content.replace(regex, newLine);
    } else {
        content += `\n${newLine}\n`;
    }
    fs.writeFileSync(ENV_PATH, content, "utf-8");
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log("=== Devnet 초기화 시작 ===\n");

    // 키페어 로드
    if (!fs.existsSync(KEYPAIR_PATH)) {
        console.error(`keypair 없음: ${KEYPAIR_PATH}`);
        console.error("  → ~/.config/solana/id.json 에 admin keypair 저장 필요");
        process.exit(1);
    }
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
    );

    // CRANK 키페어 로드 (Council Mint authority로 사용)
    const dotenv = await import("dotenv");
    dotenv.config({ path: ENV_PATH });
    const crankSecretKeyStr = process.env.CRANK_SECRET_KEY;
    let crankKeypair: Keypair;
    if (crankSecretKeyStr) {
        const bs58 = await import("bs58");
        crankKeypair = Keypair.fromSecretKey(bs58.default.decode(crankSecretKeyStr));
        console.log(`Crank key:  ${crankKeypair.publicKey.toBase58()}`);
    } else {
        console.warn("CRANK_SECRET_KEY 미설정 — authority를 council mint authority로 사용 (권장하지 않음)");
        crankKeypair = authority;
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });

    console.log(`RPC:       ${RPC_URL}`);
    console.log(`Authority: ${authority.publicKey.toBase58()}`);

    // SOL 잔액 확인
    const balance = await connection.getBalance(authority.publicKey);
    console.log(`SOL 잔액:  ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
        console.error("\nSOL 부족! devnet 에어드롭 필요:");
        console.error(`  solana airdrop 2 ${authority.publicKey.toBase58()} --url devnet`);
        console.error("  (에어드롭 한도: 2 SOL/회, 여러 번 시도 가능)");
        process.exit(1);
    }
    console.log();

    // ── Step 1: Fake USDC Mint 생성 (이미 .env에 있으면 스킵) ──────────────────
    console.log("[ 1/3 ] Fake USDC Mint...");
    let usdcMint: PublicKey;
    const existingUsdcMintAddr = process.env.VITE_USDC_MINT;
    if (existingUsdcMintAddr) {
        const existingMintInfo = await connection.getAccountInfo(new PublicKey(existingUsdcMintAddr));
        if (existingMintInfo) {
            usdcMint = new PublicKey(existingUsdcMintAddr);
            console.log(`  이미 존재: ${usdcMint.toBase58()} (스킵)\n`);
        } else {
            usdcMint = await createMint(connection, authority, authority.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID);
            console.log(`  새로 생성: ${usdcMint.toBase58()}`);
            updateEnv("VITE_USDC_MINT", usdcMint.toBase58());
            console.log("  .env VITE_USDC_MINT 업데이트 완료\n");
        }
    } else {
        usdcMint = await createMint(connection, authority, authority.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID);
        console.log(`  Mint: ${usdcMint.toBase58()}`);
        updateEnv("VITE_USDC_MINT", usdcMint.toBase58());
        console.log("  .env VITE_USDC_MINT 업데이트 완료\n");
    }

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
    if (existingRwa) {
        console.log(`  이미 초기화됨: ${rwaConfigPda.toBase58()}`);
    } else {
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
    }

    // crank_authority 설정 (RwaConfig 초기화 후 Pubkey::default() 상태)
    const rwaData = await (rwaProgram.account as any).rwaConfig.fetch(rwaConfigPda);
    if (rwaData.crankAuthority.toBase58() !== crankKeypair.publicKey.toBase58()) {
        const tx = await (rwaProgram.methods as any)
            .setCrankAuthority(crankKeypair.publicKey)
            .accounts({
                rwaConfig: rwaConfigPda,
                authority: authority.publicKey,
            })
            .rpc();
        console.log(`  crank_authority 설정: ${crankKeypair.publicKey.toBase58()}`);
        console.log(`  tx: ${tx}`);
    } else {
        console.log(`  crank_authority 이미 설정됨: ${crankKeypair.publicKey.toBase58()}`);
    }
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
    } else {
        const councilMint = await createMint(
            connection,
            authority,              // 수수료 납부자 = admin (SOL 보유)
            crankKeypair.publicKey, // mintAuthority = CRANK
            null,
            0,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID,
        );
        console.log(`  Council Mint: ${councilMint.toBase58()}`);
        updateEnv("VITE_COUNCIL_MINT", councilMint.toBase58());
        console.log("  .env VITE_COUNCIL_MINT 업데이트 완료");

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

    // ── 완료 요약 ──────────────────────────────────────────────────────────────
    console.log("\n==========================================");
    console.log("  Devnet 초기화 완료");
    console.log("==========================================");
    console.log();
    console.log("다음 단계:");
    console.log("  1. 개발 서버 재시작 (env 변경 반영): npm run dev");
    console.log("  2. 앱에서 devnet 연결 확인 (지갑 네트워크 = Devnet)");
}

main().catch((e) => {
    console.error("\n초기화 실패:", e.message ?? e);
    process.exit(1);
});
