/**
 * 12_ui_test_setup.ts  —  UI 거버넌스 테스트용 온체인 상태 준비
 *
 * - council1, investor1, investor2 keypair를 test-wallets.json에 저장 (재실행 시 재사용)
 * - RwaConfig, DaoConfig, Council Token, RWA Token 초기화
 * - 제안 생성 / 투표는 브라우저에서 직접 테스트
 *
 * 실행:
 *   cd web
 *   npx tsx scripts/12_ui_test_setup.ts
 *
 * 출력:
 *   Backpack 임포트용 base58 secret key 출력 (council1, investor1, investor2)
 */

import {
    Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    createMint, getOrCreateAssociatedTokenAccount, mintTo,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import bs58 from "bs58";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── IDL ──────────────────────────────────────────────────────────────────────
const RWA_IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_rwa.json"), "utf8")
);
const DAO_IDL = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_dao.json"), "utf8")
);

const RWA_PROGRAM_ID = new PublicKey("EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR");
const DAO_PROGRAM_ID = new PublicKey("3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX");
const RPC_URL = "http://127.0.0.1:8899";

const WALLETS_PATH = path.join(__dirname, "../test-wallets.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function ok(msg: string)   { console.log(`  [OK] ${msg}`); }
function info(msg: string) { console.log(`  [..] ${msg}`); }
function section(msg: string) { console.log(`\n${"─".repeat(56)}\n  ${msg}\n${"─".repeat(56)}`); }

// keypair → base58 secretKey
function toBase58(kp: Keypair) { return bs58.encode(kp.secretKey); }

// 저장된 keypair 불러오기 또는 새로 생성
function loadOrCreate(saved: Record<string, string>, key: string): Keypair {
    if (saved[key]) {
        return Keypair.fromSecretKey(bs58.decode(saved[key]));
    }
    return Keypair.generate();
}

// PDA 헬퍼
function getRwaConfigPda() {
    return PublicKey.findProgramAddressSync([Buffer.from("rwa_config")], RWA_PROGRAM_ID)[0];
}
function getDaoConfigPda() {
    return PublicKey.findProgramAddressSync([Buffer.from("dao_config")], DAO_PROGRAM_ID)[0];
}
function getPropertyTokenPda(listingId: string) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("property"), Buffer.from(listingId)], RWA_PROGRAM_ID
    )[0];
}
function getFundingVaultPda(listingId: string) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("funding_vault"), Buffer.from(listingId)], RWA_PROGRAM_ID
    )[0];
}
function getInvestorPositionPda(propertyToken: PublicKey, investor: PublicKey) {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("investor"), propertyToken.toBuffer(), investor.toBuffer()], RWA_PROGRAM_ID
    )[0];
}

async function airdropSol(connection: Connection, pubkey: PublicKey, sol: number) {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
}
async function fundAccount(connection: Connection, from: Keypair, to: PublicKey, sol: number) {
    const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports: sol * LAMPORTS_PER_SOL })
    );
    tx.feePayer = from.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(from);
    await connection.sendRawTransaction(tx.serialize());
    await sleep(500);
}

async function main() {
    const connection = new Connection(RPC_URL, "confirmed");

    console.log("\n  UI 테스트 셋업 시작");
    console.log(`  RPC: ${RPC_URL}`);

    // ── 1. Keypair 로드 or 생성 ───────────────────────────────────────────────
    section("1. Keypair 준비");

    const saved: Record<string, string> = fs.existsSync(WALLETS_PATH)
        ? JSON.parse(fs.readFileSync(WALLETS_PATH, "utf8"))
        : {};

    const authority  = loadOrCreate(saved, "authority");
    const council1   = loadOrCreate(saved, "council1");   // 제안 생성 권한
    const investor1  = loadOrCreate(saved, "investor1");  // 투표자 1
    const investor2  = loadOrCreate(saved, "investor2");  // 투표자 2

    // 저장 (keypair만, mint는 나중에 확인 후 병합)
    const toSave: Record<string, string> = {
        ...saved, // 기존 mint 주소 등 보존
        authority:  toBase58(authority),
        council1:   toBase58(council1),
        investor1:  toBase58(investor1),
        investor2:  toBase58(investor2),
    };
    fs.writeFileSync(WALLETS_PATH, JSON.stringify(toSave, null, 2));
    ok(`Keypair 저장: ${WALLETS_PATH}`);

    // ── 2. SOL 충전 ──────────────────────────────────────────────────────────
    section("2. SOL 충전");

    const authorityBal = await connection.getBalance(authority.publicKey);
    if (authorityBal < 2 * LAMPORTS_PER_SOL) {
        await airdropSol(connection, authority.publicKey, 10);
        ok("authority airdrop 10 SOL");
    } else {
        ok(`authority 잔액 충분 (${(authorityBal / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
    }
    for (const [name, kp] of [["council1", council1], ["investor1", investor1], ["investor2", investor2]] as [string, Keypair][]) {
        const bal = await connection.getBalance(kp.publicKey);
        if (bal < 0.3 * LAMPORTS_PER_SOL) {
            await fundAccount(connection, authority, kp.publicKey, 1);
            ok(`${name} 1 SOL 충전`);
        } else {
            ok(`${name} 잔액 충분 (${(bal / LAMPORTS_PER_SOL).toFixed(2)} SOL)`);
        }
    }

    // ── 3. USDC + Council Mint ───────────────────────────────────────────────
    section("3. 토큰 민트 준비");

    // saved에 mintInfo가 있으면 재사용
    let usdcMint: PublicKey;
    let councilMint: PublicKey;

    // 저장된 mint 주소가 있더라도 온체인에 실제 존재하는지 확인 (validator 재시작 대응)
    const savedUsdcExists = saved.usdcMint && await connection.getAccountInfo(new PublicKey(saved.usdcMint));
    const savedCouncilExists = saved.councilMint && await connection.getAccountInfo(new PublicKey(saved.councilMint));

    if (savedUsdcExists && savedCouncilExists) {
        usdcMint = new PublicKey(saved.usdcMint);
        councilMint = new PublicKey(saved.councilMint);
        ok(`USDC Mint 재사용: ${usdcMint.toBase58()}`);
        ok(`Council Mint 재사용: ${councilMint.toBase58()}`);
    } else {
        if (saved.usdcMint && !savedUsdcExists) info("USDC Mint 온체인에 없음 (validator 재시작?) → 재생성");
        if (saved.councilMint && !savedCouncilExists) info("Council Mint 온체인에 없음 (validator 재시작?) → 재생성");

        info("USDC Mint 생성...");
        usdcMint = await createMint(connection, authority, authority.publicKey, null, 6);
        ok(`USDC Mint: ${usdcMint.toBase58()}`);

        info("Council Mint 생성 (Token-2022)...");
        councilMint = await createMint(
            connection, authority, authority.publicKey, null, 0,
            undefined, undefined, TOKEN_2022_PROGRAM_ID
        );
        ok(`Council Mint: ${councilMint.toBase58()}`);

        // 저장 (tokenMint도 초기화 필요하므로 제거)
        const updatedSave = { ...toSave, usdcMint: usdcMint.toBase58(), councilMint: councilMint.toBase58() };
        delete (updatedSave as any).tokenMint; // 재생성 필요
        fs.writeFileSync(WALLETS_PATH, JSON.stringify(updatedSave, null, 2));
        Object.assign(saved, updatedSave);
    }

    // Council Token → council1 (2개)
    info("Council Token 확인/발급...");
    const council1Ata = await getOrCreateAssociatedTokenAccount(
        connection, authority, councilMint, council1.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    if (Number(council1Ata.amount) === 0) {
        await mintTo(connection, authority, councilMint, council1Ata.address, authority, 2, undefined, undefined, TOKEN_2022_PROGRAM_ID);
        ok("council1 Council Token 2개 발급");
    } else {
        ok(`council1 Council Token 보유 중 (${council1Ata.amount}개)`);
    }

    // USDC → investor1, investor2
    info("투자자 USDC 확인/발급...");
    for (const [name, kp] of [["investor1", investor1], ["investor2", investor2]] as [string, Keypair][]) {
        const ata = await getOrCreateAssociatedTokenAccount(connection, authority, usdcMint, kp.publicKey);
        if (Number(ata.amount) < 100_000_000) { // 100 USDC 미만이면 충전
            await mintTo(connection, authority, usdcMint, ata.address, authority, 1_000_000_000);
            ok(`${name} USDC 1000 충전`);
        } else {
            ok(`${name} USDC 충분 (${Number(ata.amount) / 1_000_000} USDC)`);
        }
    }

    // ── 4. RwaConfig + DaoConfig 초기화 ──────────────────────────────────────
    section("4. 프로그램 Config 초기화");

    const provider = new AnchorProvider(connection, new Wallet(authority), { commitment: "confirmed" });
    const rwaProgram = new Program(RWA_IDL, provider);
    const daoProgram = new Program(DAO_IDL, provider);

    const rwaConfig = getRwaConfigPda();
    if (!(await connection.getAccountInfo(rwaConfig))) {
        await (rwaProgram.methods as any).initializeConfig()
            .accounts({ authority: authority.publicKey, rwaConfig, systemProgram: SystemProgram.programId })
            .rpc();
        ok("RwaConfig 초기화");
    } else {
        ok("RwaConfig 이미 존재");
    }

    const daoConfig = getDaoConfigPda();
    if (!(await connection.getAccountInfo(daoConfig))) {
        await (daoProgram.methods as any)
            .initializeDao(
                new BN(604800),   // voting_period: 7일 (604800초)
                2000,             // quorum_bps: 20%
                6000,             // approval_threshold_bps: 60%
                10000,            // voting_cap_bps: 100% = cap 없음 (MVP — 토큰 비례 1:1)
                RWA_PROGRAM_ID,   // rwa_program (파라미터로 전달)
            )
            .accounts({
                authority: authority.publicKey,
                daoConfig,
                councilMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();
        ok("DaoConfig 초기화 (voting_period=7일)");
    } else {
        ok("DaoConfig 이미 존재");
    }

    // ── 5. RWA 매물 초기화 + 투자자 토큰 구매 ────────────────────────────────
    section("5. RWA 매물 (listing-ui-test) 초기화 및 투자");

    const LISTING_ID = "ui-test-001";
    const TOTAL_SUPPLY = 100;
    const VALUATION = new BN(100_000_000); // 100 USDC (테스트용)
    const PRICE_PER_TOKEN = new BN(1_000_000); // 1 USDC
    const MIN_FUNDING_BPS = 3000; // 30% — investor1(20) + investor2(15) = 35% 충족
    const deadline = new BN(Math.floor(Date.now() / 1000) + 12); // 12초 후 (release_funds 테스트용)

    const ASSOC_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
    const propertyToken = getPropertyTokenPda(LISTING_ID);
    const fundingVault = getFundingVaultPda(LISTING_ID);

    const ptInfo = await connection.getAccountInfo(propertyToken);
    let tokenMint: PublicKey;

    if (!ptInfo) {
        const tokenMintKp = Keypair.generate();
        tokenMint = tokenMintKp.publicKey;

        const usdcVault = getAssociatedTokenAddressSync(usdcMint, propertyToken, true, TOKEN_PROGRAM_ID);

        await (rwaProgram.methods as any)
            .initializeProperty(LISTING_ID, new BN(TOTAL_SUPPLY), VALUATION, PRICE_PER_TOKEN, deadline, MIN_FUNDING_BPS)
            .accounts({
                authority: authority.publicKey,
                propertyToken,
                tokenMint: tokenMintKp.publicKey,
                fundingVault,
                usdcVault,
                usdcMint,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOC_TOKEN_PROGRAM,
                systemProgram: SystemProgram.programId,
            })
            .signers([tokenMintKp])
            .rpc();
        ok(`매물 초기화: ${LISTING_ID}`);

        // tokenMint 저장
        const savedData = JSON.parse(fs.readFileSync(WALLETS_PATH, "utf8"));
        savedData.tokenMint = tokenMint.toBase58();
        savedData.listingId = LISTING_ID;
        fs.writeFileSync(WALLETS_PATH, JSON.stringify(savedData, null, 2));
    } else {
        const savedData = JSON.parse(fs.readFileSync(WALLETS_PATH, "utf8"));
        tokenMint = new PublicKey(savedData.tokenMint);
        ok(`매물 이미 존재: ${LISTING_ID}`);
    }

    // investor1 투자 (20 tokens)
    for (const [name, kp, amount] of [["investor1", investor1, 20], ["investor2", investor2, 15]] as [string, Keypair, number][]) {
        const investorProvider = new AnchorProvider(connection, new Wallet(kp), { commitment: "confirmed" });
        const investorRwaProgram = new Program(RWA_IDL, investorProvider);
        const investorPosition = getInvestorPositionPda(propertyToken, kp.publicKey);
        const posInfo = await connection.getAccountInfo(investorPosition);
        if (posInfo) {
            ok(`${name} 이미 투자 완료`);
            continue;
        }

        const investorUsdcAta = getAssociatedTokenAddressSync(usdcMint, kp.publicKey, false, TOKEN_PROGRAM_ID);
        const investorRwaAta  = getAssociatedTokenAddressSync(tokenMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);

        // open_position
        await (investorRwaProgram.methods as any)
            .openPosition(LISTING_ID)
            .accounts({ investor: kp.publicKey, propertyToken, investorPosition })
            .rpc();

        // purchase_tokens
        await (investorRwaProgram.methods as any)
            .purchaseTokens(LISTING_ID, new BN(amount))
            .accounts({
                investor: kp.publicKey,
                propertyToken,
                tokenMint,
                investorPosition,
                investorUsdcAccount: investorUsdcAta,
                fundingVault,
                investorRwaAccount: investorRwaAta,
                usdcMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                usdcTokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
        ok(`${name} ${amount} RWA 토큰 구매 완료`);
    }

    // ── 6. ReleaseFunds + ActivateProperty ───────────────────────────────────
    section("6. ReleaseFunds → ActivateProperty (Active 전환)");

    // PropertyToken 현재 상태 조회
    const ptData = await (rwaProgram.account as any).propertyToken.fetch(propertyToken);
    const currentStatus = Object.keys(ptData.status)[0]; // "funding" | "funded" | "active" | "failed"

    if (currentStatus === "active") {
        ok(`매물 이미 Active 상태 — skip`);
    } else {
        // authority USDC ATA 준비
        const authorityUsdcAta = await getOrCreateAssociatedTokenAccount(
            connection, authority, usdcMint, authority.publicKey, false, undefined, undefined, TOKEN_PROGRAM_ID
        );

        if (currentStatus === "funding") {
            // deadline이 지날 때까지 대기
            const deadlineTs = Number(ptData.fundingDeadline);
            const nowTs = Math.floor(Date.now() / 1000);
            const waitSecs = deadlineTs - nowTs + 2;
            if (waitSecs > 60) {
                console.log(`
  ─────────────────────────────────────────────────────
  [주의] 기존 매물의 펀딩 마감이 ${Math.ceil(waitSecs / 86400)}일 후입니다.
         이전 실행에서 생성된 매물(deadline 30일)이 남아 있습니다.

  해결 방법:
    1. validator 재시작:  solana-test-validator --reset
    2. 스크립트 재실행:   npx tsx scripts/12_ui_test_setup.ts
  ─────────────────────────────────────────────────────
`);
                process.exit(0);
            }
            if (waitSecs > 0) {
                info(`펀딩 마감까지 ${waitSecs}초 대기...`);
                await sleep(waitSecs * 1000);
            }

            await (rwaProgram.methods as any)
                .releaseFunds(LISTING_ID)
                .accounts({
                    propertyToken,
                    operator: authority.publicKey,
                    rwaConfig,
                    fundingVault,
                    authorityUsdcAccount: authorityUsdcAta.address,
                    usdcMint,
                    usdcTokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOC_TOKEN_PROGRAM,
                    systemProgram: SystemProgram.programId,
                })
                .signers([authority])
                .rpc();
            ok("releaseFunds 완료 (Funded 전환)");
        }

        // Funded → Active
        await (rwaProgram.methods as any)
            .activateProperty(LISTING_ID)
            .accounts({
                propertyToken,
                operator: authority.publicKey,
                rwaConfig,
                tokenMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();
        ok("activateProperty 완료 (Active 전환)");
    }

    // ── 8. 테스트 제안 생성 (council1이 생성) ───────────────────────────────
    section("8. 테스트 제안 생성");

    const councilProvider = new AnchorProvider(connection, new Wallet(council1), { commitment: "confirmed" });
    const councilDaoProgram = new Program(DAO_IDL, councilProvider);

    const daoConfigData = await (daoProgram.account as any).daoConfig.fetch(daoConfig);
    const currentProposalCount = Number(daoConfigData.proposalCount);

    const proposalPda = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(currentProposalCount)); return b; })()],
        DAO_PROGRAM_ID
    )[0];
    const proposalInfo = await connection.getAccountInfo(proposalPda);

    if (proposalInfo) {
        ok(`제안 #${currentProposalCount} 이미 존재 — skip`);
    } else {
        const council1CouncilAta = getAssociatedTokenAddressSync(
            councilMint, council1.publicKey, false, TOKEN_2022_PROGRAM_ID
        );

        // voting_period = 0 → DaoConfig 기본값(10초) 사용
        await (councilDaoProgram.methods as any)
            .createProposal(
                "UI 테스트용 안건 — 거버넌스 투표 기능 검증",
                "",
                { operations: {} },
                new BN(0),
            )
            .accounts({
                creator: council1.publicKey,
                daoConfig,
                proposal: proposalPda,
                creatorCouncilAta: council1CouncilAta,
                councilMint,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts([
                { pubkey: propertyToken, isWritable: false, isSigner: false },
            ])
            .signers([council1])
            .rpc();
        ok(`제안 #${currentProposalCount} 생성 완료 (투표 기간 10초)`);
    }

    // ── 9. 결과 출력 ─────────────────────────────────────────────────────────
    section("9. Backpack 임포트 키 (복사해서 사용)");

    const roles = [
        { name: "council1   (제안 생성)", kp: council1 },
        { name: "investor1  (투표 — 20 RWA)", kp: investor1 },
        { name: "investor2  (투표 — 15 RWA)", kp: investor2 },
    ];

    for (const { name, kp } of roles) {
        console.log(`\n  [${name}]`);
        console.log(`    Public Key : ${kp.publicKey.toBase58()}`);
        console.log(`    Secret Key : ${toBase58(kp)}`);
    }

    console.log(`
  ─────────────────────────────────────────────────────
  테스트 순서:
    1. localhost:5173/governance 접속
    2. investor1 또는 investor2 지갑 연결 → 투표하기 (찬성/반대/기권)
    3. 10초 후 제안 페이지 새로고침 → 자동 finalize
  ─────────────────────────────────────────────────────

  저장 위치: ${WALLETS_PATH}
  (재실행 시 동일 keypair 재사용됨)
`);
}

main().catch((err) => {
    console.error("\n  [FATAL]", err);
    process.exit(1);
});
