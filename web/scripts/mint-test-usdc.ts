/**
 * 테스트 계정에 Fake USDC 민팅
 * 실행: cd web && npx tsx scripts/mint-test-usdc.ts
 *
 * 전제조건:
 *   - solana-test-validator 실행 중
 *   - setup-localnet.ts 완료 (VITE_USDC_MINT 설정됨)
 *   - ~/.config/solana/id.json = USDC mint authority
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "../.env");
config({ path: ENV_PATH });

const RPC_URL = "http://127.0.0.1:8899";
const AMOUNT_USDC = 10_000;   // 지갑당 민팅할 USDC 수량

const WALLETS = [
    "81q7NbGdQqMrtbqyaWvgnoAsNjPp2cUEKCiwfmvgLCyn",
    "8nYw5zkmz95LhDKwZoXRqx1CNB9YXD9tZQfwr4Kd3QTU",
];

async function main() {
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    if (!usdcMintAddr) {
        console.error("VITE_USDC_MINT not set. Run setup-localnet.ts first.");
        process.exit(1);
    }

    const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
    );

    const connection = new Connection(RPC_URL, "confirmed");
    const usdcMint = new PublicKey(usdcMintAddr);

    console.log(`USDC Mint:  ${usdcMint.toBase58()}`);
    console.log(`Authority:  ${authority.publicKey.toBase58()}`);
    console.log(`Amount:     ${AMOUNT_USDC} USDC each\n`);

    for (const walletAddr of WALLETS) {
        const wallet = new PublicKey(walletAddr);

        // SOL 에어드롭 (localnet)
        const balance = await connection.getBalance(wallet);
        if (balance < 0.1 * LAMPORTS_PER_SOL) {
            const sig = await connection.requestAirdrop(wallet, 2 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig, "confirmed");
            console.log(`  SOL airdrop → ${walletAddr.slice(0, 8)}... (2 SOL)`);
        } else {
            console.log(`  SOL OK      → ${walletAddr.slice(0, 8)}... (${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
        }

        // USDC ATA 생성 + 민팅
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            authority,
            usdcMint,
            wallet,
            false,
            "confirmed",
            undefined,
            TOKEN_PROGRAM_ID,
        );

        await mintTo(
            connection,
            authority,
            usdcMint,
            ata.address,
            authority,
            AMOUNT_USDC * 1_000_000,   // decimals 6
            [],
            undefined,
            TOKEN_PROGRAM_ID,
        );

        console.log(`  USDC minted → ${walletAddr.slice(0, 8)}... (${AMOUNT_USDC} USDC)`);
    }

    console.log("\n완료! 두 계정 모두 SOL + USDC 준비됨.");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
