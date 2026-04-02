/**
 * init-dao.ts — DAO 초기화 스크립트 (devnet, 1회 실행)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/init-dao.ts
 */

import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 설정 ──────────────────────────────────────────────────────────────────────
const RPC_URL = "https://api.devnet.solana.com";
const DAO_PROGRAM_ID = new PublicKey("3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX");
const RWA_PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
const COUNCIL_MINT = new PublicKey("FEDWxrjgozxhXFN8N8fy4XhrAJEbdQQb9xRJpNwYbtKq");

const VOTING_PERIOD = new BN(7 * 24 * 60 * 60); // 7일 (초)
const QUORUM_BPS = 1000;                          // 10%
const APPROVAL_THRESHOLD_BPS = 5000;             // 50%
const VOTING_CAP_BPS = 10000;                    // cap 없음

// ── 키페어 로드 ────────────────────────────────────────────────────────────────
const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);

// ── IDL ───────────────────────────────────────────────────────────────────────
const DAO_IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_dao.json"), "utf-8")
);

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), {
        commitment: "confirmed",
    });
    const program = new Program(DAO_IDL, provider);

    // DaoConfig PDA
    const [daoConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")],
        DAO_PROGRAM_ID,
    );

    // 이미 초기화됐는지 확인
    const existing = await connection.getAccountInfo(daoConfigPda);
    if (existing) {
        console.log("DaoConfig already initialized:", daoConfigPda.toBase58());
        return;
    }

    console.log("Initializing DAO...");
    console.log("  authority  :", authority.publicKey.toBase58());
    console.log("  dao_config :", daoConfigPda.toBase58());
    console.log("  council_mint:", COUNCIL_MINT.toBase58());

    const tx = await program.methods
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
            councilMint: COUNCIL_MINT,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

    console.log("\nDAO initialized!");
    console.log("  tx:", tx);
    console.log("  dao_config PDA:", daoConfigPda.toBase58());
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
