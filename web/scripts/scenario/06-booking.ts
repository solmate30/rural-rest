/**
 * 06-booking.ts — 예약 에스크로 시나리오
 *
 * ※ anchor build --features skip-oracle 로 배포된 경우에만 동작합니다.
 *    (Pyth price feed 없는 localnet 환경 대응)
 *
 * F-1: create_booking_escrow (게스트 USDC → 에스크로)
 * F-2: cancel_booking_escrow (100% 환불, 체크인 전)
 * F-3: cancel_booking_escrow_partial (50% 게스트 / 50% 호스트)
 * F-4: release_booking_escrow (체크아웃 경과 → listing_vault 90% + treasury 10%)
 *
 * 실행: cd web && npx tsx scripts/scenario/06-booking.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
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

const LISTING_BOOK = "e2e003"; // host = admin

// booking IDs: ≤32바이트 (하이픈 없이 사용됨)
const BKG_A = "bkge2ea0000000000000000000000001"; // 31 bytes
const BKG_B = "bkge2eb0000000000000000000000002";
const BKG_C = "bkge2ec0000000000000000000000003";

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("=== [06] 예약 에스크로 시나리오 ===\n");
    console.log("  ※ skip-oracle 배포 전제 (pythPriceFeed = SystemProgram)\n");

    if (!process.env.CRANK_SECRET_KEY) { console.error("CRANK_SECRET_KEY 미설정"); process.exit(1); }

    const state  = loadState();
    const adminKp = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );
    const guest  = kp(state.guest);
    const treasury = kp(state.treasury);
    const crank  = Keypair.fromSecretKey(bs58.decode(process.env.CRANK_SECRET_KEY!));

    const connection    = new Connection(RPC_URL, "confirmed");
    const adminProvider = new AnchorProvider(connection, new Wallet(adminKp), { commitment: "confirmed" });
    const adminProgram  = new Program(IDL as any, adminProvider);
    const guestProvider = new AnchorProvider(connection, new Wallet(guest), { commitment: "confirmed" });
    const guestProgram  = new Program(IDL as any, guestProvider);
    const crankProvider = new AnchorProvider(
        connection,
        {
            publicKey: crank.publicKey,
            signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
            signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(crank)); return txs; },
        } as any,
        { commitment: "confirmed" }
    );
    const crankProgram = new Program(IDL as any, crankProvider);

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
    const pt3       = pda([Buffer.from("property"), Buffer.from(LISTING_BOOK)]);
    const rwaConfig = pda([Buffer.from("rwa_config")]);
    const lvPda     = pda([Buffer.from("listing_vault"), Buffer.from(LISTING_BOOK)]);
    const lvAta     = getAssociatedTokenAddressSync(USDC_MINT, lvPda, true, TOKEN_PROGRAM_ID);

    const escrowPda  = (bid: string) => pda([Buffer.from("booking_escrow"), Buffer.from(bid)]);
    const escrowVlt  = (ep: PublicKey) => getAssociatedTokenAddressSync(USDC_MINT, ep, true, TOKEN_PROGRAM_ID);

    // treasury 설정
    const treasuryUsdc = await getOrCreateAssociatedTokenAccount(
        connection, adminKp, USDC_MINT, treasury.publicKey, false, "confirmed", undefined, TOKEN_PROGRAM_ID
    );
    await (adminProgram.methods as any)
        .setTreasury(treasury.publicKey)
        .accounts({ rwaConfig, authority: adminKp.publicKey })
        .rpc();
    console.log(`  treasury 설정: ${treasury.publicKey.toBase58().slice(0, 16)}...`);

    // listing_vault 초기화 (매물당 1회, 이미 존재하면 무시)
    try {
        await (adminProgram.methods as any)
            .initializeListingVault(LISTING_BOOK)
            .accounts({
                authority: adminKp.publicKey,
                rwaConfig,
                listingVault: lvPda,
                listingVaultAta: lvAta,
                usdcMint: USDC_MINT,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        console.log(`  listing_vault 초기화 완료`);
    } catch (e: any) {
        if (!e.toString().includes("already in use") && !e.toString().includes("0x0")) throw e;
        console.log(`  listing_vault 이미 초기화됨 (재사용)`);
    }

    const adminUsdc = getAssociatedTokenAddressSync(USDC_MINT, adminKp.publicKey, false, TOKEN_PROGRAM_ID); // host = admin
    const guestUsdc = getAssociatedTokenAddressSync(USDC_MINT, guest.publicKey, false, TOKEN_PROGRAM_ID);

    const create = async (bid: string, checkInOffset: number, checkOutOffset: number, label: string) => {
        const now   = Math.floor(Date.now() / 1000);
        const ep    = escrowPda(bid);
        const ev    = escrowVlt(ep);
        await (guestProgram.methods as any)
            .createBookingEscrow(LISTING_BOOK, bid, new BN(100_000), new BN(now + checkInOffset), new BN(now + checkOutOffset))
            .accounts({
                guest: guest.publicKey,
                propertyToken: pt3,
                bookingEscrow: ep,
                escrowVault: ev,
                guestUsdc,
                usdcMint: USDC_MINT,
                pythPriceFeed: SystemProgram.programId, // skip-oracle
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        const vaultBal = BigInt((await connection.getTokenAccountBalance(ev)).value.amount);
        console.log(`  [${label}] 에스크로 생성: 볼트 ${vaultBal} micro-USDC`);
        return { ep, ev, vaultBal };
    };

    // F-1: 체크아웃 5초 후 (release_booking_escrow 테스트용)
    const { ep: epA, ev: evA, vaultBal: vaultA } = await create(BKG_A, 3, 5, "F-1");

    // F-2: 체크인 1일 후 (100% 환불, 게스트 취소)
    const { ep: epB, ev: evB, vaultBal: vaultB } = await create(BKG_B, 60*60*24, 60*60*24*2, "F-2");

    const guestBefore = BigInt((await connection.getTokenAccountBalance(guestUsdc)).value.amount);
    await (guestProgram.methods as any)
        .cancelBookingEscrow(BKG_B)
        .accounts({ caller: guest.publicKey, bookingEscrow: epB, escrowVault: evB, guestUsdc, rwaConfig, usdcMint: USDC_MINT, usdcTokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
    const guestAfter = BigInt((await connection.getTokenAccountBalance(guestUsdc)).value.amount);
    console.log(`  [F-2] 100% 환불: ${guestAfter - guestBefore} micro-USDC  (전액: ${vaultB})`);

    // F-3: 50% 부분취소 (authority 호출)
    const { ep: epC, ev: evC, vaultBal: vaultC } = await create(BKG_C, 60*60*24*5, 60*60*24*7, "F-3");

    const guestBefore3 = BigInt((await connection.getTokenAccountBalance(guestUsdc)).value.amount);
    const hostBefore3  = BigInt((await connection.getTokenAccountBalance(adminUsdc)).value.amount);
    await (adminProgram.methods as any)
        .cancelBookingEscrowPartial(BKG_C, 5000)
        .accounts({ caller: adminKp.publicKey, bookingEscrow: epC, escrowVault: evC, guestUsdc, hostUsdc: adminUsdc, rwaConfig, usdcMint: USDC_MINT, usdcTokenProgram: TOKEN_PROGRAM_ID })
        .rpc();
    const guestAfter3 = BigInt((await connection.getTokenAccountBalance(guestUsdc)).value.amount);
    const hostAfter3  = BigInt((await connection.getTokenAccountBalance(adminUsdc)).value.amount);
    console.log(`  [F-3] 50% 부분취소: 게스트 ${guestAfter3 - guestBefore3} / 호스트 ${hostAfter3 - hostBefore3}  (총: ${vaultC})`);

    // F-4: release_booking_escrow (체크아웃 5초 경과 대기)
    console.log("  [F-4] 체크아웃 경과 대기 (5초)...");
    await sleep(6000);

    const lvBefore4       = BigInt((await connection.getTokenAccountBalance(lvAta)).value.amount);
    const treasuryBefore4 = BigInt((await connection.getTokenAccountBalance(treasuryUsdc.address)).value.amount);

    await (crankProgram.methods as any)
        .releaseBookingEscrow(BKG_A)
        .accounts({
            operator: crank.publicKey,
            bookingEscrow: epA,
            escrowVault: evA,
            listingVault: lvPda,
            listingVaultAta: lvAta,
            treasuryUsdc: treasuryUsdc.address,
            rwaConfig,
            usdcMint: USDC_MINT,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    const lvAfter4       = BigInt((await connection.getTokenAccountBalance(lvAta)).value.amount);
    const treasuryAfter4 = BigInt((await connection.getTokenAccountBalance(treasuryUsdc.address)).value.amount);
    const lvGot       = lvAfter4       - lvBefore4;
    const treasuryGot = treasuryAfter4 - treasuryBefore4;
    console.log(`  [F-4] 정산: listing_vault ${lvGot} (90%), treasury ${treasuryGot} (10%), 총 ${vaultA}`);

    const tenPct = vaultA / 10n;
    const diff = treasuryGot > tenPct ? treasuryGot - tenPct : tenPct - treasuryGot;
    if (diff > 1n) throw new Error(`treasury 10% 불일치: ${treasuryGot} vs ${tenPct}`);

    console.log("\n  예약 에스크로 검증 완료");
    console.log("\n다음: npx tsx scripts/scenario/07-dao.ts");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
