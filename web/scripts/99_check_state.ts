/**
 * 99_check_state.ts  —  [진단 도구]
 *
 * 언제든지 실행해서 온체인 상태를 확인합니다.
 * - PropertyToken 전체 상태 출력
 * - bulk-investor-*.json 자동 감지 후 각 포지션 + 미청구 배당금 출력
 * - 지자체/운영자 USDC 잔액 출력
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/99_check_state.ts --listing-id gangreung-001
 *   npx tsx scripts/99_check_state.ts --listing-id gangreung-001 --rpc https://api.devnet.solana.com
 *
 * 옵션:
 *   --listing-id <id>  조회할 매물 ID (필수)
 *   --rpc <url>        RPC 엔드포인트 (기본값: http://127.0.0.1:8899, 데브넷도 지원)
 */

import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
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

function loadKeypairIfExists(filePath: string): Keypair | null {
    if (!fs.existsSync(filePath)) return null;
    try {
        return Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(filePath, "utf8")))
        );
    } catch {
        return null;
    }
}

function statusLabel(status: any): string {
    if (status.funding) return "Funding";
    if (status.funded)  return "Funded";
    if (status.active)  return "Active";
    if (status.failed)  return "Failed";
    return JSON.stringify(status);
}

async function main() {
    const { listingId, rpc } = parseArgs();
    if (!listingId) {
        console.error("Usage: npx tsx scripts/99_check_state.ts --listing-id <id>");
        process.exit(1);
    }

    const connection = new Connection(rpc, "confirmed");
    const dummyKeypair = Keypair.generate();
    const provider = new AnchorProvider(connection, new Wallet(dummyKeypair), { commitment: "confirmed" });
    const program = new Program(IDL as any, provider);

    const [propertyTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        PROGRAM_ID
    );

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  [Check State] ${listingId}`);
    console.log(`  RPC: ${rpc}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ── PropertyToken 온체인 상태 ──────────────────────────────────────────────
    let onchain: any;
    try {
        onchain = await (program.account as any).propertyToken.fetch(propertyTokenPda);
    } catch {
        console.error(`\n  오류: PropertyToken을 찾을 수 없습니다.`);
        console.error(`  PDA: ${propertyTokenPda.toBase58()}`);
        console.error("  STEP 2(tokenize)를 먼저 실행하세요.");
        process.exit(1);
    }

    const totalSupply = BigInt(onchain.totalSupply.toString());
    const tokensSold = BigInt(onchain.tokensSold.toString());
    const fundingPct = totalSupply > 0n ? Number(tokensSold * 10000n / totalSupply) / 100 : 0;
    const deadline = new Date(Number(onchain.fundingDeadline.toString()) * 1000);
    const accDps = BigInt(onchain.accDividendPerShare.toString());
    const PRECISION = 1_000_000_000_000n;

    console.log("\n  ── PropertyToken ──────────────────────────");
    console.log(`  PDA:              ${propertyTokenPda.toBase58()}`);
    console.log(`  authority:        ${onchain.authority.toBase58()}`);
    console.log(`  token_mint:       ${onchain.tokenMint.toBase58()}`);
    console.log(`  usdc_mint:        ${onchain.usdcMint.toBase58()}`);
    console.log(`  status:           ${statusLabel(onchain.status)}`);
    console.log(`  total_supply:     ${totalSupply.toLocaleString()}`);
    console.log(`  tokens_sold:      ${tokensSold.toLocaleString()} (${fundingPct.toFixed(1)}%)`);
    console.log(`  min_funding_bps:  ${onchain.minFundingBps} (${onchain.minFundingBps / 100}%)`);
    console.log(`  funding_deadline: ${deadline.toLocaleString("ko-KR")}`);
    console.log(`  funds_released:   ${onchain.fundsReleased}`);
    console.log(`  acc_dividend/share: ${accDps} (${Number(accDps * 1_000_000n / PRECISION) / 1_000_000} USDC/token 누적)`);

    // usdc_vault 잔액
    const usdcVault = getAssociatedTokenAddressSync(
        onchain.usdcMint, propertyTokenPda, true, TOKEN_PROGRAM_ID
    );
    try {
        const vaultBalance = await connection.getTokenAccountBalance(usdcVault);
        console.log(`  usdc_vault:       ${vaultBalance.value.uiAmount} USDC (배당 풀)`);
    } catch {
        console.log(`  usdc_vault:       (미생성 또는 잔액 없음)`);
    }

    // funding_vault 잔액
    const [fundingVault] = PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        PROGRAM_ID
    );
    try {
        const fvBalance = await connection.getTokenAccountBalance(fundingVault);
        console.log(`  funding_vault:    ${fvBalance.value.uiAmount} USDC (에스크로)`);
    } catch {
        console.log(`  funding_vault:    (비어있음 또는 해제됨)`);
    }

    // ── SPV 지갑 잔액 ──────────────────────────────────────────────────────────
    const spv = loadKeypairIfExists(path.join(__dirname, "spv-wallet.json"));
    if (spv) {
        console.log("\n  ── 관련 지갑 잔액 ─────────────────────────");
        try {
            const spvUsdcAta = getAssociatedTokenAddressSync(
                onchain.usdcMint, spv.publicKey, false, TOKEN_PROGRAM_ID
            );
            const spvBalance = await connection.getTokenAccountBalance(spvUsdcAta);
            console.log(`  SPV:              ${spv.publicKey.toBase58().slice(0, 16)}... ${spvBalance.value.uiAmount} USDC`);
        } catch {
            console.log(`  SPV:              ${spv.publicKey.toBase58().slice(0, 16)}... (USDC ATA 없음)`);
        }
    }

    const govt = loadKeypairIfExists(path.join(__dirname, "government-wallet.json"));
    if (govt) {
        try {
            const govtUsdcAta = getAssociatedTokenAddressSync(
                onchain.usdcMint, govt.publicKey, false, TOKEN_PROGRAM_ID
            );
            const govtBalance = await connection.getTokenAccountBalance(govtUsdcAta);
            console.log(`  지자체:            ${govt.publicKey.toBase58().slice(0, 16)}... ${govtBalance.value.uiAmount} USDC`);
        } catch {
            console.log(`  지자체:            ${govt.publicKey.toBase58().slice(0, 16)}... (USDC ATA 없음)`);
        }
    }

    const operator = loadKeypairIfExists(path.join(__dirname, "village-operator-wallet.json"));
    if (operator) {
        try {
            const operatorUsdcAta = getAssociatedTokenAddressSync(
                onchain.usdcMint, operator.publicKey, false, TOKEN_PROGRAM_ID
            );
            const operatorBalance = await connection.getTokenAccountBalance(operatorUsdcAta);
            console.log(`  마을운영자:         ${operator.publicKey.toBase58().slice(0, 16)}... ${operatorBalance.value.uiAmount} USDC`);
        } catch {
            console.log(`  마을운영자:         ${operator.publicKey.toBase58().slice(0, 16)}... (USDC ATA 없음)`);
        }
    }

    // ── 투자자 포지션 ──────────────────────────────────────────────────────────
    const investorFiles: { idx: number; kp: Keypair }[] = [];
    let i = 0;
    while (true) {
        const kp = loadKeypairIfExists(path.join(__dirname, `bulk-investor-${i}.json`));
        if (!kp) break;
        investorFiles.push({ idx: i, kp });
        i++;
    }

    if (investorFiles.length > 0) {
        console.log(`\n  ── 투자자 포지션 (${investorFiles.length}명) ─────────────────`);
        for (const { idx, kp } of investorFiles) {
            const [investorPosition] = PublicKey.findProgramAddressSync(
                [Buffer.from("investor"), propertyTokenPda.toBuffer(), kp.publicKey.toBuffer()],
                PROGRAM_ID
            );

            try {
                const pos: any = await (program.account as any).investorPosition.fetch(investorPosition);
                const amount = BigInt(pos.amount.toString());
                const rewardDebt = BigInt(pos.rewardDebt.toString());
                const gross = amount * accDps / PRECISION;
                const pending = gross > rewardDebt ? gross - rewardDebt : 0n;

                let usdcBalance = "?";
                try {
                    const investorUsdcAta = getAssociatedTokenAddressSync(
                        onchain.usdcMint, kp.publicKey, false, TOKEN_PROGRAM_ID
                    );
                    const bal = await connection.getTokenAccountBalance(investorUsdcAta);
                    usdcBalance = `${bal.value.uiAmount}`;
                } catch {}

                console.log(`  [${idx}] ${kp.publicKey.toBase58().slice(0, 16)}...`);
                console.log(`       토큰: ${amount.toLocaleString()}  |  미청구: ${Number(pending) / 1_000_000} USDC  |  지갑: ${usdcBalance} USDC`);
            } catch {
                console.log(`  [${idx}] ${kp.publicKey.toBase58().slice(0, 16)}... (포지션 없음)`);
            }
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
    console.error("\n오류:", err.message ?? err);
    process.exit(1);
});
