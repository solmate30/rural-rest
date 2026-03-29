/**
 * 00_seed_listing.ts  —  [STEP 0-B]
 *
 * RWA 테스트에 필요한 DB 레코드를 생성합니다.
 *   1. 테스트 호스트 유저 (SPV 역할)
 *   2. listings 레코드
 *   3. rwa_tokens 레코드 (온체인 초기화 전 상태)
 *
 * 이미 존재하는 레코드는 건너뜁니다 (재실행 안전).
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/00_seed_listing.ts --listing-id gangreung-001
 *
 * 옵션:
 *   --listing-id <id>    listing ID (필수, 영문+숫자+하이픈)
 *   --title <text>       매물 이름 (기본값: "테스트 강릉 고택")
 *   --valuation <krw>    감정가 KRW (기본값: 135000)
 *   --price <krw>        1박 가격 KRW (기본값: 150000)
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../local.db");
const PROGRAM_ID = process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR";

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId: get("--listing-id") ?? null,
        title: get("--title") ?? "테스트 강릉 고택",
        valuation: parseInt(get("--valuation") ?? "1350000"),
        price: parseInt(get("--price") ?? "150000"),
    };
}

async function main() {
    const { listingId, title, valuation, price } = parseArgs();
    if (!listingId) {
        console.error("Usage: npx tsx scripts/00_seed_listing.ts --listing-id <id>");
        process.exit(1);
    }

    if (!fs.existsSync(DB_PATH)) {
        console.error(`  오류: DB 파일이 없습니다: ${DB_PATH}`);
        console.error("  npm run dev 를 한 번 실행하면 DB가 초기화됩니다.");
        process.exit(1);
    }

    const db = new Database(DB_PATH);
    const now = Math.floor(Date.now() / 1000);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Seed Listing] ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ── 1. 테스트 호스트 유저 ──────────────────────────────────────────────────
    const HOST_EMAIL = "test-spv-host@rural-rest.local";
    let hostRow = db.prepare("SELECT id FROM user WHERE email = ?").get(HOST_EMAIL) as { id: string } | undefined;

    if (hostRow) {
        console.log(`\n  [재사용] 호스트 유저: ${hostRow.id}`);
    } else {
        const hostId = uuidv4();
        db.prepare(`
            INSERT INTO user (id, name, email, email_verified, role, preferred_lang, kyc_verified, created_at, updated_at)
            VALUES (?, ?, ?, 1, 'host', 'ko', 1, ?, ?)
        `).run(hostId, "테스트 SPV 호스트", HOST_EMAIL, now, now);
        hostRow = { id: hostId };
        console.log(`\n  [신규] 호스트 유저: ${hostId}`);
    }

    // ── 2. listings 레코드 ────────────────────────────────────────────────────
    const existingListing = db.prepare("SELECT id FROM listings WHERE id = ?").get(listingId);

    if (existingListing) {
        console.log(`  [재사용] listings: ${listingId}`);
    } else {
        db.prepare(`
            INSERT INTO listings (
                id, host_id, title, description,
                price_per_night, valuation_krw, max_guests,
                location, region, amenities, images,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            listingId,
            hostRow.id,
            title,
            "RWA 테스트용 매물입니다. 강릉 지역 리노베이션 고택.",
            price,
            valuation,
            4,
            "강원도 강릉시",
            "강원",
            JSON.stringify(["wifi", "parking", "kitchen"]),
            JSON.stringify([]),
            now
        );
        console.log(`  [신규] listings: ${listingId}`);
    }

    // ── 3. rwa_tokens 레코드 ─────────────────────────────────────────────────
    const existingToken = db.prepare("SELECT id FROM rwa_tokens WHERE listing_id = ?").get(listingId);

    if (existingToken) {
        console.log(`  [재사용] rwa_tokens: listing_id=${listingId}`);
    } else {
        const tokenId = uuidv4();
        const totalSupply = 100_000_000;
        const KRW_PER_USDC = 1350;
        const pricePerTokenUsdc = Math.max(1, Math.round((valuation / totalSupply) / KRW_PER_USDC * 1_000_000));
        const fundingDeadline = now + 60 * 60; // 1시간 후 (02_tokenize_property에서 덮어씀)

        db.prepare(`
            INSERT INTO rwa_tokens (
                id, listing_id, symbol, total_supply, tokens_sold,
                valuation_krw, price_per_token_usdc,
                status, funding_deadline, estimated_apy_bps,
                min_funding_bps, program_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, ?, 'funding', ?, 0, 6000, ?, ?, ?)
        `).run(
            tokenId, listingId, `RURAL-${listingId}`, totalSupply,
            valuation, pricePerTokenUsdc,
            fundingDeadline, PROGRAM_ID, now, now
        );
        console.log(`  [신규] rwa_tokens: id=${tokenId}`);
        console.log(`         price_per_token: ${pricePerTokenUsdc} micro-USDC`);
    }

    db.close();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 이제 STEP 1 → STEP 2 → STEP 3 순으로 진행하세요:");
    console.log("  npx tsx scripts/01_generate_keypairs.ts");
    console.log("  npx tsx scripts/02_setup_localnet.ts --setup");
    console.log(`  npx tsx scripts/03_tokenize_property.ts --listing-id ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
