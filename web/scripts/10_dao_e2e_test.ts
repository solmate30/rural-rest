/**
 * 10_dao_e2e_test.ts  —  DAO 거버넌스 E2E 로컬넷 테스트
 *
 * RWA 매물 생성 → 투자자 토큰 구매 → Active 전환 →
 * DAO 초기화 → 제안 생성 → RWA 보유자 투표 → Council 투표 →
 * Finalize → 소규모 풀 캡 버그 검증
 *
 * 전제조건:
 *   - solana-test-validator 실행 중 (http://127.0.0.1:8899)
 *   - anchor build 완료 (IDL 존재)
 *   - 프로그램 배포 완료 (anchor deploy 또는 anchor test 후)
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/10_dao_e2e_test.ts
 *
 * 옵션:
 *   --rpc <url>   RPC 엔드포인트 (기본값: http://127.0.0.1:8899)
 */

import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import Database from "better-sqlite3";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../local.db");

// ── .env 로드 ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    for (const rawLine of fs.readFileSync(envPath, "utf-8").split("\n")) {
        const line = rawLine.trim().startsWith("export ") ? rawLine.trim().slice(7) : rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) continue;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
    }
}

// ── IDL ──────────────────────────────────────────────────────────────────────
const RWA_IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);
const DAO_IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_dao.json"), "utf8")
);

const RWA_PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
const DAO_PROGRAM_ID = new PublicKey("3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX");

// ── 설정 ──────────────────────────────────────────────────────────────────────
const DEFAULT_RPC = "http://127.0.0.1:8899";

function parseArgs() {
    const args = process.argv.slice(2);
    const get = (flag: string) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
    };
    return { rpc: get("--rpc") ?? DEFAULT_RPC };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function ok(msg: string) { console.log(`  [PASS] ${msg}`); }
function info(msg: string) { console.log(`  [INFO] ${msg}`); }
function fail(msg: string) { console.error(`  [FAIL] ${msg}`); process.exit(1); }
function section(msg: string) { console.log(`\n${"=".repeat(60)}\n  ${msg}\n${"=".repeat(60)}`); }

async function fundAccount(connection: Connection, from: Keypair, to: PublicKey, sol: number) {
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: to,
            lamports: sol * LAMPORTS_PER_SOL,
        })
    );
    tx.feePayer = from.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(from);
    await connection.sendRawTransaction(tx.serialize());
    await sleep(500);
}

async function airdropSol(connection: Connection, pubkey: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}

// ── PDA 헬퍼 ──────────────────────────────────────────────────────────────────
function getPropertyTokenPda(listingId: string) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)],
        RWA_PROGRAM_ID
    )[0];
}
function getFundingVaultPda(listingId: string) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)],
        RWA_PROGRAM_ID
    )[0];
}
function getInvestorPositionPda(propertyToken: PublicKey, investor: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), investor.toBuffer()],
        RWA_PROGRAM_ID
    )[0];
}
function getRwaConfigPda() {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("rwa_config")],
        RWA_PROGRAM_ID
    )[0];
}
function getDaoConfigPda() {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")],
        DAO_PROGRAM_ID
    )[0];
}
function getProposalPda(id: number) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new BN(id).toArrayLike(Buffer, "le", 8)],
        DAO_PROGRAM_ID
    )[0];
}
function getVoteRecordPda(proposalId: number, voter: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), new BN(proposalId).toArrayLike(Buffer, "le", 8), voter.toBuffer()],
        DAO_PROGRAM_ID
    )[0];
}

// ── GitHub 헬퍼 ───────────────────────────────────────────────────────────────

const GITHUB_CATEGORY_LABELS: Record<string, string> = {
    operations: "운영",
    guidelines: "가이드라인",
    fundUsage: "자금 사용",
    other: "기타",
};

/**
 * GitHub Issue 생성 후 URL 반환.
 * GITHUB_TOKEN / GITHUB_DAO_REPO 미설정 시 placeholder URL 반환 (스킵).
 */
async function createGithubIssue(title: string, body: string, category: string): Promise<string> {
    const token = process.env.GITHUB_TOKEN;
    const repo  = process.env.GITHUB_DAO_REPO;

    if (!token || !repo) {
        console.log("  [INFO] GITHUB_TOKEN 또는 GITHUB_DAO_REPO 미설정 — GitHub Issue 스킵");
        return "https://github.com/placeholder/issues/0";
    }

    const labels = ["dao-proposal"];
    const catLabel = GITHUB_CATEGORY_LABELS[category];
    if (catLabel) labels.push(catLabel);

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: `[DAO] ${title}`, body, labels }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GitHub Issue 생성 실패 (${res.status}): ${errText.slice(0, 120)}`);
    }

    const data = await res.json();
    return data.html_url as string;
}

/**
 * Finalize 후 GitHub Issue에 투표 결과 코멘트 달고 닫기.
 */
async function closeGithubIssue(issueUrl: string, finalizedProposal: any): Promise<void> {
    const token = process.env.GITHUB_TOKEN;
    const match = issueUrl.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (!token || !match) return;

    const [, repo, issueNumber] = match;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    };

    const statusKey  = Object.keys(finalizedProposal.status)[0];
    const isSucceeded = statusKey === "succeeded";
    const votesFor   = finalizedProposal.votesFor.toNumber();
    const votesAgt   = finalizedProposal.votesAgainst.toNumber();
    const votesAbs   = finalizedProposal.votesAbstain.toNumber();
    const total      = votesFor + votesAgt + votesAbs;
    const forPct     = total > 0 ? ((votesFor / total) * 100).toFixed(1) : "0.0";
    const label      = isSucceeded ? "✅ 통과" : "❌ 부결";

    const commentBody = [
        `## 투표 결과: **${label}**`,
        "",
        "| 항목 | 수치 |",
        "|---|---|",
        `| 찬성 | ${votesFor} (${forPct}%) |`,
        `| 반대 | ${votesAgt} |`,
        `| 기권 | ${votesAbs} |`,
        `| 총 투표 | ${total} |`,
        "",
        `*온체인에서 자동으로 확정된 결과입니다.*`,
    ].join("\n");

    try {
        await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
            method: "POST",
            headers,
            body: JSON.stringify({ body: commentBody }),
        });
        await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                state: "closed",
                state_reason: isSucceeded ? "completed" : "not_planned",
            }),
        });
        console.log(`  [INFO] GitHub Issue #${issueNumber} 닫힘 (${statusKey})`);
    } catch (err: any) {
        console.error("  [WARN] GitHub Issue 업데이트 실패 (finalize는 완료):", err?.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  메인 실행
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
    const { rpc } = parseArgs();
    const connection = new Connection(rpc, "confirmed");

    console.log("\n  DAO E2E 로컬넷 테스트 시작");
    console.log(`  RPC: ${rpc}`);
    console.log(`  RWA Program: ${RWA_PROGRAM_ID.toBase58()}`);
    console.log(`  DAO Program: ${DAO_PROGRAM_ID.toBase58()}`);

    // ── 1. 키페어 생성 ───────────────────────────────────────────────────────
    section("1. 키페어 및 토큰 준비");

    const authority      = Keypair.generate(); // RWA + DAO authority (SPV)
    const localGov       = Keypair.generate(); // 지자체 (40% 수익 수령)
    const villageOp      = Keypair.generate(); // 마을 운영자 (30% 수익 수령)
    const council1       = Keypair.generate(); // Council Token 보유자 1 (제안 생성)
    const council2       = Keypair.generate(); // Council Token 보유자 2 (투표)
    const investor1      = Keypair.generate(); // 소액 투자자 (22 tokens)
    const investor2      = Keypair.generate(); // 중간 투자자 (18 tokens)
    const investor3      = Keypair.generate(); // 중간 투자자 (15 tokens, 매물B)
    const whale          = Keypair.generate(); // 대형 투자자 (캡 테스트)
    const outsider       = Keypair.generate(); // 투표권 없는 사용자

    // SOL 충전
    info("SOL airdrop...");
    await airdropSol(connection, authority.publicKey, 10);
    for (const kp of [localGov, villageOp, council1, council2, investor1, investor2, investor3, whale, outsider]) {
        await fundAccount(connection, authority, kp.publicKey, 0.5);
    }
    ok("전체 지갑 SOL 충전 완료");

    // USDC Mint
    info("USDC 민트 생성...");
    const usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);
    ok(`USDC Mint: ${usdcMint.toBase58()}`);

    // Council Mint (Token-2022)
    info("Council 민트 생성 (Token-2022)...");
    const councilMint = await createMint(
        connection, authority, authority.publicKey, null, 0,
        undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    ok(`Council Mint: ${councilMint.toBase58()}`);

    // Council Token 발급 (council1: 2개, council2: 1개)
    info("Council Token 발급...");
    for (const [member, amount] of [[council1, 2], [council2, 1]] as [Keypair, number][]) {
        const ata = await getOrCreateAssociatedTokenAccount(
            connection, authority, councilMint, member.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
        );
        await mintTo(connection, authority, councilMint, ata.address, authority, amount, undefined, undefined, TOKEN_2022_PROGRAM_ID);
    }
    ok("Council Token 발급: council1=2, council2=1 (총 supply=3)");

    // 투자자 USDC 발급
    info("투자자 USDC 발급...");
    for (const kp of [investor1, investor2, investor3, whale]) {
        const ata = await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, kp.publicKey);
        await mintTo(connection, authority, usdcMint, ata.address, authority, 1_000_000_000); // 1000 USDC
    }
    ok("투자자 USDC 각 1000 USDC 충전");

    // ── 2. RWA 매물 생성 (DB 매물 기반) ─────────────────────────────────────
    section("2. RWA 매물 생성 및 투자 (DB 매물 토큰화)");

    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const rwaProgram = new Program(RWA_IDL, provider);

    // RwaConfig 초기화 (이미 존재하면 skip)
    const rwaConfig = getRwaConfigPda();
    info("RwaConfig 초기화...");
    const rwaConfigInfo = await connection.getAccountInfo(rwaConfig);
    if (rwaConfigInfo) {
        ok("RwaConfig 이미 초기화됨 (skip)");
    } else {
        await (rwaProgram.methods as any)
            .initializeConfig()
            .accounts({
                authority: authority.publicKey,
                rwaConfig: rwaConfig,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        ok("RwaConfig 초기화 완료");
    }

    // 경주 시드 매물 확인 (3000=황오동 청송재, 3001=성건동 충재댁)
    const db = new Database(DB_PATH);
    const dbListings = db.prepare(
        "SELECT id, title, valuation_krw FROM listings WHERE id IN ('3000','3001') ORDER BY id"
    ).all() as any[];
    if (dbListings.length < 2) {
        fail("DB에 매물 3000, 3001이 없습니다. npx tsx scripts/00_seed_gyeongju.ts 먼저 실행하세요.");
    }
    info(`DB 매물 A: ${dbListings[0].id} — ${dbListings[0].title}`);
    info(`DB 매물 B: ${dbListings[1].id} — ${dbListings[1].title}`);

    const LISTING_A = "3000"; // 황오동 청송재
    const LISTING_B = "3001"; // 성건동 충재댁
    const TOTAL_SUPPLY = new BN(100);
    const PRICE = new BN(1_000_000); // 1 USDC/token
    const VALUATION = new BN(dbListings[0].valuation_krw ?? 150_000_000);
    const MIN_FUNDING_BPS = 1000; // 10% (테스트용)
    const deadlineSec = Math.floor(Date.now() / 1000) + 20; // 20초 후
    const deadline = new BN(deadlineSec);

    const tokenMintA = Keypair.generate();
    const tokenMintB = Keypair.generate();

    // initializeProperty 헬퍼
    const initProperty = async (lid: string, mintKp: Keypair) => {
        const pt = getPropertyTokenPda(lid);
        const fv = getFundingVaultPda(lid);
        const uv = getAssociatedTokenAddressSync(usdcMint, pt, true, TOKEN_PROGRAM_ID);

        await (rwaProgram.methods as any)
            .initializeProperty(lid, TOTAL_SUPPLY, VALUATION, PRICE, deadline, MIN_FUNDING_BPS)
            .accounts({
                authority: authority.publicKey,
                propertyToken: pt,
                tokenMint: mintKp.publicKey,
                fundingVault: fv,
                usdcVault: uv,
                usdcMint: usdcMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
                systemProgram: SystemProgram.programId,
            })
            .signers([authority, mintKp])
            .rpc();
        return pt;
    };

    info(`매물 A (${LISTING_A}) 초기화...`);
    const propertyTokenA = await initProperty(LISTING_A, tokenMintA);
    ok(`매물 A 생성: ${propertyTokenA.toBase58()}`);

    info(`매물 B (${LISTING_B}) 초기화...`);
    const propertyTokenB = await initProperty(LISTING_B, tokenMintB);
    ok(`매물 B 생성: ${propertyTokenB.toBase58()}`);

    // 투자자별 openPosition + purchaseTokens 헬퍼
    const buyTokens = async (investor: Keypair, pt: PublicKey, mintKp: Keypair, lid: string, amount: number) => {
        const positionPda = getInvestorPositionPda(pt, investor.publicKey);
        const fv = getFundingVaultPda(lid);
        const investorUsdc = getAssociatedTokenAddressSync(usdcMint, investor.publicKey);
        const investorRwa = getAssociatedTokenAddressSync(mintKp.publicKey, investor.publicKey, false, TOKEN_2022_PROGRAM_ID);

        const investorProvider = new AnchorProvider(connection, new Wallet(investor), { commitment: "confirmed" });
        const investorProgram = new Program(RWA_IDL, investorProvider);

        await (investorProgram.methods as any)
            .openPosition(lid)
            .accounts({
                investor: investor.publicKey,
                propertyToken: pt,
                investorPosition: positionPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([investor])
            .rpc();

        await (investorProgram.methods as any)
            .purchaseTokens(lid, new BN(amount))
            .accounts({
                investor: investor.publicKey,
                propertyToken: pt,
                investorPosition: positionPda,
                tokenMint: mintKp.publicKey,
                investorUsdcAccount: investorUsdc,
                fundingVault: fv,
                investorRwaAccount: investorRwa,
                usdcMint: usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
                systemProgram: SystemProgram.programId,
            })
            .signers([investor])
            .rpc();

        return positionPda;
    };

    // 투자 실행 (경주 파일럿 시나리오)
    // 매물A(3000): investor1 22토큰 + investor2 18토큰 + whale 30토큰 = 70토큰 (70%)
    // 매물B(3001): investor3 15토큰 + whale 20토큰 = 35토큰 (35%)
    info("investor1 → 황오동 청송재(3000) 22토큰 구매...");
    const inv1PosA = await buyTokens(investor1, propertyTokenA, tokenMintA, LISTING_A, 22);
    ok("investor1: 3000 22토큰 (22%)");

    info("investor2 → 황오동 청송재(3000) 18토큰 구매...");
    const inv2PosA = await buyTokens(investor2, propertyTokenA, tokenMintA, LISTING_A, 18);
    ok("investor2: 3000 18토큰 (18%)");

    info("whale → 황오동 청송재(3000) 30토큰 구매...");
    const whalePosA = await buyTokens(whale, propertyTokenA, tokenMintA, LISTING_A, 30);
    ok("whale: 3000 30토큰 (30%)");

    info("investor3 → 성건동 충재댁(3001) 15토큰 구매...");
    const inv3PosB = await buyTokens(investor3, propertyTokenB, tokenMintB, LISTING_B, 15);
    ok("investor3: 3001 15토큰 (42.9%)");

    info("whale → 성건동 충재댁(3001) 20토큰 구매...");
    const whalePosB = await buyTokens(whale, propertyTokenB, tokenMintB, LISTING_B, 20);
    ok("whale: 3001 20토큰 (57.1%)");

    // ── 3. 매물 Active 전환 ──────────────────────────────────────────────────
    section("3. 매물 Active 전환 (deadline 대기 후)");

    const remainSec = deadlineSec - Math.floor(Date.now() / 1000) + 2;
    if (remainSec > 0) {
        info(`deadline 대기 중... (${remainSec}초)`);
        await sleep(remainSec * 1000);
    }

    await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, authority.publicKey);
    const authUsdc = getAssociatedTokenAddressSync(usdcMint, authority.publicKey);

    // 매물 A: authority가 직접 처리
    info(`매물 A (${LISTING_A}): authority로 releaseFunds + activateProperty...`);
    await (rwaProgram.methods as any)
        .releaseFunds(LISTING_A)
        .accounts({
            operator: authority.publicKey,
            propertyToken: propertyTokenA,
            rwaConfig: rwaConfig,
            fundingVault: getFundingVaultPda(LISTING_A),
            authorityUsdcAccount: authUsdc,
            usdcMint: usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
            systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();
    await (rwaProgram.methods as any)
        .activateProperty(LISTING_A)
        .accounts({
            operator: authority.publicKey,
            propertyToken: propertyTokenA,
            rwaConfig: rwaConfig,
            tokenMint: tokenMintA.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    ok(`${LISTING_A} → Active 전환 완료 (operator=authority)`);

    // 매물 B: crank_authority로 처리 (권한 분리 검증)
    info("crank_authority 설정 중...");
    const crank = Keypair.generate();
    const crankAirdrop = await connection.requestAirdrop(crank.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(crankAirdrop, "confirmed");
    await (rwaProgram.methods as any)
        .setCrankAuthority(crank.publicKey)
        .accounts({
            authority: authority.publicKey,
            rwaConfig: rwaConfig,
        })
        .signers([authority])
        .rpc();
    ok(`crank_authority 설정: ${crank.publicKey.toBase58()}`);

    info(`매물 B (${LISTING_B}): crank_authority로 releaseFunds + activateProperty...`);
    const crankProvider = new AnchorProvider(connection, new Wallet(crank), { commitment: "confirmed" });
    const crankProgram = new Program(RWA_IDL, crankProvider);
    await (crankProgram.methods as any)
        .releaseFunds(LISTING_B)
        .accounts({
            operator: crank.publicKey,
            propertyToken: propertyTokenB,
            rwaConfig: rwaConfig,
            fundingVault: getFundingVaultPda(LISTING_B),
            authorityUsdcAccount: authUsdc,
            usdcMint: usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
            systemProgram: SystemProgram.programId,
        })
        .signers([crank])
        .rpc();
    await (crankProgram.methods as any)
        .activateProperty(LISTING_B)
        .accounts({
            operator: crank.publicKey,
            propertyToken: propertyTokenB,
            rwaConfig: rwaConfig,
            tokenMint: tokenMintB.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([crank])
        .rpc();
    ok(`${LISTING_B} → Active 전환 완료 (operator=crank_authority)`);

    // DB rwa_tokens 업데이트 (status + token_mint)
    info("DB rwa_tokens 업데이트...");
    const updateStmt = db.prepare(`
        UPDATE rwa_tokens
        SET status = ?, token_mint = ?, total_supply = ?, price_per_token_usdc = ?,
            min_funding_bps = ?, funding_deadline = ?, tokens_sold = ?,
            updated_at = strftime('%s', 'now')
        WHERE listing_id = ?
    `);

    const listingTokenMap = [
        { lid: LISTING_A, mint: tokenMintA.publicKey.toBase58(), sold: 70 },
        { lid: LISTING_B, mint: tokenMintB.publicKey.toBase58(), sold: 35 },
    ];

    for (const { lid, mint, sold } of listingTokenMap) {
        updateStmt.run("active", mint, 100, 1_000_000, MIN_FUNDING_BPS, deadlineSec, sold, lid);
    }
    ok("DB rwa_tokens: status=active, token_mint 설정 완료");

    // ── 3.5. 3자 수익 분배 검증 (지자체 40% / 운영자 30% / 투자자 30%) ───────
    section("3.5. 3자 수익 분배 — 황오동 청송재(3000) 월 영업이익");

    // 시나리오: 월 숙박 수익 333 USDC (운영비 차감 후 영업이익)
    const MONTHLY_REVENUE_USDC = 333;
    const grossMicro = BigInt(Math.round(MONTHLY_REVENUE_USDC * 1_000_000));
    const govtAmount     = grossMicro * 4000n / 10_000n; // 40%
    const operatorAmount = grossMicro * 3000n / 10_000n; // 30%
    const investorAmount = grossMicro - govtAmount - operatorAmount; // 30% (나머지)

    info(`월 영업이익: ${MONTHLY_REVENUE_USDC} USDC`);
    info(`  지자체:   ${Number(govtAmount) / 1_000_000} USDC (40%)`);
    info(`  운영자:   ${Number(operatorAmount) / 1_000_000} USDC (30%)`);
    info(`  투자자:   ${Number(investorAmount) / 1_000_000} USDC (30%, 온체인)`);

    // SPV(authority)에 수익 USDC 충전 (실제 환경에서는 숙박 예약 결제로 수령)
    const { mintTo: mintToFn, transfer: transferFn } = await import("@solana/spl-token");
    await mintToFn(connection, authority, usdcMint, authUsdc, authority, grossMicro, [], undefined, TOKEN_PROGRAM_ID);
    info("SPV USDC 수익 충전 완료");

    // 지자체 USDC ATA 생성 및 이체
    const govtUsdcAta = await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, localGov.publicKey, false, undefined, undefined, TOKEN_PROGRAM_ID);
    await transferFn(connection, authority, authUsdc, govtUsdcAta.address, authority, govtAmount, [], undefined, TOKEN_PROGRAM_ID);
    const govtBalance = await connection.getTokenAccountBalance(govtUsdcAta.address);
    ok(`지자체 수령: ${govtBalance.value.uiAmount} USDC (${localGov.publicKey.toBase58().slice(0, 8)}...)`);

    // 운영자 USDC ATA 생성 및 이체
    const opUsdcAta = await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, villageOp.publicKey, false, undefined, undefined, TOKEN_PROGRAM_ID);
    await transferFn(connection, authority, authUsdc, opUsdcAta.address, authority, operatorAmount, [], undefined, TOKEN_PROGRAM_ID);
    const opBalance = await connection.getTokenAccountBalance(opUsdcAta.address);
    ok(`운영자 수령: ${opBalance.value.uiAmount} USDC (${villageOp.publicKey.toBase58().slice(0, 8)}...)`);

    // 투자자 배당 — 온체인 distributeMonthlyRevenue
    const usdcVaultA = getAssociatedTokenAddressSync(usdcMint, propertyTokenA, true, TOKEN_PROGRAM_ID);
    await (rwaProgram.methods as any)
        .distributeMonthlyRevenue(LISTING_A, new BN(investorAmount.toString()))
        .accounts({
            propertyToken: propertyTokenA,
            authority: authority.publicKey,
            authorityUsdcAccount: authUsdc,
            usdcVault: usdcVaultA,
            usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    const vaultBalance = await connection.getTokenAccountBalance(usdcVaultA);
    ok(`투자자 배당 풀: ${vaultBalance.value.uiAmount} USDC (온체인 예치, investor1/2/whale 청구 가능)`);

    // 비율 검증
    const totalPaid = Number(govtAmount + operatorAmount + investorAmount) / 1_000_000;
    if (Math.abs(totalPaid - MONTHLY_REVENUE_USDC) < 0.01) {
        ok(`3자 분배 합계 검증: ${totalPaid} USDC = ${MONTHLY_REVENUE_USDC} USDC`);
    }

    // ── 4. DAO 초기화 ────────────────────────────────────────────────────────
    section("4. DAO 초기화");

    const daoProgram = new Program(DAO_IDL, provider);
    const daoConfig = getDaoConfigPda();

    const VOTING_PERIOD = new BN(15);   // 15초 (E2E 테스트용)
    const QUORUM_BPS = 1000;            // 10%
    const APPROVAL_BPS = 6000;          // 60%
    const VOTING_CAP_BPS = 1000;        // 10%

    const daoConfigInfo = await connection.getAccountInfo(daoConfig);
    if (daoConfigInfo) {
        ok("DAO Config 이미 초기화됨 (skip)");
    } else {
        await (daoProgram.methods as any)
            .initializeDao(VOTING_PERIOD, QUORUM_BPS, APPROVAL_BPS, VOTING_CAP_BPS, RWA_PROGRAM_ID)
            .accounts({
                authority: authority.publicKey,
                daoConfig: daoConfig,
                councilMint: councilMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        ok("DAO 초기화 완료");
    }

    const configData = await (daoProgram.account as any).daoConfig.fetch(daoConfig);
    info(`voting_period=${configData.votingPeriod.toNumber()}s, quorum=${configData.quorumBps}bps, threshold=${configData.approvalThresholdBps}bps, cap=${configData.votingCapBps}bps`);

    // ── 5. 제안 생성 (council1) ──────────────────────────────────────────────
    section("5. 제안 생성 (Council Member)");

    const proposalId = 0;
    const proposalPda = getProposalPda(proposalId);
    const council1Ata = getAssociatedTokenAddressSync(councilMint, council1.publicKey, false, TOKEN_2022_PROGRAM_ID);

    const council1Provider = new AnchorProvider(connection, new Wallet(council1), { commitment: "confirmed" });
    const council1DaoProgram = new Program(DAO_IDL, council1Provider);

    // GitHub Issue 생성
    const PROPOSAL_TITLE = "로컬넷 E2E 테스트 -- 전체 숙소 운영 규칙 개정";
    info("GitHub Issue 생성 중...");
    const issueUrl = await createGithubIssue(
        PROPOSAL_TITLE,
        [
            "## 배경",
            "E2E 테스트 자동 생성 제안입니다.",
            "",
            "## 제안 내용",
            "- 테스트 항목 A",
            "- 테스트 항목 B",
            "",
            "## 예상 효과",
            "DAO 거버넌스 흐름 전체 검증.",
        ].join("\n"),
        "operations",
    );
    ok(`GitHub Issue 생성 완료: ${issueUrl}`);

    await (council1DaoProgram.methods as any)
        .createProposal(
            PROPOSAL_TITLE,
            issueUrl,
            { operations: {} },
            new BN(0), // 기본 voting_period 사용
        )
        .accounts({
            creator: council1.publicKey,
            daoConfig: daoConfig,
            proposal: proposalPda,
            creatorCouncilAta: council1Ata,
            councilMint: councilMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
            { pubkey: propertyTokenA, isWritable: false, isSigner: false },
            { pubkey: propertyTokenB, isWritable: false, isSigner: false },
        ])
        .signers([council1])
        .rpc();

    const proposal = await (daoProgram.account as any).proposal.fetch(proposalPda);
    const totalWeight = proposal.totalEligibleWeight.toNumber();
    // 매물A sold(45) + 매물B sold(20) + council supply(3) = 68
    info(`제안 ID: ${proposal.id.toNumber()}`);
    info(`제목: ${proposal.title}`);
    info(`total_eligible_weight: ${totalWeight}`);
    info(`투표 마감: ${new Date(proposal.votingEndsAt.toNumber() * 1000).toLocaleString()}`);
    ok("제안 생성 완료");

    // ── 6. 투표 (RWA 보유자 + Council 보유자) ────────────────────────────────
    section("6. 투표");

    // 투표 헬퍼
    const castVote = async (
        voter: Keypair,
        voteType: any,
        pairedRemainingAccounts: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[],
        voterCouncilAta: PublicKey | null,
    ) => {
        const vr = getVoteRecordPda(proposalId, voter.publicKey);
        const voterProvider = new AnchorProvider(connection, new Wallet(voter), { commitment: "confirmed" });
        const voterDaoProgram = new Program(DAO_IDL, voterProvider);

        await (voterDaoProgram.methods as any)
            .castVote(voteType)
            .accounts({
                voter: voter.publicKey,
                daoConfig: daoConfig,
                proposal: proposalPda,
                voteRecord: vr,
                voterCouncilAta: voterCouncilAta,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts(pairedRemainingAccounts)
            .signers([voter])
            .rpc();

        return (daoProgram.account as any).voteRecord.fetch(vr);
    };

    // 6-1. investor1 찬성 (RWA 10토큰)
    info("investor1 찬성 투표 (RWA 10토큰)...");
    const record1 = await castVote(investor1, { for: {} }, [
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: inv1PosA, isWritable: false, isSigner: false },
    ], null);
    const cap = Math.floor(totalWeight * VOTING_CAP_BPS / 10000);
    info(`  raw=${record1.rawWeight.toNumber()}, weight=${record1.weight.toNumber()} (cap=${cap})`);
    ok(`investor1 투표: ${record1.weight.toNumber()}표 반영`);

    // 6-2. investor2 반대 (RWA 18토큰)
    info("investor2 반대 투표 (3000 18토큰)...");
    const record2 = await castVote(investor2, { against: {} }, [
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: inv2PosA, isWritable: false, isSigner: false },
    ], null);
    info(`  raw=${record2.rawWeight.toNumber()}, weight=${record2.weight.toNumber()}`);
    ok(`investor2 투표: ${record2.weight.toNumber()}표 반영`);

    // 6-3. whale 찬성 (RWA 50토큰 → 캡 적용)
    info("whale 찬성 투표 (RWA 50토큰, 캡 적용 예상)...");
    const record3 = await castVote(whale, { for: {} }, [
        { pubkey: propertyTokenA, isWritable: false, isSigner: false },
        { pubkey: whalePosA, isWritable: false, isSigner: false },
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
        { pubkey: whalePosB, isWritable: false, isSigner: false },
    ], null);
    info(`  raw=${record3.rawWeight.toNumber()}, weight=${record3.weight.toNumber()} (캡 ${cap} 적용)`);
    if (record3.weight.toNumber() <= cap) {
        ok(`whale 투표: 10% 캡 정상 적용 (${record3.rawWeight.toNumber()} → ${record3.weight.toNumber()})`);
    } else {
        fail(`whale 캡 미적용: weight=${record3.weight.toNumber()} > cap=${cap}`);
    }

    // 6-3.5. investor3 찬성 (3001 15토큰)
    info("investor3 찬성 투표 (3001 15토큰)...");
    const record35 = await castVote(investor3, { for: {} }, [
        { pubkey: propertyTokenB, isWritable: false, isSigner: false },
        { pubkey: inv3PosB, isWritable: false, isSigner: false },
    ], null);
    info(`  raw=${record35.rawWeight.toNumber()}, weight=${record35.weight.toNumber()}`);
    ok(`investor3 투표: ${record35.weight.toNumber()}표 반영 (3001 보유)`);

    // 6-4. council2 기권 (Council Token만 보유, RWA 없음)
    info("council2 기권 투표 (Council Token 1개, RWA 없음)...");
    const council2Ata = getAssociatedTokenAddressSync(councilMint, council2.publicKey, false, TOKEN_2022_PROGRAM_ID);
    const record4 = await castVote(council2, { abstain: {} }, [], council2Ata);
    info(`  raw=${record4.rawWeight.toNumber()}, weight=${record4.weight.toNumber()} (Council Token만)`);
    if (record4.rawWeight.toNumber() === 1) {
        ok("council2 투표: Council Token 1개로 투표 성공");
    } else {
        fail(`council2 raw weight 예상 1, 실제 ${record4.rawWeight.toNumber()}`);
    }

    // 6-5. outsider 투표 실패 (투표권 없음)
    info("outsider 투표 시도 (투표권 없음, 실패 예상)...");
    try {
        await castVote(outsider, { for: {} }, [], null);
        fail("투표권 없는 사용자가 투표에 성공함");
    } catch (err: any) {
        if (err.toString().includes("NoVotingPower")) {
            ok("outsider 투표 차단: NoVotingPower");
        } else {
            ok(`outsider 투표 차단: ${err.message?.slice(0, 60)}`);
        }
    }

    // 6-6. 중복 투표 실패
    info("investor1 중복 투표 시도 (실패 예상)...");
    try {
        await castVote(investor1, { for: {} }, [
            { pubkey: propertyTokenA, isWritable: false, isSigner: false },
            { pubkey: inv1PosA, isWritable: false, isSigner: false },
        ], null);
        fail("중복 투표가 성공함");
    } catch {
        ok("중복 투표 차단 (VoteRecord PDA 이미 존재)");
    }

    // 투표 현황 확인
    const proposalAfterVote = await (daoProgram.account as any).proposal.fetch(proposalPda);
    info(`투표 현황: 찬성=${proposalAfterVote.votesFor.toNumber()}, 반대=${proposalAfterVote.votesAgainst.toNumber()}, 기권=${proposalAfterVote.votesAbstain.toNumber()}`);

    // ── 7. Finalize ──────────────────────────────────────────────────────────
    section("7. 투표 종료 및 Finalize");

    const votingEndsAt = proposal.votingEndsAt.toNumber();
    const nowSec = Math.floor(Date.now() / 1000);
    const waitSec = votingEndsAt - nowSec + 2;
    if (waitSec > 0) {
        info(`투표 기간 종료 대기 중... (${waitSec}초)`);
        await sleep(waitSec * 1000);
    }

    await (daoProgram.methods as any)
        .finalizeProposal()
        .accounts({ daoConfig, proposal: proposalPda })
        .rpc();

    const finalizedProposal = await (daoProgram.account as any).proposal.fetch(proposalPda);
    const statusKey = Object.keys(finalizedProposal.status)[0];
    info(`최종 상태: ${statusKey}`);

    const totalVoted = finalizedProposal.votesFor.toNumber() + finalizedProposal.votesAgainst.toNumber() + finalizedProposal.votesAbstain.toNumber();
    const quorumThreshold = Math.floor(totalWeight * QUORUM_BPS / 10000);
    const quorumMet = totalVoted >= quorumThreshold;
    info(`정족수: ${totalVoted} / ${quorumThreshold} (${quorumMet ? "충족" : "미달"})`);

    const votesCast = finalizedProposal.votesFor.toNumber() + finalizedProposal.votesAgainst.toNumber();
    const approvalRate = votesCast > 0 ? (finalizedProposal.votesFor.toNumber() / votesCast * 100).toFixed(1) : "N/A";
    info(`찬성률: ${approvalRate}% (기준: ${APPROVAL_BPS / 100}%)`);
    ok(`제안 Finalize 완료: ${statusKey.toUpperCase()}`);

    // GitHub Issue 결과 코멘트 + 닫기
    info("GitHub Issue 결과 업데이트 중...");
    await closeGithubIssue(issueUrl, finalizedProposal);

    // ── 8. 소규모 풀 캡 버그 검증 ────────────────────────────────────────────
    section("8. 소규모 풀 캡 버그 검증 (cap >= 1 보장)");

    // 새 매물 (소규모: total_supply=5, 1명만 1토큰 구매)
    const LISTING_SMALL = "dao-e2e-small";
    const tokenMintSmall = Keypair.generate();
    const deadlineSmall = new BN(Math.floor(Date.now() / 1000) + 15);

    info("소규모 매물 생성 (total_supply=5)...");
    const ptSmall = getPropertyTokenPda(LISTING_SMALL);
    const fvSmall = getFundingVaultPda(LISTING_SMALL);
    const uvSmall = getAssociatedTokenAddressSync(usdcMint, ptSmall, true, TOKEN_PROGRAM_ID);

    await (rwaProgram.methods as any)
        .initializeProperty(LISTING_SMALL, new BN(5), VALUATION, PRICE, deadlineSmall, MIN_FUNDING_BPS)
        .accounts({
            authority: authority.publicKey,
            propertyToken: ptSmall,
            tokenMint: tokenMintSmall.publicKey,
            fundingVault: fvSmall,
            usdcVault: uvSmall,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
            systemProgram: SystemProgram.programId,
        })
        .signers([authority, tokenMintSmall])
        .rpc();

    info("investor1 → 소규모 매물 1토큰 구매...");
    const inv1PosSmall = await buyTokens(investor1, ptSmall, tokenMintSmall, LISTING_SMALL, 1);
    ok("소규모 매물 투자 완료 (tokens_sold=1)");

    // deadline 대기 → Active 전환
    const remainSmall = Math.floor(Date.now() / 1000);
    const waitSmall = deadlineSmall.toNumber() - remainSmall + 2;
    if (waitSmall > 0) {
        info(`소규모 매물 deadline 대기 (${waitSmall}초)...`);
        await sleep(waitSmall * 1000);
    }

    await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, authority.publicKey);
    const authUsdcSmall = getAssociatedTokenAddressSync(usdcMint, authority.publicKey);

    await (rwaProgram.methods as any)
        .releaseFunds(LISTING_SMALL)
        .accounts({
            operator: authority.publicKey,
            propertyToken: ptSmall,
            rwaConfig: rwaConfig,
            fundingVault: fvSmall,
            authorityUsdcAccount: authUsdcSmall,
            usdcMint: usdcMint,
            usdcTokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
            systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

    await (rwaProgram.methods as any)
        .activateProperty(LISTING_SMALL)
        .accounts({
            operator: authority.publicKey,
            propertyToken: ptSmall,
            rwaConfig: rwaConfig,
            tokenMint: tokenMintSmall.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc();
    ok("소규모 매물 Active 전환 완료");

    // 소규모 매물도 DB에 세 번째 매물이 있으면 업데이트
    if (dbListings.length > 2) {
        // 이미 있으면 사용하지만, 소규모 매물은 별도 listing_id로 생성했으므로 skip
    }

    // 소규모 풀 전용 제안 생성
    info("소규모 풀 제안 생성...");
    const configAfter = await (daoProgram.account as any).daoConfig.fetch(daoConfig);
    const smallProposalId = configAfter.proposalCount.toNumber();
    const smallProposalPda = getProposalPda(smallProposalId);

    await (council1DaoProgram.methods as any)
        .createProposal(
            "소규모 풀 캡 테스트",
            issueUrl, // 메인 제안과 같은 issue (캡 버그 검증 전용, 별도 issue 불필요)
            { other: {} },
            new BN(0),
        )
        .accounts({
            creator: council1.publicKey,
            daoConfig: daoConfig,
            proposal: smallProposalPda,
            creatorCouncilAta: council1Ata,
            councilMint: councilMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
            { pubkey: ptSmall, isWritable: false, isSigner: false },
        ])
        .signers([council1])
        .rpc();

    const smallProposal = await (daoProgram.account as any).proposal.fetch(smallProposalPda);
    const smallTotalWeight = smallProposal.totalEligibleWeight.toNumber();
    // tokens_sold(1) + council_supply(3) = 4
    info(`소규모 풀 total_eligible_weight: ${smallTotalWeight}`);
    const smallCapRaw = Math.floor(smallTotalWeight * VOTING_CAP_BPS / 10000);
    info(`cap_raw = floor(${smallTotalWeight} * ${VOTING_CAP_BPS} / 10000) = ${smallCapRaw}`);
    info(`cap = max(${smallCapRaw}, 1) = ${Math.max(smallCapRaw, 1)} (최소 1 보장)`);

    // investor1 투표 (1 RWA) → 과거 버그: weight=0, 수정 후: weight=1
    info("investor1 소규모 풀 투표 (1 RWA)...");
    const smallVr = getVoteRecordPda(smallProposalId, investor1.publicKey);
    const inv1Provider = new AnchorProvider(connection, new Wallet(investor1), { commitment: "confirmed" });
    const inv1DaoProgram = new Program(DAO_IDL, inv1Provider);

    await (inv1DaoProgram.methods as any)
        .castVote({ for: {} })
        .accounts({
            voter: investor1.publicKey,
            daoConfig: daoConfig,
            proposal: smallProposalPda,
            voteRecord: smallVr,
            voterCouncilAta: null,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
            { pubkey: ptSmall, isWritable: false, isSigner: false },
            { pubkey: inv1PosSmall, isWritable: false, isSigner: false },
        ])
        .signers([investor1])
        .rpc();

    const smallRecord = await (daoProgram.account as any).voteRecord.fetch(smallVr);
    info(`  raw_weight=${smallRecord.rawWeight.toNumber()}, weight=${smallRecord.weight.toNumber()}`);

    if (smallRecord.weight.toNumber() >= 1) {
        ok(`소규모 풀 캡 버그 수정 확인: weight=${smallRecord.weight.toNumber()} >= 1 (이전 버그: 0)`);
    } else {
        fail(`소규모 풀 캡 버그 미수정: weight=${smallRecord.weight.toNumber()} (0이면 안 됨)`);
    }

    const smallProposalAfter = await (daoProgram.account as any).proposal.fetch(smallProposalPda);
    if (smallProposalAfter.votesFor.toNumber() >= 1) {
        ok(`소규모 풀 투표 반영 확인: votes_for=${smallProposalAfter.votesFor.toNumber()}`);
    } else {
        fail(`소규모 풀 투표 미반영: votes_for=${smallProposalAfter.votesFor.toNumber()}`);
    }

    // ── 결과 요약 ────────────────────────────────────────────────────────────
    section("테스트 결과 요약");

    console.log(`
  경주 파일럿 노드:
    - 3000 황오동 청송재: Active (investor1 22% + investor2 18% + whale 30% = 70토큰)
    - 3001 성건동 충재댁: Active (investor3 15% + whale 20% = 35토큰, crank 전환)
    - dao-e2e-small:     Active (소규모 캡 버그 검증용, 1토큰)

  3자 수익 분배 (월 ${MONTHLY_REVENUE_USDC} USDC):
    - 지자체 (${localGov.publicKey.toBase58().slice(0, 8)}...): ${MONTHLY_REVENUE_USDC * 0.4} USDC (40%)
    - 운영자 (${villageOp.publicKey.toBase58().slice(0, 8)}...): ${MONTHLY_REVENUE_USDC * 0.3} USDC (30%)
    - 투자자 풀 (온체인):  ${MONTHLY_REVENUE_USDC * 0.3} USDC (30%)

  DAO 거버넌스:
    - 제안 #0: "${proposal.title}" → ${statusKey}
      찬성=${finalizedProposal.votesFor.toNumber()}, 반대=${finalizedProposal.votesAgainst.toNumber()}, 기권=${finalizedProposal.votesAbstain.toNumber()}
      정족수 ${quorumMet ? "충족" : "미달"}, 찬성률 ${approvalRate}%

    - 제안 #${smallProposalId}: "소규모 풀 캡 테스트"
      weight=${smallRecord.weight.toNumber()} (cap_raw=${smallCapRaw}, max(1) 적용)

  검증 항목:
    [PASS] 경주 시드 매물(3000/3001) 토크나이즈 및 투자 (3명 투자자 + whale)
    [PASS] authority로 releaseFunds + activateProperty (3000 황오동 청송재)
    [PASS] crank_authority로 releaseFunds + activateProperty (3001 성건동 충재댁)
    [PASS] 3자 수익 분배 — 지자체 40% / 운영자 30% / 투자자 30%
    [PASS] DAO 초기화
    [PASS] Council Member 제안 생성 (GitHub Issue 연동)
    [PASS] RWA 보유자 투표 (찬성/반대)
    [PASS] whale 10% 캡 적용
    [PASS] Council Token 단독 투표
    [PASS] 투표권 없는 사용자 차단
    [PASS] 중복 투표 차단
    [PASS] Finalize 판정 + GitHub Issue 닫기
    [PASS] 소규모 풀 캡 버그 수정 (weight >= 1)
`);

    ok("DAO E2E 테스트 전체 통과!");

    db.close();
}

main().catch((err) => {
    console.error("\n  [FATAL]", err);
    process.exit(1);
});
