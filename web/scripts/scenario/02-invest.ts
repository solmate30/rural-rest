/**
 * 02-invest.ts — 투자자 매입
 *
 * e2e001: investor1(30), investor2(30), investor3(10) → 70%
 * e2e002: investor3(5) → 5% (실패 시나리오)
 *
 * 실행: cd web && npx tsx scripts/scenario/02-invest.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount, mintTo,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadState, kp, pk } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const USDC_MINT = new PublicKey(process.env.VITE_USDC_MINT!);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const LISTING_ACTIVE = "e2e001";
const LISTING_FAIL = "e2e002";

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

async function main() {
    console.log("=== [02] 투자자 매입 ===\n");

    const state = loadState();
    const adminKp = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );
    const investor1 = kp(state.investor1);
    const investor2 = kp(state.investor2);
    const investor3 = kp(state.investor3);
    const mintKp1 = kp(state.mintKp1);
    const mintKp2 = kp(state.mintKp2);

    const connection = new Connection(RPC_URL, "confirmed");
    const IDL_parsed = IDL;

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

    const pt1 = pda([Buffer.from("property"), Buffer.from(LISTING_ACTIVE)]);
    const fv1 = pda([Buffer.from("funding_vault"), Buffer.from(LISTING_ACTIVE)]);
    const pt2 = pda([Buffer.from("property"), Buffer.from(LISTING_FAIL)]);
    const fv2 = pda([Buffer.from("funding_vault"), Buffer.from(LISTING_FAIL)]);

    const buy = async (
        investor: Keypair,
        usdcAta: PublicKey,
        listingId: string,
        pt: PublicKey,
        mintKp: Keypair,
        amount: number,
        fv: PublicKey,
    ): Promise<PublicKey> => {
        const provider = new AnchorProvider(connection, new Wallet(investor), { commitment: "confirmed" });
        const program = new Program(IDL_parsed as any, provider);
        const posPda = pda([Buffer.from("investor"), pt.toBuffer(), investor.publicKey.toBuffer()]);
        const rwaAta = getAssociatedTokenAddressSync(mintKp.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);

        const posInfo = await connection.getAccountInfo(posPda);
        const preIxs: any[] = [];
        if (!posInfo) {
            preIxs.push(
                await (program.methods as any).openPosition(listingId)
                    .accounts({ investor: investor.publicKey, propertyToken: pt, investorPosition: posPda, systemProgram: SystemProgram.programId })
                    .instruction()
            );
        }

        await (program.methods as any)
            .purchaseTokens(listingId, new BN(amount))
            .accounts({
                investor: investor.publicKey,
                propertyToken: pt,
                tokenMint: mintKp.publicKey,
                investorPosition: posPda,
                investorUsdcAccount: usdcAta,
                fundingVault: fv,
                investorRwaAccount: rwaAta,
                usdcMint: USDC_MINT,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions(preIxs)
            .rpc();

        console.log(`  ${investor.publicKey.toBase58().slice(0, 10)}... → ${listingId} ${amount}토큰 매입`);
        return posPda;
    };

    // e2e001: 70% 채우기
    await buy(investor1, pk(state.inv1Usdc), LISTING_ACTIVE, pt1, mintKp1, 30, fv1);
    await buy(investor2, pk(state.inv2Usdc), LISTING_ACTIVE, pt1, mintKp1, 30, fv1);
    await buy(investor3, pk(state.inv3Usdc), LISTING_ACTIVE, pt1, mintKp1, 10, fv1);

    // e2e002: 5% (실패용)
    // investor3에게 추가 USDC 충전
    const inv3Usdc2 = await getOrCreateAssociatedTokenAccount(
        connection, adminKp, USDC_MINT, investor3.publicKey, false, "confirmed", undefined, TOKEN_PROGRAM_ID
    );
    await mintTo(connection, adminKp, USDC_MINT, inv3Usdc2.address, adminKp, 5 * 1_000_000, [], undefined, TOKEN_PROGRAM_ID);
    await buy(investor3, inv3Usdc2.address, LISTING_FAIL, pt2, mintKp2, 5, fv2);

    const pt1Data = await connection.getAccountInfo(pt1);
    console.log(`\n  e2e001 tokensSold: 70/100 (70%)`);
    console.log(`  e2e002 tokensSold: 5/100 (5%) — 실패 예정`);
    console.log("\n다음: npx tsx scripts/scenario/03-refund.ts  (e2e002 8초 deadline 경과 후 자동 실행)");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
