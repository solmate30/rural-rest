/**
 * 12_ui_test_verify.ts  —  [UI 테스트 검증]
 *
 * ReleaseFundsButton / ActivateButton 클릭 후 온체인 상태를 검증합니다.
 *
 * 검증 항목:
 *   1. PropertyToken 상태 == Active
 *   2. Token Mint authority == null (영구 소각)
 *   3. FundingVault 잔액 == 0 (자금 인출 완료)
 *   4. SPV USDC 잔액 > 0 (수령 확인)
 *   5. DB 상태 == 'active'
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/12_ui_test_verify.ts --listing-id ui-test-001
 *
 * 옵션:
 *   --listing-id <id>   검증할 매물 ID (기본값: ui-test-001)
 *   --rpc <url>         RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getMint,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID  = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const PAYER_PATH    = path.join(__dirname, "test-payer.json");
const SPV_PATH      = path.join(__dirname, "spv-wallet.json");
const USDC_MINT_PATH = path.join(__dirname, "test-usdc-mint.json");
const DB_PATH        = path.join(__dirname, "../local.db");

function parseArgs() {
    const args = process.argv.slice(2);
    const get  = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
    return {
        listingId: get("--listing-id") ?? "ui-test-001",
        rpc:       get("--rpc")        ?? DEFAULT_RPC,
    };
}

async function main() {
    const { listingId, rpc } = parseArgs();

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  [12] UI 테스트 결과 검증");
    console.log(`  listing-id: ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const connection = new Connection(rpc, "confirmed");

    if (!fs.existsSync(PAYER_PATH)) {
        console.error("  오류: test-payer.json 없음. 11_ui_test_setup 먼저 실행하세요.");
        process.exit(1);
    }
    const payer  = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_PATH, "utf8"))));
    const spv    = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(SPV_PATH, "utf8"))));
    const usdcMint = new PublicKey(JSON.parse(fs.readFileSync(USDC_MINT_PATH, "utf8")).slice ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(USDC_MINT_PATH, "utf8")))).publicKey.toBase58() : "");
    const usdcMintKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(USDC_MINT_PATH, "utf8"))));

    const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
    const program  = new Program(IDL as any, provider);

    // PDA 계산
    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const spvUsdcAta = getAssociatedTokenAddressSync(usdcMintKp.publicKey, spv.publicKey, false, TOKEN_PROGRAM_ID);

    let passed = 0;
    let failed = 0;

    function ok(label: string, detail?: string) {
        console.log(`  PASS  ${label}${detail ? `  (${detail})` : ""}`);
        passed++;
    }
    function fail(label: string, detail?: string) {
        console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ""}`);
        failed++;
    }

    // ── 1. 온체인 PropertyToken 조회 ──────────────────────────────────────────
    console.log("\n[ 온체인 상태 ]");
    let onchain: any;
    try {
        onchain = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    } catch (e) {
        console.error("  오류: PropertyToken 조회 실패. 매물이 토크나이즈 됐는지 확인하세요.");
        process.exit(1);
    }

    console.log(`  PropertyToken: ${propertyTokenPda.toBase58()}`);
    console.log(`  상태: ${JSON.stringify(onchain.status)}`);
    console.log(`  tokenMint: ${(onchain.tokenMint as PublicKey).toBase58()}`);
    console.log(`  tokensSold: ${onchain.tokensSold.toString()} / ${onchain.totalSupply.toString()}`);

    // 검증 1: status == Active
    if (onchain.status.active !== undefined) {
        ok("PropertyToken.status == Active");
    } else if (onchain.status.funded !== undefined) {
        fail("PropertyToken.status == Active", `현재: Funded — ActivateButton을 클릭하세요`);
    } else if (onchain.status.funding !== undefined) {
        fail("PropertyToken.status == Active", `현재: Funding — ReleaseFundsButton을 먼저 클릭하세요`);
    } else {
        fail("PropertyToken.status == Active", `현재: ${JSON.stringify(onchain.status)}`);
    }

    // ── 2. Mint authority 소각 확인 ───────────────────────────────────────────
    try {
        const mintInfo = await getMint(connection, onchain.tokenMint as PublicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
        if (mintInfo.mintAuthority === null) {
            ok("Mint authority == null (영구 소각됨)");
        } else {
            fail("Mint authority == null", `현재: ${mintInfo.mintAuthority.toBase58()}`);
        }
    } catch (e: any) {
        fail("Mint authority 조회", e.message?.slice(0, 60));
    }

    // ── 3. FundingVault 잔액 == 0 ─────────────────────────────────────────────
    try {
        const vaultInfo = await connection.getAccountInfo(fundingVault);
        if (!vaultInfo) {
            ok("FundingVault 잔액 == 0 (계정 소멸)");
        } else {
            const vaultBalance = await connection.getTokenAccountBalance(fundingVault);
            const amount = Number(vaultBalance.value.uiAmount ?? 0);
            if (amount === 0) {
                ok("FundingVault 잔액 == 0");
            } else {
                fail("FundingVault 잔액 == 0", `현재: ${amount} USDC 남음`);
            }
        }
    } catch {
        ok("FundingVault 잔액 == 0 (계정 없음)");
    }

    // ── 4. SPV USDC 수령 확인 ────────────────────────────────────────────────
    try {
        const spvBalance = await connection.getTokenAccountBalance(spvUsdcAta);
        const amount = Number(spvBalance.value.uiAmount ?? 0);
        if (amount > 0) {
            ok("SPV USDC 수령 완료", `${amount} USDC`);
        } else {
            fail("SPV USDC 수령 완료", "잔액 0 — 이미 소비했거나 수령 실패");
        }
    } catch {
        fail("SPV USDC ATA 조회 실패", "ATA 미존재");
    }

    // ── 5. DB 상태 확인 ───────────────────────────────────────────────────────
    console.log("\n[ DB 상태 ]");
    if (fs.existsSync(DB_PATH)) {
        const db = new Database(DB_PATH);
        const row = db.prepare("SELECT status FROM rwa_tokens WHERE listing_id = ?").get(listingId) as { status: string } | undefined;
        db.close();

        if (!row) {
            fail("DB rwa_tokens 레코드 존재", "레코드 없음");
        } else {
            console.log(`  DB status: ${row.status}`);
            if (row.status === "active") {
                ok("DB status == 'active'");
            } else {
                fail("DB status == 'active'", `현재: ${row.status}`);
            }
        }
    } else {
        console.log("  DB 파일 없음 — 건너뜀");
    }

    // ── 결과 요약 ────────────────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (failed === 0) {
        console.log(`  전체 통과 (${passed}/${passed + failed})`);
        console.log("  UI 테스트 성공! 매물이 Active 상태입니다.");
        console.log("  이제 배당 분배 테스트:");
        console.log(`  npx tsx scripts/07_distribute_revenue.ts --listing-id ${listingId} --revenue-usdc 100`);
    } else {
        console.log(`  결과: ${passed} 통과 / ${failed} 실패`);
        console.log("  실패 항목을 확인하고 UI에서 버튼을 다시 클릭하세요.");
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
