/**
 * create-proposal.ts — 데모용 DAO 제안 생성 스크립트
 *
 * 실행: cd web && npx tsx scripts/create-proposal.ts
 *
 * 전제조건:
 *   - solana-test-validator 실행 중
 *   - setup-localnet.ts 완료 (VITE_COUNCIL_MINT 설정됨)
 *   - 실행 계정에 Council Token 1개 이상 보유
 *     (npx tsx scripts/mint-council.ts <지갑주소>)
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import bs58 from "bs58";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const RPC_URL = "http://127.0.0.1:8899";
const DAO_PROGRAM_ID = "142FMJgEw2H4EYzqHk1mEsLoT4aDkfLJJ4UR5ELxmTU1";
const RWA_PROGRAM_ID = process.env.VITE_RWA_PROGRAM_ID!;

// ── 제안 내용 ─────────────────────────────────────────────────────────────────
const PROPOSAL_TITLE = "Revise Check-in/out Times and Cleaning Protocol for All Rural Rest Properties";
const PROPOSAL_MARKDOWN = `## Background

To improve operational efficiency during the 2026 peak season across all Rural Rest properties, we propose revisions to check-in/out times and the cleaning protocol.

## Proposal

1. **Check-in time**: Move from 15:00 → 14:00 (one hour earlier)
2. **Check-out time**: Extend from 11:00 → 12:00 (one hour later)
3. **Cleaning vendor**: Prioritize contracts with local cooperatives over current vendors

## Expected Benefits

- Improved guest satisfaction across all properties
- Local job creation in rural communities
- Estimated ~15% reduction in operating costs

## Voting Period

7 days from proposal submission
`;
const PROPOSAL_CATEGORY = { guidelines: {} };
const PROPOSAL_VOTING_DAYS = 7;
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const councilMintAddr = process.env.VITE_COUNCIL_MINT;
    if (!councilMintAddr) { console.error("VITE_COUNCIL_MINT 미설정"); process.exit(1); }

    // admin 키페어 사용 (81q7NbGd... — Council Token 보유)
    const proposer = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(
            path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
        )))
    );

    console.log(`Proposer:     ${proposer.publicKey.toBase58()}`);
    console.log(`Council Mint: ${councilMintAddr}`);

    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(connection, new Wallet(proposer), { commitment: "confirmed" });

    const IDL = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../app/anchor-idl/rural_rest_dao.json"), "utf-8")
    );
    const program = new Program({ ...IDL, address: DAO_PROGRAM_ID } as any, provider);

    const daoProgramPk = new PublicKey(DAO_PROGRAM_ID);
    const councilMint = new PublicKey(councilMintAddr);

    const [daoConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")], daoProgramPk
    );

    // 현재 proposal count 조회
    const cfg = await (program.account as any).daoConfig.fetch(daoConfigPda);
    const proposalCount: bigint = cfg.proposalCount ?? BigInt(0);
    console.log(`Proposal count: ${proposalCount}`);

    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(proposalCount.toString()));
    const [proposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), idBuf],
        daoProgramPk
    );

    const creatorCouncilAta = getAssociatedTokenAddressSync(
        councilMint, proposer.publicKey, false, TOKEN_2022_PROGRAM_ID
    );

    // active 매물의 PropertyToken PDA를 remainingAccounts로 전달
    const rwaProgramPk = new PublicKey(RWA_PROGRAM_ID);
    const { db } = await import("../app/db/index.server.js");
    const { rwaTokens } = await import("../app/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const activeTokens = await db.select({ listingId: rwaTokens.listingId })
        .from(rwaTokens)
        .where(eq(rwaTokens.status, "active"));

    const propertyPdas = activeTokens.map(({ listingId }) => {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(listingId.replace(/-/g, ""))], rwaProgramPk
        );
        return { pubkey: pda, isWritable: false, isSigner: false };
    });

    const periodSecs = new BN(PROPOSAL_VOTING_DAYS * 24 * 60 * 60);

    const sig = await (program.methods as any)
        .createProposal(PROPOSAL_TITLE, "http://localhost:5173/dao-proposal.md", PROPOSAL_CATEGORY, periodSecs)
        .accounts({
            creator: proposer.publicKey,
            daoConfig: daoConfigPda,
            proposal: proposalPda,
            creatorCouncilAta,
            councilMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(propertyPdas)
        .rpc();

    console.log(`\n제안 생성 완료!`);
    console.log(`tx:       ${sig}`);
    console.log(`Proposal: ${proposalPda.toBase58()}`);
    console.log(`Title:    ${PROPOSAL_TITLE}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
