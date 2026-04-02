/**
 * set-crank-authority.ts — RwaConfig crank_authority 교체 스크립트 (1회 실행)
 *
 * 실행:
 *   cd web
 *   NEW_CRANK_PUBKEY=<새_크랭크_pubkey> npx tsx scripts/set-crank-authority.ts
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");

const NEW_CRANK = new PublicKey(process.env.NEW_CRANK_PUBKEY ?? "");

const keypairPath = path.join(process.env.HOME!, ".config/solana/id.json");
const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
);

const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
);

async function main() {
    if (!process.env.NEW_CRANK_PUBKEY) {
        console.error("NEW_CRANK_PUBKEY 환경변수를 설정하세요.");
        process.exit(1);
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const program = new Program(IDL, provider);

    const [rwaConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        PROGRAM_ID
    );

    const before = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
    console.log("[Before] crank_authority:", before.crankAuthority.toBase58());

    const tx = await (program.methods as any)
        .setCrankAuthority(NEW_CRANK)
        .accounts({ rwaConfig: rwaConfigPda, authority: authority.publicKey })
        .rpc();

    console.log("tx:", tx);

    const after = await (program.account as any).rwaConfig.fetch(rwaConfigPda);
    console.log("[After]  crank_authority:", after.crankAuthority.toBase58());
}

main().catch((e) => { console.error(e); process.exit(1); });
