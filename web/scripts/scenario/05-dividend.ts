/**
 * 05-dividend.ts — 배당 분배 + 수령
 *
 * distributeMonthlyRevenue(70 USDC) → investor1/2/3 claimDividend
 * 각 수령액: investor1(30토큰)=30USDC, investor2(30토큰)=30USDC, investor3(10토큰)=10USDC
 *
 * 실행: cd web && npx tsx scripts/scenario/05-dividend.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadState, kp, pk } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL    = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const USDC_MINT  = new PublicKey(process.env.VITE_USDC_MINT!);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const LISTING_ACTIVE = "e2e001";
const DIVIDEND_USDC  = 70 * 1_000_000; // 70 USDC

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

async function main() {
    console.log("=== [05] 배당 분배 + 수령 ===\n");

    const state    = loadState();
    const adminKp  = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );
    const investor1 = kp(state.investor1);
    const investor2 = kp(state.investor2);
    const investor3 = kp(state.investor3);

    const connection    = new Connection(RPC_URL, "confirmed");
    const adminProvider = new AnchorProvider(connection, new Wallet(adminKp), { commitment: "confirmed" });
    const adminProgram  = new Program(IDL as any, adminProvider);

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
    const pt1       = pda([Buffer.from("property"),     Buffer.from(LISTING_ACTIVE)]);
    const usdcVault = getAssociatedTokenAddressSync(USDC_MINT, pt1, true, TOKEN_PROGRAM_ID);
    const adminUsdc = getAssociatedTokenAddressSync(USDC_MINT, adminKp.publicKey, false, TOKEN_PROGRAM_ID);

    // distributeMonthlyRevenue
    await (adminProgram.methods as any)
        .distributeMonthlyRevenue(LISTING_ACTIVE, new BN(DIVIDEND_USDC))
        .accounts({
            propertyToken: pt1,
            authority: adminKp.publicKey,
            authorityUsdcAccount: adminUsdc,
            usdcVault,
            usdcMint: USDC_MINT,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    const ptData = await (adminProgram.account as any).propertyToken.fetch(pt1);
    console.log(`  분배액: ${DIVIDEND_USDC / 1_000_000} USDC`);
    console.log(`  accDividendPerShare: ${ptData.accDividendPerShare.toString()}\n`);

    // claimDividend 헬퍼
    const claim = async (investor: Keypair, usdcAta: PublicKey, label: string, expectedUsdc: number) => {
        const provider  = new AnchorProvider(connection, new Wallet(investor), { commitment: "confirmed" });
        const program   = new Program(IDL as any, provider);
        const posPda    = pda([Buffer.from("investor"), pt1.toBuffer(), investor.publicKey.toBuffer()]);
        const before    = BigInt((await connection.getTokenAccountBalance(usdcAta)).value.amount);

        await (program.methods as any)
            .claimDividend(LISTING_ACTIVE)
            .accounts({
                investor: investor.publicKey,
                propertyToken: pt1,
                investorPosition: posPda,
                usdcVault,
                investorUsdcAccount: usdcAta,
                usdcMint: USDC_MINT,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        const after    = BigInt((await connection.getTokenAccountBalance(usdcAta)).value.amount);
        const received = Number(after - before);
        const ok       = received === expectedUsdc * 1_000_000;
        console.log(`  ${label}: ${received / 1_000_000} USDC 수령  ${ok ? "OK" : `FAIL (expected: ${expectedUsdc})`}`);
        if (!ok) throw new Error(`${label} 수령액 불일치`);
    };

    await claim(investor1, pk(state.inv1Usdc), "investor1(30토큰)", 30);
    await claim(investor2, pk(state.inv2Usdc), "investor2(30토큰)", 30);
    await claim(investor3, pk(state.inv3Usdc), "investor3(10토큰)", 10);

    console.log("\n  배당 검증 완료");
    console.log("\n다음: npx tsx scripts/scenario/06-booking.ts");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
