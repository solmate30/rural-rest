/**
 * 07-dao.ts — DAO 제안 생성 → 투표 → 가결
 *
 * - crank 지갑(Council Token 보유)이 제안 생성
 * - investor1, investor2 찬성 투표 (e2e001 RWA 보유)
 * - voting_period 경과 후 finalize → Succeeded 확인
 *
 * 실행: cd web && npx tsx scripts/scenario/07-dao.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
    getOrCreateAssociatedTokenAccount, mintTo,
    getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bs58 from "bs58";
import { loadState, kp } from "./_state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../.env") });

const RPC_URL        = "http://127.0.0.1:8899";
const RWA_PROGRAM_ID = new PublicKey(process.env.VITE_RWA_PROGRAM_ID!);
const DAO_PROGRAM_ID = new PublicKey(process.env.VITE_DAO_PROGRAM_ID!);
const COUNCIL_MINT   = new PublicKey(process.env.VITE_COUNCIL_MINT!);

const LISTING_ACTIVE = "e2e001";

const IDL     = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_rwa.json"), "utf-8"));
const DAO_IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../../app/anchor-idl/rural_rest_dao.json"), "utf-8"));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log("=== [07] DAO 제안 → 투표 → 가결 ===\n");

    if (!process.env.CRANK_SECRET_KEY) { console.error("CRANK_SECRET_KEY 미설정"); process.exit(1); }

    const state    = loadState();
    const adminKp  = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8")))
    );
    const investor1 = kp(state.investor1);
    const investor2 = kp(state.investor2);
    const crank     = Keypair.fromSecretKey(bs58.decode(process.env.CRANK_SECRET_KEY!));

    const connection    = new Connection(RPC_URL, "confirmed");
    const adminProvider = new AnchorProvider(connection, new Wallet(adminKp), { commitment: "confirmed" });
    const crankProvider = new AnchorProvider(
        connection,
        {
            publicKey: crank.publicKey,
            signTransaction: async (tx: any) => { tx.sign(crank); return tx; },
            signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.sign(crank)); return txs; },
        } as any,
        { commitment: "confirmed" }
    );

    const daoProgram      = new Program(DAO_IDL as any, adminProvider);
    const crankDaoProgram = new Program(DAO_IDL as any, crankProvider);

    const rwaPda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, RWA_PROGRAM_ID)[0];
    const daoPda = (seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, DAO_PROGRAM_ID)[0];

    const pt1       = rwaPda([Buffer.from("property"), Buffer.from(LISTING_ACTIVE)]);
    const daoConfig = daoPda([Buffer.from("dao_config")]);

    // DaoConfig 확인
    let daoCfg: any;
    try {
        daoCfg = await (daoProgram.account as any).daoConfig.fetch(daoConfig);
    } catch {
        console.error("DaoConfig 없음. setup-localnet.ts를 먼저 실행하세요.");
        process.exit(1);
    }
    const votingPeriod = daoCfg.votingPeriod.toNumber();
    console.log(`  DaoConfig OK — voting_period: ${votingPeriod}초, quorum: ${daoCfg.quorumBps / 100}%`);

    // crank에게 Council Token 발급 (없는 경우)
    const councilAta = await getOrCreateAssociatedTokenAccount(
        connection, adminKp, COUNCIL_MINT, crank.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID
    );
    const councilBal = Number((await connection.getTokenAccountBalance(councilAta.address)).value.amount);
    if (councilBal === 0) {
        await mintTo(connection, crank, COUNCIL_MINT, councilAta.address, crank, 1, [], undefined, TOKEN_2022_PROGRAM_ID);
        console.log("  Council Token 발급 완료");
    } else {
        console.log(`  Council Token 이미 보유 (${councilBal}개)`);
    }

    // 제안 생성
    const proposalId = daoCfg.proposalCount.toNumber();
    const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), new BN(proposalId).toArrayLike(Buffer, "le", 8)],
        DAO_PROGRAM_ID
    );

    await (crankDaoProgram.methods as any)
        .createProposal(
            `E2E 검증 제안 #${proposalId}`,
            "https://arweave.net/e2e-test",
            { operations: {} },
            new BN(0),
        )
        .accounts({
            creator: crank.publicKey,
            daoConfig,
            proposal: proposalPda,
            creatorCouncilAta: councilAta.address,
            councilMint: COUNCIL_MINT,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([
            { pubkey: pt1, isWritable: false, isSigner: false },
        ])
        .rpc();

    const proposal = await (daoProgram.account as any).proposal.fetch(proposalPda);
    console.log(`  제안 생성: id=${proposalId}, totalEligibleWeight=${proposal.totalEligibleWeight.toNumber()}`);

    // investor1, investor2 찬성 투표
    const castVote = async (investor: Keypair, label: string) => {
        const provider = new AnchorProvider(connection, new Wallet(investor), { commitment: "confirmed" });
        const prog     = new Program(DAO_IDL as any, provider);
        const posPda   = rwaPda([Buffer.from("investor"), pt1.toBuffer(), investor.publicKey.toBuffer()]);
        const [voteRecord] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), new BN(proposalId).toArrayLike(Buffer, "le", 8), investor.publicKey.toBuffer()],
            DAO_PROGRAM_ID
        );

        await (prog.methods as any)
            .castVote({ for: {} })
            .accounts({
                voter: investor.publicKey,
                daoConfig,
                proposal: proposalPda,
                voteRecord,
                voterCouncilAta: null,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts([
                { pubkey: pt1,    isWritable: false, isSigner: false },
                { pubkey: posPda, isWritable: false, isSigner: false },
            ])
            .rpc();

        const rec = await (daoProgram.account as any).voteRecord.fetch(voteRecord);
        console.log(`  ${label}: 찬성 raw=${rec.rawWeight.toNumber()} → weight=${rec.weight.toNumber()}`);
    };

    await castVote(investor1, "investor1(30토큰)");
    await castVote(investor2, "investor2(30토큰)");

    const afterVote = await (daoProgram.account as any).proposal.fetch(proposalPda);
    console.log(`  현재 votesFor: ${afterVote.votesFor.toNumber()}`);

    // voting_period 대기 후 finalize
    console.log(`  ${votingPeriod}초 투표 기간 대기 중...`);
    await sleep((votingPeriod + 2) * 1000);

    await (daoProgram.methods as any)
        .finalizeProposal()
        .accounts({ daoConfig, proposal: proposalPda })
        .rpc();

    const final = await (daoProgram.account as any).proposal.fetch(proposalPda);
    console.log(`\n  결과: ${JSON.stringify(final.status)}  (expected: {succeeded:{}})`);

    if (!final.status.succeeded) throw new Error(`제안이 succeeded여야 합니다: ${JSON.stringify(final.status)}`);

    console.log("\n===========================================");
    console.log("  E2E 전체 시나리오 완료");
    console.log("===========================================");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
