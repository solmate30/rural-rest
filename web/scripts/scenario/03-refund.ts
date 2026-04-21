/**
 * 03-refund.ts — 펀딩 실패 + 환불
 *
 * e2e002: deadline(8초) 경과 확인 후 refund 호출
 * → status=Failed, 투자자에게 USDC 반환 검증
 *
 * 실행: cd web && npx tsx scripts/scenario/03-refund.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { loadState, kp, pk } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL    = "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const USDC_MINT  = new PublicKey(process.env.VITE_USDC_MINT!);

const LISTING_FAIL = "e2e002";

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("=== [03] 펀딩 실패 + 환불 (e2e002) ===\n");

    const state    = loadState();
    const investor3 = kp(state.investor3);
    const connection = new Connection(RPC_URL, "confirmed");
    const provider   = new AnchorProvider(connection, new Wallet(investor3), { commitment: "confirmed" });
    const program    = new Program(IDL as any, provider);

    const pda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
    const pt2     = pda([Buffer.from("property"),     Buffer.from(LISTING_FAIL)]);
    const fv2     = pda([Buffer.from("funding_vault"), Buffer.from(LISTING_FAIL)]);
    const posFail = pda([Buffer.from("investor"), pt2.toBuffer(), investor3.publicKey.toBuffer()]);

    // e2e002의 deadline 확인 — validator 실제 clock으로 폴링
    const ptData  = await (program.account as any).propertyToken.fetch(pt2);
    const deadline = Number(ptData.fundingDeadline ?? ptData.funding_deadline);

    const getValidatorTime = async () => {
        const slot = await connection.getSlot("confirmed");
        return await connection.getBlockTime(slot);
    };

    let validatorNow = await getValidatorTime();
    console.log(`  deadline:     ${new Date(deadline * 1000).toISOString()}`);
    console.log(`  validator 현재: ${new Date((validatorNow ?? 0) * 1000).toISOString()}`);

    while ((validatorNow ?? 0) < deadline) {
        const remaining = deadline - (validatorNow ?? 0);
        console.log(`  대기 중... (${remaining}초 남음)`);
        await sleep(3000);
        validatorNow = await getValidatorTime();
    }
    console.log("  deadline 경과 확인");

    // investor3의 USDC ATA 조회 (02-invest에서 충전된 e2e002용)
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const inv3UsdcFail = getAssociatedTokenAddressSync(USDC_MINT, investor3.publicKey, false, TOKEN_PROGRAM_ID);

    const before = BigInt((await connection.getTokenAccountBalance(inv3UsdcFail)).value.amount);

    await (program.methods as any)
        .refund(LISTING_FAIL)
        .accounts({
            investor: investor3.publicKey,
            propertyToken: pt2,
            investorPosition: posFail,
            investorUsdcAccount: inv3UsdcFail,
            fundingVault: fv2,
            usdcMint: USDC_MINT,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    const after    = BigInt((await connection.getTokenAccountBalance(inv3UsdcFail)).value.amount);
    const refunded = Number(after - before);
    const ptAfter  = await (program.account as any).propertyToken.fetch(pt2);

    console.log(`  환불액:  ${refunded / 1_000_000} USDC  (expected: 5 USDC)`);
    console.log(`  status:  ${JSON.stringify(ptAfter.status)}  (expected: {failed:{}})`);

    if (!ptAfter.status.failed) throw new Error("status가 failed여야 합니다");
    if (refunded !== 5 * 1_000_000) throw new Error(`환불액 불일치: ${refunded}`);

    console.log("\n  환불 검증 완료");
    console.log("\n다음: npx tsx scripts/scenario/04-activate.ts  (e2e001 60초 deadline 경과 후)");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
