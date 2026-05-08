/**
 * 투자자 시드 스크립트 — listing 3003 나머지 토큰 100% 채우기 (on-chain)
 * 실행: cd web && npx tsx scripts/seed-investors.ts
 *
 * 전제: solana-test-validator 실행 중, anchor deploy 완료, setup-localnet.ts 실행 완료
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    mintTo,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

const RPC_URL = "http://127.0.0.1:8899";
const LISTING_ID = process.argv[2] ?? "3003";
// --force N: on-chain 값 무시하고 N개를 강제로 구매
// 예: npx tsx scripts/seed-investors.ts 3002 --force 60215265
const forceIdx = process.argv.indexOf("--force");
const FORCE_REMAINING = forceIdx !== -1 ? parseInt(process.argv[forceIdx + 1]) : null;
const INVESTOR_COUNT = 5;
const KEYPAIR_PATH = path.join(process.env.HOME!, ".config/solana/id.json");
const ENV_PATH = path.join(__dirname, "../.env");
const ENV_LOCAL_PATH = path.join(__dirname, "../.env.local");

function readEnv(): Record<string, string> {
    const envPath = fs.existsSync(ENV_LOCAL_PATH) ? ENV_LOCAL_PATH : ENV_PATH;
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    const result: Record<string, string> = {};
    for (const line of lines) {
        const [k, ...v] = line.split("=");
        if (k && v.length) result[k.trim()] = v.join("=").trim();
    }
    return result;
}

const FAKE_NAMES = ["Alice Kim", "Bob Tanaka", "Carol Lee", "David Park", "Eva Chen"];
const FAKE_EMAILS = [
    "alice.kim@demo.test",
    "bob.tanaka@demo.test",
    "carol.lee@demo.test",
    "david.park@demo.test",
    "eva.chen@demo.test",
];

async function main() {
    const env = readEnv();
    const RWA_PROGRAM_ID = new PublicKey(env["VITE_RWA_PROGRAM_ID"] ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
    const usdcMintPubkey = new PublicKey(env["VITE_USDC_MINT"]!);

    if (!env["VITE_USDC_MINT"]) {
        console.error("VITE_USDC_MINT이 .env에 없습니다. setup-localnet.ts를 먼저 실행하세요.");
        process.exit(1);
    }

    // admin keypair (mint authority)
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")))
    );

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );
    const program = new Program(IDL, provider);

    // DB에서 rwaToken 조회
    const { db } = await import("../app/db/index.server");
    const { listings, rwaTokens, rwaInvestments, user } = await import("../app/db/schema");
    const { eq } = await import("drizzle-orm");

    const [listingRow] = await db.select({ id: listings.id }).from(listings).where(eq(listings.nodeNumber, Number(LISTING_ID)));
    if (!listingRow) { console.error(`listing ${LISTING_ID} 없음. seed-test-listing.ts 먼저 실행`); process.exit(1); }

    const [token] = await db.select().from(rwaTokens).where(eq(rwaTokens.listingId, listingRow.id));
    if (!token) { console.error("rwaToken 없음. 어드민에서 토큰 발행 먼저"); process.exit(1); }
    if (!token.tokenMint) { console.error("tokenMint 없음. 토큰 발행 완료 필요"); process.exit(1); }

    const tokenMintPubkey = new PublicKey(token.tokenMint);

    // PDAs
    const seedId = listingRow.id.replace(/-/g, "");
    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(seedId)], RWA_PROGRAM_ID
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(seedId)], RWA_PROGRAM_ID
    );

    // on-chain 실제값 조회
    let onchainSold: number | null = null;
    try {
        const data = await (program.account as any).propertyToken.fetch(propertyToken);
        onchainSold = Number(data.tokensSold);
    } catch { /* PDA 없음 또는 연결 실패 */ }

    const totalSupply = token.totalSupply;
    console.log(`총 공급량:       ${totalSupply.toLocaleString()}`);
    console.log(`DB 판매됨:       ${token.tokensSold.toLocaleString()}`);
    console.log(`on-chain 판매됨: ${onchainSold !== null ? onchainSold.toLocaleString() : "(조회 실패 — PDA 없음)"}`);

    const effectiveSold = FORCE_REMAINING !== null
        ? totalSupply - FORCE_REMAINING
        : (onchainSold ?? token.tokensSold);
    const remaining = FORCE_REMAINING !== null ? FORCE_REMAINING : totalSupply - effectiveSold;

    console.log(`남은 수량:       ${remaining.toLocaleString()}${FORCE_REMAINING !== null ? " (--force 강제 지정)" : ""}\n`);

    if (remaining <= 0 && FORCE_REMAINING === null) { console.log("on-chain 기준 이미 100% 완판. --force N 으로 강제 지정 가능."); process.exit(0); }

    const perInvestor = Math.floor(remaining / INVESTOR_COUNT);
    const amounts = Array(INVESTOR_COUNT).fill(perInvestor);
    amounts[INVESTOR_COUNT - 1] += remaining - perInvestor * INVESTOR_COUNT;

    const now = new Date();

    for (let i = 0; i < INVESTOR_COUNT; i++) {
        const investorKeypair = Keypair.generate();
        const tokenAmount = amounts[i];
        const investedUsdc = tokenAmount * token.pricePerTokenUsdc; // micro-USDC

        console.log(`\n[${i + 1}/${INVESTOR_COUNT}] ${FAKE_NAMES[i]} (${investorKeypair.publicKey.toBase58().slice(0, 8)}...)`);

        // SOL airdrop
        const airdropSig = await connection.requestAirdrop(investorKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, "confirmed");
        console.log(`  ✓ SOL airdrop 완료`);

        // USDC ATA 생성 + 민트
        const investorUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection, authority, usdcMintPubkey, investorKeypair.publicKey, false, "confirmed", {}, TOKEN_PROGRAM_ID
        );
        await mintTo(
            connection, authority, usdcMintPubkey, investorUsdcAccount.address,
            authority, investedUsdc, [], { commitment: "confirmed" }, TOKEN_PROGRAM_ID
        );
        console.log(`  ✓ USDC 민트: ${(investedUsdc / 1_000_000).toFixed(2)} USDC`);

        // RWA ATA
        const investorRwaAccount = getAssociatedTokenAddressSync(
            tokenMintPubkey, investorKeypair.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        // investor_position PDA
        const [investorPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyToken.toBuffer(), investorKeypair.publicKey.toBuffer()],
            RWA_PROGRAM_ID
        );

        const investorProvider = new AnchorProvider(connection, new Wallet(investorKeypair), { commitment: "confirmed" });
        const investorProgram = new Program(IDL, investorProvider);

        // open_position
        await (investorProgram.methods as any)
            .openPosition(seedId)
            .accounts({ investor: investorKeypair.publicKey, propertyToken, investorPosition })
            .rpc();
        console.log(`  ✓ open_position 완료`);

        // purchase_tokens (RWA ATA는 init_if_needed이므로 자동 생성)
        await (investorProgram.methods as any)
            .purchaseTokens(seedId, new BN(tokenAmount))
            .accounts({
                investor: investorKeypair.publicKey,
                propertyToken,
                tokenMint: tokenMintPubkey,
                investorPosition,
                investorUsdcAccount: investorUsdcAccount.address,
                fundingVault,
                investorRwaAccount,
                usdcMint: usdcMintPubkey,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        console.log(`  ✓ purchase_tokens: ${tokenAmount.toLocaleString()} tokens`);

        // DB 기록
        const userId = randomUUID();
        await db.insert(user).values({
            id: userId,
            name: FAKE_NAMES[i],
            email: FAKE_EMAILS[i],
            emailVerified: true,
            role: "guest",
            preferredLang: "en",
            walletAddress: investorKeypair.publicKey.toBase58(),
            kycVerified: true,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoNothing();

        const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, FAKE_EMAILS[i]));

        await db.insert(rwaInvestments).values({
            id: randomUUID(),
            walletAddress: investorKeypair.publicKey.toBase58(),
            userId: existingUser.id,
            rwaTokenId: token.id,
            tokenAmount,
            investedUsdc,
        }).onConflictDoNothing();

        // DB tokensSold 동기화
        await db.update(rwaTokens)
            .set({ tokensSold: token.tokensSold + amounts.slice(0, i + 1).reduce((a, b) => a + b, 0) })
            .where(eq(rwaTokens.id, token.id));
    }

    // 최종 status 업데이트
    await db.update(rwaTokens)
        .set({ tokensSold: token.totalSupply, status: "active" })
        .where(eq(rwaTokens.id, token.id));

    console.log(`\n✅ 완료! listing ${LISTING_ID} → 100% 완판, status: active`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
