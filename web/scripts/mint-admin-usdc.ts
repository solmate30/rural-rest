/**
 * mint-admin-usdc.ts — CRANK_SECRET_KEY 계정에 SOL + USDC 충전
 *
 * 실행: cd web && npx tsx scripts/mint-admin-usdc.ts
 *
 * 전제조건:
 *   - solana-test-validator 실행 중
 *   - setup-localnet.ts 완료 (VITE_USDC_MINT 설정됨)
 *   - ~/.config/solana/id.json = USDC mint authority
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bs58 from "bs58";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "../.env");
config({ path: ENV_PATH });

const RPC_URL = "http://127.0.0.1:8899";
const AMOUNT_USDC = 50_000;

async function main() {
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    const crankSecret = process.env.CRANK_SECRET_KEY;

    if (!usdcMintAddr) { console.error("VITE_USDC_MINT not set"); process.exit(1); }
    if (!crankSecret) { console.error("CRANK_SECRET_KEY not set"); process.exit(1); }

    // mint authority (admin CLI keypair)
    const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
    );

    // crank / council-issuing keypair
    const crankKeypair = Keypair.fromSecretKey(bs58.decode(crankSecret));

    const connection = new Connection(RPC_URL, "confirmed");
    const usdcMint = new PublicKey(usdcMintAddr);

    console.log(`USDC Mint:  ${usdcMint.toBase58()}`);
    console.log(`Authority:  ${authority.publicKey.toBase58()}`);
    console.log(`Crank/Admin: ${crankKeypair.publicKey.toBase58()}\n`);

    // SOL 에어드롭
    const balance = await connection.getBalance(crankKeypair.publicKey);
    if (balance < 1 * LAMPORTS_PER_SOL) {
        const sig = await connection.requestAirdrop(crankKeypair.publicKey, 5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log(`SOL: 5 SOL airdrop 완료`);
    } else {
        console.log(`SOL: ${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL (충분)`);
    }

    // USDC 민팅
    const ata = await getOrCreateAssociatedTokenAccount(
        connection, authority, usdcMint, crankKeypair.publicKey,
        false, "confirmed", undefined, TOKEN_PROGRAM_ID
    );
    await mintTo(
        connection, authority, usdcMint, ata.address,
        authority, AMOUNT_USDC * 1_000_000,
        [], undefined, TOKEN_PROGRAM_ID
    );
    console.log(`USDC: ${AMOUNT_USDC.toLocaleString()} USDC 민팅 완료`);
    console.log(`ATA:  ${ata.address.toBase58()}`);
    console.log(`\n완료!`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
