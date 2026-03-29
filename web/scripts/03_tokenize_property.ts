/**
 * 03_tokenize_property.ts  —  [STEP 3]
 *
 * DB에 등록된 매물을 온체인에서 토크나이즈(initialize_property)합니다.
 * scripts/spv-wallet.json 이 authority(자금 수령 주체 + 수익 분배 주체)로 등록됩니다.
 * UI admin/tokenize 페이지를 대신합니다.
 *
 * 전제조건:
 *   - STEP 1: scripts/spv-wallet.json 존재 (01_generate_keypairs.ts로 생성)
 *   - STEP 2: USDC 민트 생성 완료, VITE_USDC_MINT가 web/.env에 설정됨
 *   - STEP 2 --fund-spv: SPV 지갑에 SOL 잔액 있어야 수수료 지불 가능
 *   - DB에 해당 listing_id의 rwa_tokens 레코드 존재
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/03_tokenize_property.ts --listing-id gangreung-001
 *
 * 옵션:
 *   --listing-id <id>      토크나이즈할 매물 ID (필수)
 *   --valuation <krw>      감정가 KRW (기본값: 135000)
 *   --min-funding <bps>    최소 모집률 bps (기본값: 6000 = 60%)
 *   --deadline-min <n>     펀딩 데드라인 (지금부터 N분, 기본값: 60)
 *   --rpc <url>            RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);

// ── 설정 ─────────────────────────────────────────────────────────────────────

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const TOTAL_SUPPLY = 100_000_000;
const KRW_PER_USDC = 1350;

const PAYER_PATH     = path.join(__dirname, "test-payer.json");
const SPV_PATH       = path.join(__dirname, "spv-wallet.json");
const USDC_MINT_PATH = path.join(__dirname, "test-usdc-mint.json");
const DB_PATH        = path.join(__dirname, "../local.db");

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId:   get("--listing-id") ?? null,
        valuation:   parseInt(get("--valuation")    ?? "135000"),
        minFunding:  parseInt(get("--min-funding")  ?? "6000"),
        deadlineMin: parseInt(get("--deadline-min") ?? "60"),
        rpc:         get("--rpc") ?? DEFAULT_RPC,
    };
}

function loadKeypair(filePath: string, label: string): Keypair {
    if (!fs.existsSync(filePath)) {
        console.error(`  오류: ${label} 키페어 파일이 없습니다: ${filePath}`);
        console.error("  먼저 --setup 을 실행하세요: npx tsx scripts/localnet-bulk-invest.ts --setup");
        process.exit(1);
    }
    return Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
    );
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function tokenize() {
    const { listingId, valuation: valuationKrw, minFunding: minFundingBps, deadlineMin, rpc } = parseArgs();

    if (!listingId) {
        console.error("Usage: npx tsx scripts/localnet-tokenize.ts --listing-id <id>");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Tokenize] ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const connection = new Connection(rpc, "confirmed");
    const payer      = loadKeypair(PAYER_PATH, "payer");
    const spv        = loadKeypair(SPV_PATH, "spv-wallet");
    const usdcMintKp = loadKeypair(USDC_MINT_PATH, "usdc-mint");
    const usdcMint   = usdcMintKp.publicKey;
    const mintKeypair = Keypair.generate(); // 새 RWA 토큰 민트 keypair

    // DB 조회
    const db = new Database(DB_PATH);
    const row = db.prepare("SELECT id FROM rwa_tokens WHERE listing_id = ?").get(listingId) as { id: string } | undefined;
    if (!row) {
        console.error(`  오류: DB에 listing_id="${listingId}"인 rwa_tokens 레코드가 없습니다.`);
        console.error("  admin/tokenize 페이지에서 매물을 먼저 등록하세요.");
        process.exit(1);
    }

    // SOL 에어드롭 (잔액 부족 시)
    const payerBalance = await connection.getBalance(payer.publicKey);
    if (payerBalance < 2 * LAMPORTS_PER_SOL) {
        process.stdout.write("  payer SOL 충전 중...");
        const sig = await connection.requestAirdrop(payer.publicKey, 5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log(" 완료");
    }
    const spvBalance = await connection.getBalance(spv.publicKey);
    if (spvBalance < 0.5 * LAMPORTS_PER_SOL) {
        process.stdout.write("  SPV SOL 충전 중...");
        const sig = await connection.requestAirdrop(spv.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log(" 완료");
    }

    // 파라미터 계산
    const pricePerTokenUsdc = Math.max(1, Math.round(
        (valuationKrw / TOTAL_SUPPLY) / KRW_PER_USDC * 1_000_000
    ));
    const fundingDeadlineTs = Math.floor(Date.now() / 1000) + deadlineMin * 60;

    // 연간 수익률 계산 (참고용)
    const apyBps = Math.round(
        (valuationKrw > 0
            ? ((/* pricePerNight 추정 */ valuationKrw * 0.003) * 365 * 0.55 * 0.55 * 0.30) / valuationKrw
            : 0) * 10000
    );

    console.log(`\n  listingId:        ${listingId}`);
    console.log(`  authority (SPV):  ${spv.publicKey.toBase58()}`);
    console.log(`  tokenMint:        ${mintKeypair.publicKey.toBase58()}`);
    console.log(`  valuationKrw:     ₩${valuationKrw.toLocaleString()}`);
    console.log(`  pricePerToken:    ${pricePerTokenUsdc} micro-USDC`);
    console.log(`  minFundingBps:    ${minFundingBps} (${minFundingBps / 100}%)`);
    console.log(`  deadline:         ${deadlineMin}분 후`);
    console.log(`  est. APY:         ${(apyBps / 100).toFixed(1)}%`);

    // PDAs
    const [propertyToken] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const usdcVault = getAssociatedTokenAddressSync(
        usdcMint, propertyToken, true, TOKEN_PROGRAM_ID
    );

    // Anchor 트랜잭션
    // payer: 수수료 지불 / spv: authority 서명 / mintKeypair: 새 토큰 민트 서명
    const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
    const program  = new Program(IDL as any, provider);

    console.log("\n[ 1 ] initialize_property 트랜잭션 전송 중...");
    const sig = await program.methods
        .initializeProperty(
            listingId,
            new BN(TOTAL_SUPPLY),
            new BN(valuationKrw),
            new BN(pricePerTokenUsdc),
            new BN(fundingDeadlineTs),
            minFundingBps,
        )
        .accounts({
            authority:        spv.publicKey,   // SPV가 authority (자금 수령 + 수익 분배 주체)
            propertyToken,
            tokenMint:        mintKeypair.publicKey,
            fundingVault,
            usdcVault,
            usdcMint,
            tokenProgram:     TOKEN_2022_PROGRAM_ID,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([mintKeypair, spv])   // mintKeypair + spv 모두 서명
        .rpc();
    console.log(`  tx: ${sig}`);

    // DB 업데이트
    console.log("\n[ 2 ] DB 업데이트...");
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
        UPDATE rwa_tokens SET
            token_mint         = ?,
            total_supply       = ?,
            valuation_krw      = ?,
            price_per_token_usdc = ?,
            estimated_apy_bps  = ?,
            status             = 'funding',
            min_funding_bps    = ?,
            funding_deadline   = ?,
            tokens_sold        = 0,
            updated_at         = ?
        WHERE listing_id = ?
    `).run(
        mintKeypair.publicKey.toBase58(),
        TOTAL_SUPPLY,
        valuationKrw,
        pricePerTokenUsdc,
        apyBps,
        minFundingBps,
        fundingDeadlineTs,
        now,
        listingId
    );

    console.log("  token_mint:   " + mintKeypair.publicKey.toBase58());
    console.log("  status:       funding");
    console.log("  tokens_sold:  0");

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 다음 단계:");
    console.log(`  npx tsx scripts/04_invest.ts --listing-id ${listingId} --count 5`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

tokenize().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
