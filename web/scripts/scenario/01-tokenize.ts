/**
 * 01-tokenize.ts — RWA 토큰 발행
 *
 * 생성:
 *   - e2e001: 60초 deadline (Active 시나리오)
 *   - e2e002: 5초 deadline (실패/환불 시나리오)
 *   - e2e003: 30일 deadline (예약 에스크로 시나리오, host=admin)
 *
 * 실행: cd web && npx tsx scripts/scenario/01-tokenize.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount, mintTo,
    TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bs58 from "bs58";
import { saveState } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL    = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const USDC_MINT  = new PublicKey(process.env.VITE_USDC_MINT!);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const LISTING_ACTIVE = "e2e001";
const LISTING_FAIL   = "e2e002";
const LISTING_BOOK   = "e2e003";
const TOTAL_SUPPLY   = 100;
const PRICE_PER_TOKEN_USDC = 1_000_000; // 1 USDC
const VALUATION_KRW  = 100_000_000;
const MIN_FUNDING_BPS = 6000; // 60%

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

async function main() {
    console.log("=== [01] RWA 토큰 발행 ===\n");

    const adminKp = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );
    const connection = new Connection(RPC_URL, "confirmed");
    const provider   = new AnchorProvider(connection, new Wallet(adminKp), { commitment: "confirmed" });
    const program    = new Program(IDL as any, provider);

    // 투자자 keypair 생성
    const investor1 = Keypair.generate();
    const investor2 = Keypair.generate();
    const investor3 = Keypair.generate();
    const guest     = Keypair.generate();
    const treasury  = Keypair.generate();

    // SOL 충전
    const fund = async (kp: Keypair, label: string, sol = 2) => {
        const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log(`  ${label}: SOL ${sol} 충전 완료`);
    };
    await fund(adminKp, "admin (확인)", 0); // admin은 이미 충전됨
    for (const [kp, label] of [[investor1,"investor1"],[investor2,"investor2"],[investor3,"investor3"],[guest,"guest"],[treasury,"treasury"]] as [Keypair,string][]) {
        await fund(kp, label);
    }

    // USDC ATA 생성 + 충전
    const mintUsdc = async (kp: Keypair, amount: number) => {
        const ata = await getOrCreateAssociatedTokenAccount(
            connection, adminKp, USDC_MINT, kp.publicKey, false, "confirmed", undefined, TOKEN_PROGRAM_ID
        );
        await mintTo(connection, adminKp, USDC_MINT, ata.address, adminKp, amount, [], undefined, TOKEN_PROGRAM_ID);
        return ata.address;
    };

    const inv1Usdc  = await mintUsdc(investor1, 40 * 1_000_000);
    const inv2Usdc  = await mintUsdc(investor2, 40 * 1_000_000);
    const inv3Usdc  = await mintUsdc(investor3, 15 * 1_000_000);
    const guestUsdc = await mintUsdc(guest, 500 * 1_000_000);
    // admin USDC (배당 분배 + 호스트 정산 수령용)
    await mintUsdc(adminKp, 1000 * 1_000_000);
    console.log("  USDC 충전 완료\n");

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

    const initProperty = async (
        listingId: string, mintKp: Keypair, deadlineSec: number, supply = TOTAL_SUPPLY
    ) => {
        const pt      = pda([Buffer.from("property"),     Buffer.from(listingId)]);
        const fv      = pda([Buffer.from("funding_vault"), Buffer.from(listingId)]);
        const usdcVlt = getAssociatedTokenAddressSync(USDC_MINT, pt, true, TOKEN_PROGRAM_ID);

        const existing = await connection.getAccountInfo(pt);
        if (existing) {
            console.error(`\n  오류: ${listingId} PDA가 이미 존재합니다.`);
            console.error("  solana-test-validator --reset 후 setup-localnet.ts부터 다시 실행하세요.");
            process.exit(1);
        }

        await (program.methods as any)
            .initializeProperty(
                listingId,
                new BN(supply),
                new BN(VALUATION_KRW),
                new BN(PRICE_PER_TOKEN_USDC),
                new BN(deadlineSec),
                MIN_FUNDING_BPS,
            )
            .accounts({
                authority: adminKp.publicKey,
                propertyToken: pt,
                tokenMint: mintKp.publicKey,
                fundingVault: fv,
                usdcVault: usdcVlt,
                usdcMint: USDC_MINT,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([mintKp])
            .rpc();

        console.log(`  ${listingId}: propertyToken=${pt.toBase58().slice(0,16)}...  tokenMint=${mintKp.publicKey.toBase58().slice(0,16)}...`);
        return pt;
    };

    const now    = Math.floor(Date.now() / 1000);
    const mintKp1 = Keypair.generate();
    const mintKp2 = Keypair.generate();
    const mintKp3 = Keypair.generate();

    await initProperty(LISTING_ACTIVE, mintKp1, now + 120);       // 120초 deadline
    await initProperty(LISTING_FAIL,   mintKp2, now + 60);        // 60초 deadline (02-invest 완료 후 경과)
    await initProperty(LISTING_BOOK,   mintKp3, now + 30*24*3600, 10); // 30일 deadline
    console.log();

    // 상태 저장
    saveState({
        investor1:  bs58.encode(investor1.secretKey),
        investor2:  bs58.encode(investor2.secretKey),
        investor3:  bs58.encode(investor3.secretKey),
        guest:      bs58.encode(guest.secretKey),
        treasury:   bs58.encode(treasury.secretKey),
        mintKp1:    bs58.encode(mintKp1.secretKey),
        mintKp2:    bs58.encode(mintKp2.secretKey),
        mintKp3:    bs58.encode(mintKp3.secretKey),
        inv1Usdc:   inv1Usdc.toBase58(),
        inv2Usdc:   inv2Usdc.toBase58(),
        inv3Usdc:   inv3Usdc.toBase58(),
        guestUsdc:  guestUsdc.toBase58(),
    });

    console.log("state.json 저장 완료");
    console.log("\n다음: npx tsx scripts/scenario/02-invest.ts");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
