/**
 * demo-invest.ts — 데모용 순차 투자 스크립트
 *
 * 투자자 4명이 순차적으로 투자 → 누적 20% → 30% → 50% → 60%
 *
 * 실행: cd web && npx tsx scripts/demo-invest.ts
 *
 * 전제조건:
 *   - admin 대시보드에서 Issue Tokens 완료 (tokenMint DB에 저장됨)
 *   - solana-test-validator 실행 중
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
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
const LISTING_ID = "3002"; // Silla Forest Hostel
const TOTAL_SUPPLY = 100_000_000;

// 누적 목표: 20% → 30% → 50% → 60%
// 각 투자자 구매량: 20M, 10M, 20M, 10M
// START_FROM_INDEX=N 환경변수로 특정 투자자부터 시작 가능 (예: START_FROM_INDEX=3 → 4번째만 실행)
const INVESTORS = [
    { file: "demo-investor-1.json", buyAmount: 20_000_000, label: "20%" },
    { file: "demo-investor-2.json", buyAmount: 10_000_000, label: "30%" },
    { file: "demo-investor-3.json", buyAmount: 20_000_000, label: "50%" },
    { file: "demo-investor-4.json", buyAmount: 10_000_000, label: "60%" },
];
const START_FROM = Number(process.env.START_FROM_INDEX ?? 0);

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    const programIdAddr = process.env.VITE_RWA_PROGRAM_ID;
    if (!usdcMintAddr || !programIdAddr) {
        console.error("VITE_USDC_MINT 또는 VITE_RWA_PROGRAM_ID 미설정");
        process.exit(1);
    }

    // DB 조회
    const { db } = await import("../app/db/index.server.js");
    const { listings, rwaTokens, rwaInvestments } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");

    const [token] = await db
        .select({
            id: rwaTokens.id,
            tokenMint: rwaTokens.tokenMint,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            tokensSold: rwaTokens.tokensSold,
            status: rwaTokens.status,
        })
        .from(rwaTokens)
        .where(eq(rwaTokens.listingId, LISTING_ID));

    if (!token?.tokenMint) {
        console.error("tokenMint 없음 — admin 대시보드에서 Issue Tokens 먼저 실행하세요");
        process.exit(1);
    }

    console.log(`Token: ${token.tokenMint}`);
    console.log(`현재 tokensSold: ${token.tokensSold.toLocaleString()}\n`);

    const connection = new Connection(RPC_URL, "confirmed");
    const usdcMint = new PublicKey(usdcMintAddr);
    const programId = new PublicKey(programIdAddr);
    const tokenMintPubkey = new PublicKey(token.tokenMint);

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(
            path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
        )))
    );

    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );

    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(LISTING_ID)],
        programId
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(LISTING_ID)],
        programId
    );

    let cumulative = token.tokensSold;

    for (const [idx, inv] of INVESTORS.entries()) {
        if (idx < START_FROM) { console.log(`  스킵: ${inv.label} (START_FROM_INDEX=${START_FROM})`); continue; }
        console.log(`\n── 투자자 (목표 누적 ${inv.label}) ──────────────────`);

        // 키페어 로드 또는 생성
        const kpPath = path.join(__dirname, inv.file);
        let investor: Keypair;
        if (fs.existsSync(kpPath)) {
            investor = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf-8")))
            );
            console.log(`  키페어: ${investor.publicKey.toBase58().slice(0, 12)}... (기존)`);
        } else {
            investor = Keypair.generate();
            fs.writeFileSync(kpPath, JSON.stringify(Array.from(investor.secretKey)));
            console.log(`  키페어: ${investor.publicKey.toBase58().slice(0, 12)}... (신규)`);
        }

        // SOL 에어드롭
        const solBal = await connection.getBalance(investor.publicKey);
        if (solBal < 0.5 * 1e9) {
            const sig = await connection.requestAirdrop(investor.publicKey, 2 * 1e9);
            await connection.confirmTransaction(sig, "confirmed");
        }

        // USDC 민팅
        const neededUsdc = inv.buyAmount * token.pricePerTokenUsdc + 1_000_000;
        const investorUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection, adminKeypair, usdcMint, investor.publicKey,
            false, "confirmed", undefined, TOKEN_PROGRAM_ID
        );
        await mintTo(
            connection, adminKeypair, usdcMint, investorUsdcAta.address,
            adminKeypair, neededUsdc, [], undefined, TOKEN_PROGRAM_ID
        );
        console.log(`  USDC: ${(neededUsdc / 1e6).toFixed(2)} 민팅`);

        // Provider
        const provider = new AnchorProvider(connection, new Wallet(investor), { commitment: "confirmed" });
        const program = new Program({ ...IDL, address: programIdAddr } as any, provider);

        const [investorPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyToken.toBuffer(), investor.publicKey.toBuffer()],
            programId
        );
        const investorRwaAccount = getAssociatedTokenAddressSync(
            tokenMintPubkey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        const preIxs = [
            createAssociatedTokenAccountIdempotentInstruction(
                investor.publicKey, investorUsdcAta.address, investor.publicKey, usdcMint, TOKEN_PROGRAM_ID
            ),
        ];

        const positionInfo = await connection.getAccountInfo(investorPosition);
        if (!positionInfo) {
            preIxs.push(
                await (program.methods as any)
                    .openPosition(LISTING_ID)
                    .accounts({ investor: investor.publicKey, propertyToken, investorPosition })
                    .instruction()
            );
        }

        const sig = await (program.methods as any)
            .purchaseTokens(LISTING_ID, new BN(inv.buyAmount))
            .accounts({
                investor: investor.publicKey,
                propertyToken,
                tokenMint: tokenMintPubkey,
                investorPosition,
                investorUsdcAccount: investorUsdcAta.address,
                fundingVault,
                investorRwaAccount,
                usdcMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .preInstructions(preIxs)
            .rpc();

        console.log(`  tx: ${sig.slice(0, 20)}...`);

        // DB 기록
        cumulative += inv.buyAmount;
        await db.insert(rwaInvestments).values({
            id: uuidv4(),
            walletAddress: investor.publicKey.toBase58(),
            rwaTokenId: token.id,
            tokenAmount: inv.buyAmount,
            investedUsdc: inv.buyAmount * token.pricePerTokenUsdc,
            purchaseTx: sig,
            createdAt: new Date(),
        });

        await db.update(rwaTokens)
            .set({ tokensSold: cumulative, updatedAt: new Date() })
            .where(eq(rwaTokens.id, token.id));

        const pct = ((cumulative / TOTAL_SUPPLY) * 100).toFixed(1);
        console.log(`  누적: ${cumulative.toLocaleString()} / ${TOTAL_SUPPLY.toLocaleString()} (${pct}%)`);

        // 1.5초 간격 (녹화 시 UI 업데이트 보여주기)
        await sleep(1500);
    }

    console.log(`\n투자 완료! 총 ${((cumulative / TOTAL_SUPPLY) * 100).toFixed(1)}% 모집`);
    console.log(`다음: Funding Deadline 지나면 admin 대시보드에서 Activate 클릭`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
