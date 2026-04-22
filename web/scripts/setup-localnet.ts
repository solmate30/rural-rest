/**
 * setup-localnet.ts — Localnet 전체 초기화 스크립트
 *
 * 한 번에 처리:
 *   1. Fake USDC Mint 생성 (SPL Token, decimals=6)
 *   2. RwaConfig 초기화
 *   3. Council Mint 생성 + DaoConfig 초기화
 *   4. .env의 VITE_USDC_MINT / VITE_COUNCIL_MINT 자동 업데이트
 *   5. admin / crank 지갑 SOL 자동 airdrop
 *   6. 테스트 투자자 지갑 SOL + USDC 자동 충전
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/setup-localnet.ts
 *
 * 전제조건:
 *   - solana-test-validator --reset 실행 중
 *   - anchor deploy --provider.cluster localnet 완료
 *   - ~/.config/solana/id.json 에 admin keypair 저장됨
 */

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 상수 ──────────────────────────────────────────────────────────────────────
const RPC_URL = "http://127.0.0.1:8899";
const ENV_PATH = path.join(__dirname, "../.env");
const KEYPAIR_PATH = path.join(process.env.HOME!, ".config/solana/id.json");

const RWA_PROGRAM_ID = new PublicKey("BAJ2fSZGZMkt6dFs4Rn5u8CCSsaVtgKbr5Jfca659iZr");
const DAO_PROGRAM_ID = new PublicKey("142FMJgEw2H4EYzqHk1mEsLoT4aDkfLJJ4UR5ELxmTU1");

const VOTING_PERIOD = new BN(7 * 24 * 60 * 60); // 7일
const QUORUM_BPS = 1000;                          // 10%
const APPROVAL_THRESHOLD_BPS = 5000;             // 50%
const VOTING_CAP_BPS = 10000;                    // cap 없음

// ── .env 업데이트 헬퍼 ────────────────────────────────────────────────────────
// Vite 우선순위: .env.local > .env
// setup 스크립트는 .env.local이 있으면 거기도 함께 업데이트한다.
const ENV_LOCAL_PATH = path.join(__dirname, "../.env.local");

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
    // .env 항상 업데이트
    patchEnvFile(ENV_PATH, key, value);
    // .env.local이 존재하면 함께 업데이트 (Vite 우선순위가 더 높으므로 필수)
    if (fs.existsSync(ENV_LOCAL_PATH)) {
        patchEnvFile(ENV_LOCAL_PATH, key, value);
        console.log(`  → .env.local ${key} 도 업데이트`);
    }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log("=== Localnet 초기화 시작 ===\n");

    // 키페어 로드
    if (!fs.existsSync(KEYPAIR_PATH)) {
        console.error(`keypair 없음: ${KEYPAIR_PATH}`);
        console.error("  → node -e 스크립트로 admin keypair 저장 필요");
        process.exit(1);
    }
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
    );

    // CRANK 키페어 로드 (Council Mint authority로 사용)
    // api.admin.issue-council-token.ts가 CRANK_SECRET_KEY로 mintTo를 서명하기 때문
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

    // ── SOL 자동 airdrop (admin + crank) ─────────────────────────────────────
    async function ensureSol(keypair: Keypair, label: string, minSol = 1) {
        const bal = await connection.getBalance(keypair.publicKey);
        if (bal < minSol * LAMPORTS_PER_SOL) {
            console.log(`  ${label} SOL 부족 (${(bal / LAMPORTS_PER_SOL).toFixed(2)}) → airdrop 10 SOL`);
            const sig = await connection.requestAirdrop(keypair.publicKey, 10 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, "confirmed");
        } else {
            console.log(`  ${label} SOL OK (${(bal / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
        }
    }

    await ensureSol(authority, "admin");
    await ensureSol(crankKeypair, "crank");
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
            // validator 리셋으로 사라진 경우 새로 생성
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

    // crankAuthority 등록/갱신 (initializeConfig는 Pubkey::default()로 초기화하므로 항상 호출)
    const setCrankTx = await (rwaProgram.methods as any)
        .setCrankAuthority(crankKeypair.publicKey)
        .accounts({
            authority: authority.publicKey,
            rwaConfig: rwaConfigPda,
        })
        .rpc();
    console.log(`  crankAuthority: ${crankKeypair.publicKey.toBase58()}`);
    console.log(`  tx:  ${setCrankTx}`);
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
        // .env에 VITE_COUNCIL_MINT 없으면 온체인에서 읽어서 업데이트
        const existingCouncilMint = process.env.VITE_COUNCIL_MINT;
        const envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
        if (!existingCouncilMint || !envContent.includes("VITE_COUNCIL_MINT=")) {
            // TODO: DAO IDL에 daoConfig account 정의 추가 후 as any 제거
            const cfg = await (daoProgram.account as any).daoConfig.fetch(daoConfigPda);
            const mintAddr = (cfg as any).councilMint.toBase58();
            updateEnv("VITE_COUNCIL_MINT", mintAddr);
            console.log(`  VITE_COUNCIL_MINT .env 복구: ${mintAddr}`);
        }
    } else {
        const councilMint = await createMint(
            connection,
            authority,          // 수수료 납부자 = admin (SOL 보유)
            crankKeypair.publicKey, // mintAuthority = CRANK (api에서 mintTo 서명)
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

    // ── Step 4: 테스트 지갑 SOL + USDC 충전 ──────────────────────────────────
    console.log("[ 4/4 ] 테스트 지갑 SOL + USDC 충전...");
    // .env.local의 TEST_WALLETS 또는 기본값 사용
    const testWalletsStr = process.env.TEST_WALLETS;
    const TEST_WALLETS: string[] = testWalletsStr
        ? testWalletsStr.split(",").map((w) => w.trim()).filter(Boolean)
        : [
            "81q7NbGdQqMrtbqyaWvgnoAsNjPp2cUEKCiwfmvgLCyn",
            "8nYw5zkmz95LhDKwZoXRqx1CNB9YXD9tZQfwr4Kd3QTU",
            "8yaELzXq9y5fBPgCXNoGfJ1eyURQmgqnp3MQgCiVqRFD",
        ];
    const USDC_AMOUNT = 10_000;

    for (const walletAddr of TEST_WALLETS) {
        let wallet: PublicKey;
        try { wallet = new PublicKey(walletAddr); } catch { console.warn(`  유효하지 않은 주소 스킵: ${walletAddr}`); continue; }

        // SOL airdrop
        const bal = await connection.getBalance(wallet);
        if (bal < 0.5 * LAMPORTS_PER_SOL) {
            const sig = await connection.requestAirdrop(wallet, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, "confirmed");
            console.log(`  SOL airdrop → ${walletAddr.slice(0, 8)}... (2 SOL)`);
        } else {
            console.log(`  SOL OK      → ${walletAddr.slice(0, 8)}... (${(bal / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
        }

        // USDC ATA 생성 + 민팅
        const ata = await getOrCreateAssociatedTokenAccount(
            connection, authority, usdcMint, wallet,
            false, "confirmed", undefined, TOKEN_PROGRAM_ID,
        );
        await mintTo(
            connection, authority, usdcMint, ata.address, authority,
            USDC_AMOUNT * 1_000_000, [], undefined, TOKEN_PROGRAM_ID,
        );
        console.log(`  USDC minted → ${walletAddr.slice(0, 8)}... (${USDC_AMOUNT} USDC)`);
    }
    console.log();

    // ── 완료 요약 ──────────────────────────────────────────────────────────────
    console.log("\n==========================================");
    console.log("  Localnet 초기화 완료");
    console.log("==========================================");
    console.log();
    console.log("다음 단계:");
    console.log("  1. 개발 서버 재시작 (env 변경 반영): npm run dev");
    console.log("  2. 테스트 매물 추가 (선택): npx tsx scripts/seed-test-listing.ts");
}

main().catch((e) => {
    console.error("\n초기화 실패:", e.message ?? e);
    process.exit(1);
});
