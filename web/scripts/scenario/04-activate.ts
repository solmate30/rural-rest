/**
 * 04-activate.ts — e2e001 활성화 (releaseFunds + activateProperty)
 *
 * deadline(60초) 경과 확인 후 crank_authority로 자동 실행
 *
 * 실행: cd web && npx tsx scripts/scenario/04-activate.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bs58 from "bs58";
import { loadState, kp } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL    = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const USDC_MINT  = new PublicKey(process.env.VITE_USDC_MINT!);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const LISTING_ACTIVE = "e2e001";

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("=== [04] e2e001 활성화 (releaseFunds + activateProperty) ===\n");

    if (!process.env.CRANK_SECRET_KEY) { console.error("CRANK_SECRET_KEY 미설정"); process.exit(1); }

    const state  = loadState();
    const mintKp1 = kp(state.mintKp1);
    const crank   = Keypair.fromSecretKey(bs58.decode(process.env.CRANK_SECRET_KEY!));
    const adminKp = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );

    const connection    = new Connection(RPC_URL, "confirmed");
    const crankProvider = new AnchorProvider(
        connection,
        {
            publicKey: crank.publicKey,
            signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
            signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(crank)); return txs; },
        } as any,
        { commitment: "confirmed" }
    );
    const program = new Program(IDL as any, crankProvider);

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
    const pt1      = pda([Buffer.from("property"),     Buffer.from(LISTING_ACTIVE)]);
    const fv1      = pda([Buffer.from("funding_vault"), Buffer.from(LISTING_ACTIVE)]);
    const rwaConfig = pda([Buffer.from("rwa_config")]);
    const adminUsdc = getAssociatedTokenAddressSync(USDC_MINT, adminKp.publicKey, false, TOKEN_PROGRAM_ID);

    // deadline 대기 — validator 실제 clock으로 폴링
    const ptData  = await (program.account as any).propertyToken.fetch(pt1);
    const deadline = Number(ptData.fundingDeadline ?? ptData.funding_deadline);

    const getValidatorTime = async () => {
        const slot = await connection.getSlot("confirmed");
        return await connection.getBlockTime(slot);
    };

    let validatorNow = await getValidatorTime();
    console.log(`  status:         ${JSON.stringify(ptData.status)}`);
    console.log(`  deadline:       ${new Date(deadline * 1000).toISOString()}`);
    console.log(`  validator 현재: ${new Date((validatorNow ?? 0) * 1000).toISOString()}`);

    while ((validatorNow ?? 0) < deadline) {
        const remaining = deadline - (validatorNow ?? 0);
        console.log(`  대기 중... (${remaining}초 남음)`);
        await sleep(3000);
        validatorNow = await getValidatorTime();
    }
    console.log("  deadline 경과 확인");

    // releaseFunds
    await (program.methods as any)
        .releaseFunds(LISTING_ACTIVE)
        .accounts({
            operator: crank.publicKey,
            propertyToken: pt1,
            rwaConfig,
            fundingVault: fv1,
            authorityUsdcAccount: adminUsdc,
            usdcMint: USDC_MINT,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();
    console.log("  releaseFunds 완료");

    // activateProperty
    await (program.methods as any)
        .activateProperty(LISTING_ACTIVE)
        .accounts({
            operator: crank.publicKey,
            propertyToken: pt1,
            rwaConfig,
            tokenMint: mintKp1.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
    console.log("  activateProperty 완료");

    const ptAfter = await (program.account as any).propertyToken.fetch(pt1);
    console.log(`\n  status:        ${JSON.stringify(ptAfter.status)}  (expected: {active:{}})`);
    console.log(`  fundsReleased: ${ptAfter.fundsReleased}`);

    if (!ptAfter.status.active) throw new Error("status가 active여야 합니다");

    console.log("\n다음: npx tsx scripts/scenario/05-dividend.ts");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
