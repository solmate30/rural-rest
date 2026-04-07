/**
 * demo-invest-others.ts — 나머지 매물(3000, 3001, 3003, 3004) 소액 투자
 *
 * 대시보드 다양성을 위해 각 매물에 10~20% 정도 투자 기록 생성
 *
 * 실행: cd web && npx tsx scripts/demo-invest-others.ts
 *
 * 전제조건:
 *   - tokenize-rest.ts 완료 (4개 매물 온체인 배포 + DB 저장)
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
const TOTAL_SUPPLY = 100_000_000;

// 각 매물에 투자할 양 (토큰 수)
// 3000: 15%, 3001: 10%, 3003: 20%, 3004: 12%
const INVESTMENTS = [
    { listingId: "3000", buyAmount: 15_000_000, label: "15%", kpFile: "other-investor-3000.json" },
    { listingId: "3001", buyAmount: 10_000_000, label: "10%", kpFile: "other-investor-3001.json" },
    { listingId: "3003", buyAmount: 20_000_000, label: "20%", kpFile: "other-investor-3003.json" },
    { listingId: "3004", buyAmount: 12_000_000, label: "12%", kpFile: "other-investor-3004.json" },
];

async function main() {
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    const programIdAddr = process.env.VITE_RWA_PROGRAM_ID;
    if (!usdcMintAddr || !programIdAddr) {
        console.error("VITE_USDC_MINT 또는 VITE_RWA_PROGRAM_ID 미설정");
        process.exit(1);
    }

    const { db } = await import("../app/db/index.server.js");
    const { rwaTokens, rwaInvestments } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");

    const connection = new Connection(RPC_URL, "confirmed");
    const usdcMint = new PublicKey(usdcMintAddr);
    const programId = new PublicKey(programIdAddr);

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(
            path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
        )))
    );

    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );

    console.log(`Admin:   ${adminKeypair.publicKey.toBase58()}`);
    console.log(`Program: ${programIdAddr}`);
    console.log(`USDC:    ${usdcMintAddr}\n`);

    for (const inv of INVESTMENTS) {
        console.log(`\n── ${inv.listingId} (${inv.label}) ──────────────────────────────────`);

        // DB에서 token 정보 조회
        const [token] = await db
            .select({
                id: rwaTokens.id,
                tokenMint: rwaTokens.tokenMint,
                pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
                tokensSold: rwaTokens.tokensSold,
            })
            .from(rwaTokens)
            .where(eq(rwaTokens.listingId, inv.listingId));

        if (!token?.tokenMint) {
            console.warn(`  tokenMint 없음 — tokenize-rest.ts 먼저 실행하세요`);
            continue;
        }

        const tokenMintPubkey = new PublicKey(token.tokenMint);
        console.log(`  tokenMint: ${token.tokenMint.slice(0, 12)}...`);

        // 투자자 키페어 로드 또는 생성
        const kpPath = path.join(__dirname, inv.kpFile);
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
            console.log(`  SOL 에어드롭 완료`);
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

        const [propertyToken] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(inv.listingId)],
            programId
        );
        const [fundingVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("funding_vault"), Buffer.from(inv.listingId)],
            programId
        );
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

        // openPosition (없으면)
        const positionInfo = await connection.getAccountInfo(investorPosition);
        if (!positionInfo) {
            preIxs.push(
                await (program.methods as any)
                    .openPosition(inv.listingId)
                    .accounts({ investor: investor.publicKey, propertyToken, investorPosition })
                    .instruction()
            );
        }

        const sig = await (program.methods as any)
            .purchaseTokens(inv.listingId, new BN(inv.buyAmount))
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
        const newSold = token.tokensSold + inv.buyAmount;
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
            .set({ tokensSold: newSold, updatedAt: new Date() })
            .where(eq(rwaTokens.id, token.id));

        const pct = ((newSold / TOTAL_SUPPLY) * 100).toFixed(1);
        console.log(`  tokensSold: ${newSold.toLocaleString()} (${pct}%)`);
    }

    console.log(`\n완료! 나머지 4개 매물에 소액 투자 완료.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
