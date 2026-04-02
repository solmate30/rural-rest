/**
 * init-rwa.ts — RwaConfig 초기화 스크립트 (devnet, 1회 실행)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/init-rwa.ts
 */

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");

const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);

const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
);

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const program = new Program(IDL, provider);

    const [rwaConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        PROGRAM_ID
    );

    const existing = await connection.getAccountInfo(rwaConfigPda);
    if (existing) {
        console.log("RwaConfig already initialized:", rwaConfigPda.toBase58());
        const data = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
        console.log("  authority      :", data.authority.toBase58());
        console.log("  crank_authority:", data.crankAuthority.toBase58());
        console.log("  treasury       :", data.treasury.toBase58());
        return;
    }

    console.log("Initializing RwaConfig...");
    console.log("  authority:", authority.publicKey.toBase58());
    console.log("  PDA      :", rwaConfigPda.toBase58());

    const tx = await (program.methods as any)
        .initializeConfig()
        .accounts({
            authority: authority.publicKey,
            rwaConfig: rwaConfigPda,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    console.log("\nRwaConfig initialized!");
    console.log("  tx :", tx);
    console.log("  PDA:", rwaConfigPda.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });
