/**
 * tokenize-rest.ts — 나머지 매물 RWA 토큰 발행 (데모 대시보드 채우기용)
 *
 * Silla Forest Hostel (3002)은 유저가 직접 발행 — 여기서는 제외
 * 나머지 4개: 3000, 3001, 3003, 3004
 *
 * 실행: cd web && npx tsx scripts/tokenize-rest.ts
 *
 * 전제조건:
 *   - solana-test-validator 실행 중
 *   - setup-localnet.ts 완료
 *   - seed-test-listing-en.ts 완료
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const RPC_URL = "http://127.0.0.1:8899";
const TOTAL_SUPPLY = 100_000_000;
const KRW_PER_USDC = 1400;

// APY 계산 (save-mint API와 동일 로직)
const OCCUPANCY_RATE = 0.55;
const OPERATING_COST_RATIO = 0.45;
const INVESTOR_SHARE = 0.30;

function calcApyBps(pricePerNight: number, valuationKrw: number): number {
    if (valuationKrw <= 0) return 0;
    const annualGross = pricePerNight * 365 * OCCUPANCY_RATE;
    const noi = annualGross * (1 - OPERATING_COST_RATIO);
    const investorReturn = noi * INVESTOR_SHARE;
    return Math.round(investorReturn / valuationKrw * 10000);
}

// 발행할 매물 목록 (3002 제외 — 유저가 직접)
const LISTINGS_TO_TOKENIZE = [
    { id: "3000", valuationKrw: 98_000_000,  minFundingBps: 6000 },
    { id: "3001", valuationKrw: 126_000_000, minFundingBps: 6000 },
    { id: "3003", valuationKrw: 77_000_000,  minFundingBps: 6000 },
    { id: "3004", valuationKrw: 91_000_000,  minFundingBps: 6000 },
];

async function main() {
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    const programIdAddr = process.env.VITE_RWA_PROGRAM_ID;
    if (!usdcMintAddr || !programIdAddr) {
        console.error("VITE_USDC_MINT 또는 VITE_RWA_PROGRAM_ID 미설정");
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(
            path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
        )))
    );

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(adminKeypair), { commitment: "confirmed" });

    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );
    const programId = new PublicKey(programIdAddr);
    const program = new Program({ ...IDL, address: programIdAddr } as any, provider);
    const usdcMint = new PublicKey(usdcMintAddr);

    const { db } = await import("../app/db/index.server.js");
    const { listings, rwaTokens } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");

    console.log(`Admin:    ${adminKeypair.publicKey.toBase58()}`);
    console.log(`Program:  ${programIdAddr}`);
    console.log(`USDC:     ${usdcMintAddr}\n`);

    for (const meta of LISTINGS_TO_TOKENIZE) {
        console.log(`\n── ${meta.id} ──────────────────────────────────`);

        // DB에서 listing 정보 조회
        const [listing] = await db
            .select({ id: listings.id, title: listings.title, pricePerNight: listings.pricePerNight, valuationKrw: listings.valuationKrw })
            .from(listings)
            .where(eq(listings.id, meta.id));

        if (!listing) {
            console.warn(`  listing ${meta.id} 없음 — 스킵`);
            continue;
        }

        const valuationKrw = listing.valuationKrw ?? meta.valuationKrw;
        const pricePerTokenUsdc = Math.round((valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000);
        const deadlineTs = Math.floor(Date.now() / 1000) + 10 * 60; // 현재 시각 + 10분
        const estimatedApyBps = calcApyBps(listing.pricePerNight, valuationKrw);

        console.log(`  ${listing.title}`);
        console.log(`  valuationKrw: ₩${(valuationKrw / 1_000_000).toFixed(0)}M`);
        console.log(`  pricePerToken: ${pricePerTokenUsdc} micro-USDC`);
        console.log(`  deadline: ${new Date(deadlineTs * 1000).toLocaleDateString()}`);

        // PDAs
        const [propertyToken] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(meta.id)],
            programId
        );
        const [fundingVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("funding_vault"), Buffer.from(meta.id)],
            programId
        );
        const usdcVault = getAssociatedTokenAddressSync(
            usdcMint, propertyToken, true, TOKEN_PROGRAM_ID
        );

        // 이미 온체인 존재하면 스킵
        const existing = await connection.getAccountInfo(propertyToken);
        if (existing) {
            console.log(`  온체인 이미 존재 — DB만 업데이트`);
        } else {
            // 새 Token-2022 민트 키페어
            const mintKeypair = Keypair.generate();

            const sig = await (program.methods as any)
                .initializeProperty(
                    meta.id,
                    new BN(TOTAL_SUPPLY),
                    new BN(valuationKrw),
                    new BN(pricePerTokenUsdc),
                    new BN(deadlineTs),
                    meta.minFundingBps,
                )
                .accounts({
                    authority: adminKeypair.publicKey,
                    propertyToken,
                    tokenMint: mintKeypair.publicKey,
                    fundingVault,
                    usdcVault,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([mintKeypair])
                .rpc();

            console.log(`  tx: ${sig.slice(0, 20)}...`);
            console.log(`  tokenMint: ${mintKeypair.publicKey.toBase58()}`);

            // DB 저장
            const symbol = `RURAL-${meta.id}`;
            const fundingDeadline = new Date(deadlineTs * 1000);

            const existingDb = await db.select({ id: rwaTokens.id }).from(rwaTokens).where(eq(rwaTokens.listingId, meta.id));
            if (existingDb.length > 0) {
                await db.update(rwaTokens).set({
                    tokenMint: mintKeypair.publicKey.toBase58(),
                    symbol, totalSupply: TOTAL_SUPPLY, tokensSold: 0,
                    valuationKrw, pricePerTokenUsdc, minFundingBps: meta.minFundingBps,
                    estimatedApyBps, fundingDeadline, status: "funding",
                    updatedAt: new Date(),
                }).where(eq(rwaTokens.listingId, meta.id));
            } else {
                await db.insert(rwaTokens).values({
                    id: uuidv4(), listingId: meta.id,
                    tokenMint: mintKeypair.publicKey.toBase58(),
                    symbol, totalSupply: TOTAL_SUPPLY, tokensSold: 0,
                    valuationKrw, pricePerTokenUsdc, minFundingBps: meta.minFundingBps,
                    estimatedApyBps, fundingDeadline, status: "funding",
                    programId: programIdAddr,
                    createdAt: new Date(), updatedAt: new Date(),
                });
            }
            console.log(`  DB 저장 완료 (status: funding)`);
        }
    }

    console.log(`\n완료! admin 대시보드에서 4개 매물이 Funding 상태로 보입니다.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
