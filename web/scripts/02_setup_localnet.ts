/**
 * 02_setup_localnet.ts  —  [STEP 2]
 *
 * 로컬넷 테스트에 필요한 기반 환경을 구성합니다.
 *   - 테스트 USDC 민트 생성 (실제 USDC 불필요)
 *   - SPV 지갑 또는 브라우저 지갑에 SOL + USDC 충전
 *
 * 옵션:
 *   --setup              USDC 민트 생성 (최초 1회, STEP 1 이후 실행)
 *   --fund-spv           spv-wallet.json에 SOL 2개 + USDC 10,000개 충전
 *   --fund-wallet <pub>  특정 지갑에 SOL 2개 + USDC 1,000개 충전 (UI 테스트용)
 *   --rpc <url>          RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 *
 * 실행 예시:
 *   npx tsx scripts/02_setup_localnet.ts --setup
 *   npx tsx scripts/02_setup_localnet.ts --fund-spv
 *   npx tsx scripts/02_setup_localnet.ts --fund-wallet <pubkey>
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_RPC = "http://127.0.0.1:8899";
const USDC_MINT_KEYPAIR_PATH = path.join(__dirname, "test-usdc-mint.json");
const SPV_KEYPAIR_PATH = path.join(__dirname, "spv-wallet.json");

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        setup: args.includes("--setup"),
        fundSpv: args.includes("--fund-spv"),
        rpc: get("--rpc") ?? DEFAULT_RPC,
        fundWallet: get("--fund-wallet") ?? null,
    };
}

function loadOrCreateKeypair(filePath: string, label: string): Keypair {
    if (fs.existsSync(filePath)) {
        const kp = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
        );
        console.log(`  [재사용] ${label}: ${kp.publicKey.toBase58()}`);
        return kp;
    }
    const kp = Keypair.generate();
    fs.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
    console.log(`  [신규생성] ${label}: ${kp.publicKey.toBase58()} → ${filePath}`);
    return kp;
}

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}

// ── STEP 1: 테스트 USDC 민트 생성 ────────────────────────────────────────────

async function setupUsdcMint(rpc: string) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  [STEP 1] 테스트 USDC 민트 생성");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const connection = new Connection(rpc, "confirmed");
    const payer = loadOrCreateKeypair(
        path.join(__dirname, "test-payer.json"),
        "payer"
    );
    const usdcMintKeypair = loadOrCreateKeypair(USDC_MINT_KEYPAIR_PATH, "usdc-mint");

    console.log("\n[ 1 ] Payer SOL 에어드롭");
    await airdrop(connection, payer.publicKey, 5);
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`  payer: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL`);

    const existing = await connection.getAccountInfo(usdcMintKeypair.publicKey);
    if (existing) {
        console.log("\n  [건너뜀] USDC 민트가 이미 존재합니다.");
    } else {
        console.log("\n[ 2 ] USDC 민트 생성 (decimals=6)");
        await createMint(
            connection,
            payer,
            payer.publicKey,   // mintAuthority = payer
            payer.publicKey,   // freezeAuthority
            6,                 // decimals (USDC 표준)
            usdcMintKeypair,
            undefined,
            TOKEN_PROGRAM_ID
        );
        console.log(`  민트 생성 완료: ${usdcMintKeypair.publicKey.toBase58()}`);
    }

    const mintAddress = usdcMintKeypair.publicKey.toBase58();
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 아래 내용을 web/.env에 추가하세요:\n");
    console.log(`  VITE_USDC_MINT=${mintAddress}`);
    console.log("\n  그 다음:");
    console.log("  1. npm run dev 재시작 (env 반영)");
    console.log("  2. npx tsx scripts/02_setup_localnet.ts --fund-spv");
    console.log("  3. npx tsx scripts/03_tokenize_property.ts --listing-id <id>");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── SPV 지갑에 SOL + USDC 충전 ────────────────────────────────────────────────
// SPV가 distribute_revenue 호출 시 USDC 잔액 필요

async function fundSpvWallet(rpc: string) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  [Fund SPV] SPV 지갑에 SOL + USDC 충전");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fs.existsSync(SPV_KEYPAIR_PATH)) {
        console.error("  오류: spv-wallet.json이 없습니다. STEP 1을 먼저 실행하세요.");
        console.error("  npx tsx scripts/01_generate_keypairs.ts");
        process.exit(1);
    }
    if (!fs.existsSync(USDC_MINT_KEYPAIR_PATH)) {
        console.error("  오류: test-usdc-mint.json이 없습니다. --setup을 먼저 실행하세요.");
        process.exit(1);
    }

    const connection = new Connection(rpc, "confirmed");
    const payer = loadOrCreateKeypair(path.join(__dirname, "test-payer.json"), "payer");
    const spv = loadOrCreateKeypair(SPV_KEYPAIR_PATH, "spv-wallet");
    const usdcMintKeypair = loadOrCreateKeypair(USDC_MINT_KEYPAIR_PATH, "usdc-mint");
    const usdcMint = usdcMintKeypair.publicKey;

    // payer SOL 보충 (민팅 수수료용)
    const payerSol = await connection.getBalance(payer.publicKey);
    if (payerSol < 2 * LAMPORTS_PER_SOL) {
        await airdrop(connection, payer.publicKey, 5);
    }

    console.log("\n[ 1 ] SPV SOL 에어드롭 (2 SOL)");
    await airdrop(connection, spv.publicKey, 2);
    const solBalance = await connection.getBalance(spv.publicKey);
    console.log(`  잔액: ${(solBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL`);

    console.log("\n[ 2 ] SPV USDC ATA 생성 + 10,000 USDC 민팅");
    const ata = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, spv.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );
    await mintTo(
        connection, payer, usdcMint, ata.address,
        payer, 10_000_000_000n,  // 10,000 USDC
        [], undefined, TOKEN_PROGRAM_ID
    );
    const usdcBalance = await connection.getTokenAccountBalance(ata.address);
    console.log(`  USDC ATA: ${ata.address.toBase58()}`);
    console.log(`  USDC 잔액: ${usdcBalance.value.uiAmount} USDC`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! SPV 지갑 준비 됐습니다.");
    console.log("  다음: npx tsx scripts/03_tokenize_property.ts --listing-id <id>");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── 유틸: 특정 지갑에 SOL + USDC 충전 ─────────────────────────────────────────
// UI 테스트 시 특정 브라우저 지갑에 잔액을 넣어줄 때 사용

async function fundWallet(walletAddress: string, rpc: string) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Fund Wallet] ${walletAddress}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fs.existsSync(USDC_MINT_KEYPAIR_PATH)) {
        console.error("  오류: test-usdc-mint.json이 없습니다. --setup 먼저 실행하세요.");
        process.exit(1);
    }

    const connection = new Connection(rpc, "confirmed");
    const payer = loadOrCreateKeypair(path.join(__dirname, "test-payer.json"), "payer");
    const usdcMintKeypair = loadOrCreateKeypair(USDC_MINT_KEYPAIR_PATH, "usdc-mint");
    const usdcMint = usdcMintKeypair.publicKey;
    const target = new PublicKey(walletAddress);

    console.log("\n[ 1 ] SOL 에어드롭 (2 SOL)");
    await airdrop(connection, target, 2);
    const solBalance = await connection.getBalance(target);
    console.log(`  잔액: ${(solBalance / LAMPORTS_PER_SOL).toFixed(2)} SOL`);

    console.log("\n[ 2 ] USDC ATA 생성 + 1000 USDC 민팅");
    const ata = await getOrCreateAssociatedTokenAccount(
        connection, payer, usdcMint, target,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );
    await mintTo(
        connection, payer, usdcMint, ata.address,
        payer,           // mintAuthority = payer (--setup 때 지정됨)
        1_000_000_000n,  // 1000 USDC (decimals=6이므로 1e6 = 1 USDC)
        [], undefined, TOKEN_PROGRAM_ID
    );
    const usdcBalance = await connection.getTokenAccountBalance(ata.address);
    console.log(`  USDC ATA: ${ata.address.toBase58()}`);
    console.log(`  USDC 잔액: ${usdcBalance.value.uiAmount} USDC`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 이제 UI에서 해당 지갑으로 구매하세요.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── 진입점 ────────────────────────────────────────────────────────────────────

async function main() {
    const { setup, fundSpv, rpc, fundWallet: walletToFund } = parseArgs();

    if (setup) {
        await setupUsdcMint(rpc);
    } else if (fundSpv) {
        await fundSpvWallet(rpc);
    } else if (walletToFund) {
        await fundWallet(walletToFund, rpc);
    } else {
        console.log("Usage:");
        console.log("  npx tsx scripts/02_setup_localnet.ts --setup");
        console.log("  npx tsx scripts/02_setup_localnet.ts --fund-spv");
        console.log("  npx tsx scripts/02_setup_localnet.ts --fund-wallet <pubkey>");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
