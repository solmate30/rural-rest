/**
 * init-dao.ts — DAO 초기화 스크립트 (localnet/devnet)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/init-dao.ts
 *
 * Council Mint가 없으면 자동 생성 (Token-2022, decimals 0)
 * VITE_COUNCIL_MINT 환경변수로 기존 mint 지정 가능
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, createMint } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bs58 from "bs58";
import { RPC_URL, DAO_PROGRAM_ID, RWA_PROGRAM_ID, COUNCIL_MINT_ADDR } from "./_env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VOTING_PERIOD = new BN(7 * 24 * 60 * 60); // 7일 (초)
const QUORUM_BPS = 1000;                          // 10%
const APPROVAL_THRESHOLD_BPS = 5000;             // 50%
const VOTING_CAP_BPS = 10000;                    // cap 없음

// ── 키페어 로드 ────────────────────────────────────────────────────────────────
const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);

// CRANK 키페어 (Council Mint authority)
// api.admin.issue-council-token.ts가 CRANK로 mintTo 서명 → mint authority도 CRANK여야 함
const crankSecretKeyStr = process.env.CRANK_SECRET_KEY;
const crankKeypair: Keypair = crankSecretKeyStr
    ? Keypair.fromSecretKey(bs58.decode(crankSecretKeyStr))
    : authority;

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

    console.log("=== DAO 초기화 ===");
    console.log(`  RPC: ${RPC_URL}`);
    console.log(`  Authority: ${authority.publicKey.toBase58()}`);

    // DaoConfig PDA
    const [daoConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")],
        DAO_PROGRAM_ID,
    );

    // 이미 초기화됐는지 확인
    const existing = await connection.getAccountInfo(daoConfigPda);
    if (existing) {
        console.log("\nDaoConfig already initialized:", daoConfigPda.toBase58());
        return;
    }

    // Council Mint: 환경변수 or 자동 생성
    let councilMint: PublicKey;
    if (COUNCIL_MINT_ADDR) {
        councilMint = new PublicKey(COUNCIL_MINT_ADDR);
        console.log(`  Council Mint (기존): ${councilMint.toBase58()}`);
    } else {
        console.log("  Council Mint 자동 생성 (Token-2022, decimals 0)...");
        councilMint = await createMint(
            connection,
            authority,               // 수수료 납부자 = admin
            crankKeypair.publicKey,  // mintAuthority = CRANK
            null,
            0,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID,
        );
        console.log(`  Council Mint: ${councilMint.toBase58()}`);
        console.log(`  >> .env에 추가: VITE_COUNCIL_MINT=${councilMint.toBase58()}`);
    }

    console.log(`  DaoConfig PDA: ${daoConfigPda.toBase58()}`);

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
            councilMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

    console.log("\nDAO initialized!");
    console.log(`  tx: ${tx}`);
    console.log(`  DaoConfig: ${daoConfigPda.toBase58()}`);
    console.log(`  Council Mint: ${councilMint.toBase58()}`);
}

main().catch((e) => {
    console.error("DAO 초기화 실패:", e);
    process.exit(1);
});
