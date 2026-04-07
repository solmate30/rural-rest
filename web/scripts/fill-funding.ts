/**
 * fill-funding.ts — 특정 매물 모집금액 100% 채우기 (localnet 데모용)
 *
 * 동작:
 *   1. DB에서 매물 타이틀로 rwaToken 조회
 *   2. 남은 토큰 계산 (totalSupply - tokensSold)
 *   3. admin 키페어에 USDC 민팅
 *   4. openPosition + purchaseTokens 온체인 호출
 *   5. DB tokensSold 업데이트
 *
 * 실행:
 *   cd web && npx tsx scripts/fill-funding.ts "Silla Forest Hostel" [targetPct=100]
 *   예) 30%만 채우기: npx tsx scripts/fill-funding.ts "Hwango Cheongsongjae" 30
 *
 * 전제조건:
 *   - solana-test-validator 실행 중
 *   - setup-localnet.ts 완료 (VITE_USDC_MINT 설정됨)
 *   - anchor deploy --provider.cluster localnet 완료
 *   - 매물 initialize + activate 완료
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
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
import { eq, like } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, "../.env");
config({ path: ENV_PATH });

const RPC_URL = "http://127.0.0.1:8899";
const ADMIN_KEYPAIR_PATH = path.join(process.env.HOME!, ".config/solana/id.json");
const MAX_INVESTOR_SLOTS = 5; // 최대 투자자 수 (30% 캡 → 최소 4명으로 100% 가능)

async function main() {
    const titleQuery = process.argv[2];
    const targetPct = process.argv[3] ? parseInt(process.argv[3]) : 100;
    if (!titleQuery) {
        console.error("Usage: npx tsx scripts/fill-funding.ts <listing-title> [targetPct=100]");
        process.exit(1);
    }
    if (targetPct < 1 || targetPct > 100) {
        console.error("targetPct must be 1-100");
        process.exit(1);
    }

    // ── 환경변수 확인 ──────────────────────────────────────────────────────────
    const usdcMintAddr = process.env.VITE_USDC_MINT;
    const programIdAddr = process.env.VITE_RWA_PROGRAM_ID;
    if (!usdcMintAddr) { console.error("VITE_USDC_MINT not set"); process.exit(1); }
    if (!programIdAddr) { console.error("VITE_RWA_PROGRAM_ID not set"); process.exit(1); }

    // ── 키페어 로드 ────────────────────────────────────────────────────────────
    const admin = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(ADMIN_KEYPAIR_PATH, "utf-8")))
    );
    console.log(`Admin:     ${admin.publicKey.toBase58()}`);
    console.log(`USDC Mint: ${usdcMintAddr}`);
    console.log(`Program:   ${programIdAddr}\n`);

    // ── DB 조회 ────────────────────────────────────────────────────────────────
    const { db } = await import("../app/db/index.server.js");
    const { listings, rwaTokens } = await import("../app/db/schema.js");

    const rows = await db
        .select({
            listingId: listings.id,
            title: listings.title,
            tokenId: rwaTokens.id,
            tokenMint: rwaTokens.tokenMint,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            pricePerTokenUsdc: rwaTokens.pricePerTokenUsdc,
            status: rwaTokens.status,
        })
        .from(rwaTokens)
        .innerJoin(listings, eq(rwaTokens.listingId, listings.id))
        .where(like(listings.title, `%${titleQuery}%`));

    if (rows.length === 0) {
        console.error(`매물 없음: "${titleQuery}"`);
        process.exit(1);
    }
    const token = rows[0];
    console.log(`매물:       ${token.title}`);
    console.log(`listingId:  ${token.listingId}`);
    console.log(`tokenMint:  ${token.tokenMint ?? "(없음 — initialize 먼저 실행하세요)"}`);
    console.log(`totalSupply: ${token.totalSupply}`);
    console.log(`tokensSold:  ${token.tokensSold}`);
    console.log(`status:      ${token.status}\n`);

    if (!token.tokenMint) {
        console.error("tokenMint 없음. admin 대시보드에서 Initialize → Activate 먼저 실행하세요.");
        process.exit(1);
    }
    if (token.status !== "funding") {
        console.warn(`⚠ 현재 상태: ${token.status}. "funding" 상태여야 구매 가능합니다.`);
    }

    // 목표 tokensSold = totalSupply * targetPct / 100
    const targetSold = Math.floor(token.totalSupply * targetPct / 100);
    const remaining = targetSold - token.tokensSold;
    console.log(`목표 ${targetPct}%: ${targetSold} / ${token.totalSupply} 토큰`);
    if (remaining <= 0) {
        console.log(`이미 목표(${targetPct}%) 달성! (현재 ${token.tokensSold})`);
        process.exit(0);
    }
    const maxPerInvestor = Math.floor(token.totalSupply * 3 / 10); // 30% cap
    console.log(`구매할 토큰: ${remaining} 개 (인당 상한: ${maxPerInvestor})`);

    // 구매 청크 계산 (30% 캡 분배)
    const chunks: number[] = [];
    let left = remaining;
    while (left > 0) {
        const chunk = Math.min(left, maxPerInvestor);
        chunks.push(chunk);
        left -= chunk;
    }
    console.log(`투자자 수:  ${chunks.length} 명 (청크: ${chunks.join(", ")})`);
    const totalUsdcNeeded = remaining * token.pricePerTokenUsdc;
    console.log(`필요 USDC:  ${(totalUsdcNeeded / 1_000_000).toFixed(2)} USDC\n`);

    // ── 연결 + Anchor Program 로드 ────────────────────────────────────────────
    const connection = new Connection(RPC_URL, "confirmed");
    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf-8")
    );
    const programId = new PublicKey(programIdAddr);
    const usdcMint = new PublicKey(usdcMintAddr);
    const tokenMintPubkey = new PublicKey(token.tokenMint!);

    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(token.listingId)],
        programId
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(token.listingId)],
        programId
    );

    let totalPurchased = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunkAmount = chunks[i];
        console.log(`\n── 투자자 ${i + 1}/${chunks.length} (${chunkAmount} 토큰) ──`);

        // 투자자 키페어 로드 또는 생성
        const kpPath = path.join(__dirname, `investor-${i + 1}-keypair.json`);
        let investor: Keypair;
        if (fs.existsSync(kpPath)) {
            investor = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, "utf-8")))
            );
            console.log(`  키페어: ${investor.publicKey.toBase58()} (기존)`);
        } else {
            investor = Keypair.generate();
            fs.writeFileSync(kpPath, JSON.stringify(Array.from(investor.secretKey)), "utf-8");
            console.log(`  키페어: ${investor.publicKey.toBase58()} (신규)`);
        }

        // SOL 에어드롭
        const solBal = await connection.getBalance(investor.publicKey);
        if (solBal < 0.5 * 1_000_000_000) {
            const airdropSig = await connection.requestAirdrop(investor.publicKey, 2 * 1_000_000_000);
            await connection.confirmTransaction(airdropSig, "confirmed");
            console.log(`  SOL: 2 SOL airdrop`);
        }

        // USDC 민팅
        const chunkUsdc = chunkAmount * token.pricePerTokenUsdc + 1_000_000;
        const investorUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection, admin, usdcMint, investor.publicKey,
            false, "confirmed", undefined, TOKEN_PROGRAM_ID
        );
        await mintTo(
            connection, admin, usdcMint, investorUsdcAta.address,
            admin, chunkUsdc, [], undefined, TOKEN_PROGRAM_ID
        );
        console.log(`  USDC: ${(chunkUsdc / 1_000_000).toFixed(2)} minted`);

        // Provider (investor 서명)
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
                    .openPosition(token.listingId)
                    .accounts({ investor: investor.publicKey, propertyToken, investorPosition })
                    .instruction()
            );
        }

        const sig = await (program.methods as any)
            .purchaseTokens(token.listingId, new BN(chunkAmount))
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

        console.log(`  tx: ${sig}`);
        totalPurchased += chunkAmount;
    }

    // ── DB 업데이트 ────────────────────────────────────────────────────────────
    const newStatus = targetPct >= 100 ? "funded" : "funding";
    await db.update(rwaTokens)
        .set({
            tokensSold: targetSold,
            status: newStatus,
            updatedAt: new Date(),
        })
        .where(eq(rwaTokens.id, token.tokenId));

    console.log(`\n완료! ${token.title} ${targetPct}% 모집.`);
    console.log(`  purchased: ${totalPurchased} 토큰`);
    console.log(`  tokensSold: ${targetSold} / ${token.totalSupply}`);
    console.log(`  status: ${newStatus}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
