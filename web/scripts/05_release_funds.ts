/**
 * 05_release_funds.ts  —  [STEP 5]
 *
 * 펀딩이 완료된 매물의 에스크로(funding_vault)에서 SPV 지갑으로 USDC를 이체합니다.
 * 온체인 PropertyStatus 가 Funded 상태로 전환됩니다.
 * DB 상태도 funding → funded 로 업데이트됩니다.
 *
 * 온체인 조건 (둘 중 하나 충족):
 *   A. 완판 (tokens_sold == total_supply)
 *   B. 데드라인 경과 + 최소모집률 달성 (tokens_sold >= total_supply * min_funding_bps / 10000)
 *
 * 전제조건:
 *   - STEP 4 완료 후 펀딩 조건이 충족되어야 합니다.
 *   - scripts/spv-wallet.json 이 authority 키페어여야 합니다.
 *     (tokenize 시 해당 SPV 키페어가 authority로 설정되어 있어야 함)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/05_release_funds.ts --listing-id test-rwa-002
 *
 * 옵션:
 *   --listing-id <id>   자금 해제할 매물 ID (필수)
 *   --rpc <url>         RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount,
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

const DEFAULT_RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
    process.env.VITE_RWA_PROGRAM_ID ?? "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR"
);
const SPV_KEYPAIR_PATH = path.join(__dirname, "spv-wallet.json");
const DB_PATH          = path.join(__dirname, "../local.db");

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return {
        listingId: get("--listing-id") ?? null,
        rpc: get("--rpc") ?? DEFAULT_RPC,
    };
}

async function main() {
    const { listingId, rpc } = parseArgs();
    if (!listingId) {
        console.error("Usage: npx tsx scripts/05_release_funds.ts --listing-id <id>");
        process.exit(1);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [STEP 5] release_funds — ${listingId}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // SPV 키페어 로드 (authority = 자금 수령 주체)
    if (!fs.existsSync(SPV_KEYPAIR_PATH)) {
        console.error("  오류: spv-wallet.json 이 없습니다.");
        console.error("  solana-keygen new --outfile scripts/spv-wallet.json --no-bip39-passphrase");
        process.exit(1);
    }
    const authority = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(SPV_KEYPAIR_PATH, "utf8")))
    );
    console.log(`  SPV(authority): ${authority.publicKey.toBase58()}`);

    const connection = new Connection(rpc, "confirmed");

    // SOL 잔액 확인 (수수료용)
    const sol = await connection.getBalance(authority.publicKey);
    if (sol < 0.1 * LAMPORTS_PER_SOL) {
        console.log("  SOL 부족 — 에어드롭 중...");
        const sig = await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
    }

    // Anchor 프로그램 연결
    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const program = new Program(IDL as any, provider);

    // 온체인 PropertyToken 조회
    console.log("\n[ 1 ] 온체인 상태 확인");
    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    const onchain: any = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    const usdcMint = onchain.usdcMint as PublicKey;
    const tokensSold = Number(onchain.tokensSold.toString());
    const totalSupply = Number(onchain.totalSupply.toString());
    const fundingDeadline = Number(onchain.fundingDeadline.toString());
    const now = Math.floor(Date.now() / 1000);

    console.log(`  상태: ${JSON.stringify(onchain.status)}`);
    console.log(`  모집률: ${((tokensSold / totalSupply) * 100).toFixed(1)}%`);
    console.log(`  데드라인: ${new Date(fundingDeadline * 1000).toLocaleString("ko-KR")}`);
    console.log(`  현재 시각: ${new Date(now * 1000).toLocaleString("ko-KR")}`);

    const isSoldOut = tokensSold === totalSupply;
    const deadlinePassed = now > fundingDeadline;
    if (!isSoldOut && !deadlinePassed) {
        console.error("\n  오류: 완판도 아니고 데드라인도 지나지 않았습니다.");
        console.error(`  데드라인까지 ${Math.ceil((fundingDeadline - now) / 60)}분 남았습니다.`);
        process.exit(1);
    }

    // funding_vault PDA
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    // authority USDC ATA (없으면 생성)
    console.log("\n[ 2 ] authority USDC ATA 준비");
    const authorityUsdcAccount = await getOrCreateAssociatedTokenAccount(
        connection, authority, usdcMint, authority.publicKey,
        false, undefined, undefined, TOKEN_PROGRAM_ID
    );
    console.log(`  ATA: ${authorityUsdcAccount.address.toBase58()}`);

    const vaultBalance = await connection.getTokenAccountBalance(fundingVault);
    console.log(`  funding_vault 잔액: ${vaultBalance.value.uiAmount} USDC`);

    // release_funds 호출
    console.log("\n[ 3 ] release_funds 트랜잭션 전송");
    const sig = await (program.methods as any)
        .releaseFunds(listingId)
        .accounts({
            propertyToken: propertyTokenPda,
            authority: authority.publicKey,
            fundingVault,
            authorityUsdcAccount: authorityUsdcAccount.address,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    console.log(`  TX: ${sig}`);

    // DB 상태 업데이트
    console.log("\n[ 4 ] DB 상태 업데이트 (funding → funded)");
    const db = new Database(DB_PATH);
    const result = db.prepare(
        "UPDATE rwa_tokens SET status = 'funded', updated_at = strftime('%s','now') WHERE listing_id = ?"
    ).run(listingId);
    db.close();

    if (result.changes === 0) {
        console.warn("  경고: DB 레코드를 찾을 수 없습니다.");
    } else {
        console.log("  DB status → funded");
    }

    const spvBalance = await connection.getTokenAccountBalance(authorityUsdcAccount.address);
    console.log(`\n  SPV 지갑 USDC 잔액: ${spvBalance.value.uiAmount} USDC`);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  완료! 매물이 Funded 상태로 전환됐습니다.");
    console.log("  다음: npx tsx scripts/06_activate_property.ts --listing-id " + listingId);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
