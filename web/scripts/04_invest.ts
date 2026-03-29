/**
 * 04_invest.ts  —  [STEP 4]
 *
 * N명의 테스트 투자자를 자동 생성하고 RWA 토큰을 구매합니다.
 * 각 투자자 키페어는 scripts/bulk-investor-{n}.json에 저장되어
 * 이후 08_claim_dividend.ts에서 재사용합니다.
 *
 * 전제조건:
 *   - STEP 3 완료 (매물이 온체인에서 Funding 상태)
 *   - USDC 민트(test-usdc-mint.json)가 존재해야 투자자에게 USDC 충전 가능
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/04_invest.ts --listing-id gangreung-001 --count 5
 *
 * 옵션:
 *   --listing-id <id>  투자 대상 매물 ID (필수)
 *   --count <n>        생성할 투자자 수 (기본값: 5)
 *   --rpc <url>        RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const PAYER_PATH = path.join(__dirname, "test-payer.json");
const USDC_MINT_KEYPAIR_PATH = path.join(__dirname, "test-usdc-mint.json");
const DB_PATH = path.join(__dirname, "../local.db");

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId: get("--listing-id") ?? null,
        count: parseInt(get("--count") ?? "5"),
        rpc: get("--rpc") ?? DEFAULT_RPC,
    };
}

function loadKeypair(filePath: string, label: string): Keypair {
    if (!fs.existsSync(filePath)) {
        console.error(`  오류: ${label} 파일이 없습니다: ${filePath}`);
        process.exit(1);
    }
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
    );
}

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}

async function main() {
    const { listingId, count, rpc } = parseArgs();
    if (!listingId) {
        console.error("Usage: npx tsx scripts/04_invest.ts --listing-id <id> [--count 5]");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 4] 투자자 ${count}명 자동 구매 — ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fs.existsSync(USDC_MINT_KEYPAIR_PATH)) {
        console.error("  오류: test-usdc-mint.json이 없습니다. STEP 2를 먼저 실행하세요.");
        process.exit(1);
    }

    const connection = new Connection(rpc, "confirmed");
    const payer = loadKeypair(PAYER_PATH, "payer");
    const usdcMintKeypair = loadKeypair(USDC_MINT_KEYPAIR_PATH, "usdc-mint");
    const usdcMint = usdcMintKeypair.publicKey;

    // 온체인 PropertyToken 조회
    console.log("\n[ 1 ] 온체인 PropertyToken 조회");
    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
    const program = new Program(IDL as any, provider);

    let onchain: any;
    try {
        onchain = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    } catch {
        console.error("  오류: 온체인 PropertyToken을 찾을 수 없습니다. STEP 3을 먼저 실행하세요.");
        process.exit(1);
    }

    const tokenMint = onchain.tokenMint as PublicKey;
    const pricePerTokenUsdc = BigInt(onchain.pricePerTokenUsdc.toString());
    const totalSupply = BigInt(onchain.totalSupply.toString());
    const maxPerInvestor = totalSupply * 3n / 10n; // 30% 상한

    console.log(`  tokenMint:    ${tokenMint.toBase58()}`);
    console.log(`  price/token:  ${pricePerTokenUsdc} micro-USDC`);
    console.log(`  total_supply: ${totalSupply}`);
    console.log(`  max/investor: ${maxPerInvestor} tokens (30% cap)`);

    // DB 연결
    const db = new Database(DB_PATH);
    const rwaTokenRow = db.prepare(
        "SELECT id FROM rwa_tokens WHERE listing_id = ?"
    ).get(listingId) as { id: string } | undefined;

    if (!rwaTokenRow) {
        console.error("  오류: DB에 rwa_tokens 레코드가 없습니다. STEP 3을 완료하세요.");
        process.exit(1);
    }
    const rwaTokenId = rwaTokenRow.id;

    // payer SOL 보충
    const payerBalance = await connection.getBalance(payer.publicKey);
    if (payerBalance < 3 * LAMPORTS_PER_SOL) {
        process.stdout.write("  payer SOL 보충 중...");
        await airdrop(connection, payer.publicKey, 5);
        console.log(" 완료");
    }

    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    const insertInvestment = db.prepare(`
        INSERT OR IGNORE INTO rwa_investments
            (id, wallet_address, rwa_token_id, token_amount, invested_usdc, purchase_tx, created_at)
        VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))
    `);
    const updateTokensSold = db.prepare(`
        UPDATE rwa_tokens SET tokens_sold = tokens_sold + ?, updated_at = strftime('%s','now')
        WHERE id = ?
    `);

    console.log(`\n[ 2 ] 투자자 ${count}명 생성 및 구매`);

    let successCount = 0;
    for (let i = 0; i < count; i++) {
        // 기존 투자자 키페어 재사용 또는 신규 생성
        const investorPath = path.join(__dirname, `bulk-investor-${i}.json`);
        let investor: Keypair;
        if (fs.existsSync(investorPath)) {
            investor = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(investorPath, "utf8")))
            );
            process.stdout.write(`\n  [${i + 1}/${count}] [재사용] ${investor.publicKey.toBase58().slice(0, 16)}...`);
        } else {
            investor = Keypair.generate();
            fs.writeFileSync(investorPath, JSON.stringify(Array.from(investor.secretKey)));
            process.stdout.write(`\n  [${i + 1}/${count}] [신규] ${investor.publicKey.toBase58().slice(0, 16)}...`);
        }

        // SOL 에어드롭
        const sol = await connection.getBalance(investor.publicKey);
        if (sol < 0.1 * LAMPORTS_PER_SOL) {
            await airdrop(connection, investor.publicKey, 1);
        }

        // 잔여 토큰 확인
        const freshOnchain = await (program.account as any).propertyToken.fetch(propertyTokenPda);
        const tokensSold = BigInt(freshOnchain.tokensSold.toString());
        const available = totalSupply - tokensSold;
        if (available === 0n) {
            console.log(`\n  완판됨 — 더 이상 구매 불가`);
            break;
        }
        const buyAmount = available < maxPerInvestor ? available : maxPerInvestor;

        // USDC ATA 생성 + 민팅
        const investorUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection, payer, usdcMint, investor.publicKey,
            false, undefined, undefined, TOKEN_PROGRAM_ID
        );
        const usdcNeeded = pricePerTokenUsdc * buyAmount;
        await mintTo(
            connection, payer, usdcMint, investorUsdcAta.address,
            payer, usdcNeeded, [], undefined, TOKEN_PROGRAM_ID
        );

        // RWA ATA 주소 계산
        const investorRwaAta = getAssociatedTokenAddressSync(
            tokenMint, investor.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        // investor_position PDA
        const [investorPosition] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyTokenPda.toBuffer(), investor.publicKey.toBuffer()],
            PROGRAM_ID
        );

        const investorProvider = new AnchorProvider(
            connection,
            new Wallet(investor),
            { commitment: "confirmed" }
        );
        const investorProgram = new Program(IDL as any, investorProvider);

        try {
            // open_position (포지션 PDA 생성 — purchase_tokens 전에 반드시 필요)
            await investorProgram.methods
                .openPosition(listingId)
                .accounts({
                    investor: investor.publicKey,
                    propertyToken: propertyTokenPda,
                    investorPosition,
                })
                .rpc();

            // purchase_tokens
            const createRwaAtaIx = createAssociatedTokenAccountIdempotentInstruction(
                investor.publicKey, investorRwaAta, investor.publicKey,
                tokenMint, TOKEN_2022_PROGRAM_ID
            );

            const sig = await investorProgram.methods
                .purchaseTokens(listingId, new BN(buyAmount.toString()))
                .accounts({
                    investor: investor.publicKey,
                    propertyToken: propertyTokenPda,
                    tokenMint,
                    investorPosition,
                    investorUsdcAccount: investorUsdcAta.address,
                    fundingVault,
                    investorRwaAccount: investorRwaAta,
                    usdcMint,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                })
                .preInstructions([createRwaAtaIx])
                .rpc();

            // DB 기록
            insertInvestment.run(uuidv4(), investor.publicKey.toBase58(), rwaTokenId, Number(buyAmount), Number(usdcNeeded), sig);
            updateTokensSold.run(Number(buyAmount), rwaTokenId);

            process.stdout.write(` 완료 (${sig.slice(0, 8)}...)\n`);
            successCount++;
        } catch (err: any) {
            process.stdout.write(` 실패: ${err.message?.slice(0, 80)}\n`);
        }
    }

    db.close();

    const finalOnchain = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const finalSold = Number(finalOnchain.tokensSold.toString());
    const soldPct = (finalSold / Number(totalSupply)) * 100;

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  완료! 성공: ${successCount}명 / 요청: ${count}명`);
    console.log(`  현재 모집률: ${soldPct.toFixed(1)}%`);
    if (soldPct >= 100) {
        console.log("  완판! 바로 release_funds 실행 가능합니다.");
    } else if (soldPct >= 60) {
        console.log("  60% 달성! 데드라인 경과 후 release_funds 실행 가능합니다.");
    } else {
        console.log(`  60% 목표까지 ${(60 - soldPct).toFixed(1)}% 부족합니다.`);
    }
    console.log("  다음: npx tsx scripts/05_release_funds.ts --listing-id " + listingId);
    console.log("특정 투자자 취소");
    console.log("npx tsx scripts/04b_cancel_position.ts --listing-id gangreung-001 --investor-index 0");
    console.log("전체 일괄 취소");
    console.log("npx tsx scripts/04b_cancel_position.ts --listing-id gangreung-001 --all");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
