import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import IDL from "~/anchor-idl/rural_rest_dao.json";
import RWA_IDL from "~/anchor-idl/rural_rest_rwa.json";

import { RPC_URL, SERVER_DAO_PROGRAM_ID, SERVER_PROGRAM_ID } from "~/lib/constants.server";

// Singleton connection (rwa.onchain.server.ts와 동일 패턴)
let _connection: Connection | null = null;
function getConnection() {
    if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
    return _connection;
}

const dummyWallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
};

function getDaoProgram() {
    const provider = new AnchorProvider(getConnection(), dummyWallet as any, {
        commitment: "confirmed",
    });
    return new Program(IDL as any, provider);
}

function getRwaProgram() {
    const provider = new AnchorProvider(getConnection(), dummyWallet as any, {
        commitment: "confirmed",
    });
    return new Program(RWA_IDL as any, provider);
}

/**
 * RWA 프로그램 온체인에서 Active 상태 PropertyToken의 listingId 목록 조회
 * DB 대신 온체인을 직접 쿼리하므로 항상 최신 상태를 반영
 */
export async function fetchActiveListingIds(): Promise<string[]> {
    try {
        const program = getRwaProgram();
        const accounts = await (program.account as any).propertyToken.all();
        // Active 상태만 투표권 부여 (Funding/Funded는 환불 가능성 있음)
        return accounts
            .filter((a: any) => a.account.status?.active !== undefined)
            .map((a: any) => a.account.listingId as string);
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (msg.includes("ECONNREFUSED") || msg.includes("Account does not exist")) {
            return [];
        }
        console.error("[dao.onchain] fetchActiveListingIds failed:", msg);
        return [];
    }
}

// =====================
// Types
// =====================

export type ProposalStatus = "voting" | "succeeded" | "defeated" | "cancelled";
export type ProposalCategory = "operations" | "guidelines" | "fundUsage" | "other";

export interface DaoConfigData {
    authority: string;
    councilMint: string;
    votingPeriod: number;
    quorumBps: number;
    approvalThresholdBps: number;
    votingCapBps: number;
    proposalCount: number;
    rwaProgram: string;
}

export interface ProposalData {
    id: number;
    pda: string;
    creator: string;
    title: string;
    descriptionUri: string;
    category: ProposalCategory;
    status: ProposalStatus;
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    totalEligibleWeight: number;
    voterCount: number;
    votingStartsAt: number;
    votingEndsAt: number;
    createdAt: number;
}

// =====================
// Parsers
// =====================

function parseProposalStatus(raw: any): ProposalStatus {
    if (raw?.succeeded !== undefined) return "succeeded";
    if (raw?.defeated !== undefined) return "defeated";
    if (raw?.cancelled !== undefined) return "cancelled";
    return "voting";
}

function parseProposalCategory(raw: any): ProposalCategory {
    if (raw?.guidelines !== undefined) return "guidelines";
    if (raw?.fundUsage !== undefined) return "fundUsage";
    if (raw?.other !== undefined) return "other";
    return "operations";
}

// =====================
// Fetchers
// =====================

export async function fetchDaoConfig(): Promise<DaoConfigData | null> {
    try {
        const program = getDaoProgram();
        const programId = new PublicKey(SERVER_DAO_PROGRAM_ID);
        const [daoConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("dao_config")],
            programId
        );

        const data = await (program.account as any).daoConfig.fetch(daoConfigPda);

        return {
            authority: data.authority.toBase58(),
            councilMint: data.councilMint.toBase58(),
            votingPeriod: Number(data.votingPeriod),
            quorumBps: data.quorumBps,
            approvalThresholdBps: data.approvalThresholdBps,
            votingCapBps: data.votingCapBps,
            proposalCount: Number(data.proposalCount),
            rwaProgram: data.rwaProgram.toBase58(),
        };
    } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (
            msg.includes("Account does not exist") ||
            msg.includes("has no data") ||
            msg.includes("ECONNREFUSED")
        ) {
            return null;
        }
        console.error("[dao.onchain] fetchDaoConfig failed:", msg);
        return null;
    }
}

export async function fetchProposal(proposalId: number): Promise<ProposalData | null> {
    try {
        const program = getDaoProgram();
        const programId = new PublicKey(SERVER_DAO_PROGRAM_ID);

        const idBuf = Buffer.alloc(8);
        idBuf.writeBigUInt64LE(BigInt(proposalId));
        const [proposalPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("proposal"), idBuf],
            programId
        );

        const data = await (program.account as any).proposal.fetch(proposalPda);

        return {
            id: Number(data.id),
            pda: proposalPda.toBase58(),
            creator: data.creator.toBase58(),
            title: data.title,
            descriptionUri: data.descriptionUri,
            category: parseProposalCategory(data.category),
            status: parseProposalStatus(data.status),
            votesFor: Number(data.votesFor),
            votesAgainst: Number(data.votesAgainst),
            votesAbstain: Number(data.votesAbstain),
            totalEligibleWeight: Number(data.totalEligibleWeight),
            voterCount: Number(data.voterCount ?? 0),
            votingStartsAt: Number(data.votingStartsAt),
            votingEndsAt: Number(data.votingEndsAt),
            createdAt: Number(data.createdAt),
        };
    } catch {
        return null;
    }
}

export async function fetchAllProposals(proposalCount: number): Promise<ProposalData[]> {
    if (proposalCount === 0) return [];

    // 순차 PDA derive + batch fetch
    const fetches = Array.from({ length: proposalCount }, (_, i) => fetchProposal(i));
    const results = await Promise.all(fetches);
    return results.filter((p): p is ProposalData => p !== null);
}

/**
 * finalize 후 GitHub Issue에 투표 결과 코멘트 추가 + 이슈 닫기
 * GITHUB_TOKEN, GITHUB_DAO_REPO 미설정 시 silent skip
 */
async function updateGithubIssueOnFinalize(proposal: ProposalData): Promise<void> {
    const token = process.env.GITHUB_TOKEN;
    const match = proposal.descriptionUri?.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (!token || !match) return;

    const [, repo, issueNumber] = match;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    };

    const total = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const forPct  = total > 0 ? ((proposal.votesFor  / total) * 100).toFixed(1) : "0.0";
    const agtPct  = total > 0 ? ((proposal.votesAgainst / total) * 100).toFixed(1) : "0.0";
    const absPct  = total > 0 ? ((proposal.votesAbstain / total) * 100).toFixed(1) : "0.0";
    const label   = proposal.status === "succeeded" ? "통과" : "부결";
    const emoji   = proposal.status === "succeeded" ? "✅" : "❌";

    const commentBody = [
        `## ${emoji} 투표 결과: **${label}**`,
        "",
        "| 항목 | 수치 |",
        "|---|---|",
        `| 찬성 | ${proposal.votesFor} (${forPct}%) |`,
        `| 반대 | ${proposal.votesAgainst} (${agtPct}%) |`,
        `| 기권 | ${proposal.votesAbstain} (${absPct}%) |`,
        `| 총 투표 가중치 | ${proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain} / ${proposal.totalEligibleWeight} |`,
        "",
        `*온체인에서 자동으로 확정되었습니다. Proposal #${proposal.id}*`,
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
                state_reason: proposal.status === "succeeded" ? "completed" : "not_planned",
            }),
        });

        console.log(`[dao.onchain] GitHub issue #${issueNumber} 닫힘 (${label})`);
    } catch (err: any) {
        console.error("[dao.onchain] GitHub issue 업데이트 실패 (finalize는 성공):", err?.message ?? err);
    }
}

/**
 * 투표 기간이 만료된 proposal을 서버에서 자동 finalize (permissionless)
 * 성공 시 갱신된 proposal 반환, 실패 시 null
 */
export async function tryAutoFinalize(proposalId: number): Promise<ProposalData | null> {
    try {
        const connection = getConnection();
        const programId = new PublicKey(SERVER_DAO_PROGRAM_ID);

        // finalize는 permissionless — 일회용 keypair으로 서명
        const payer = Keypair.generate();

        // Airdrop SOL for tx fee (localnet/devnet only)
        const sig = await connection.requestAirdrop(payer.publicKey, 10_000_000);
        await connection.confirmTransaction(sig, "confirmed");

        const provider = new AnchorProvider(
            connection,
            {
                publicKey: payer.publicKey,
                signTransaction: async (tx: any) => { tx.sign(payer); return tx; },
                signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.sign(payer)); return txs; },
            } as any,
            { commitment: "confirmed" }
        );
        const program = new Program(IDL as any, provider);

        const [daoConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("dao_config")],
            programId
        );
        const idBuf = Buffer.alloc(8);
        idBuf.writeBigUInt64LE(BigInt(proposalId));
        const [proposalPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("proposal"), idBuf],
            programId
        );

        await (program.methods as any)
            .finalizeProposal()
            .accounts({
                daoConfig: daoConfigPda,
                proposal: proposalPda,
            })
            .rpc();

        // 갱신된 proposal 다시 조회
        const updated = await fetchProposal(proposalId);
        // finalize 직후 GitHub Issue 결과 업데이트
        if (updated && (updated.status === "succeeded" || updated.status === "defeated")) {
            await updateGithubIssueOnFinalize(updated);
        }
        return updated;
    } catch (err: any) {
        console.error("[dao.onchain] tryAutoFinalize failed:", String(err?.message ?? err));
        return null;
    }
}

/**
 * Active 상태 PropertyToken PDA 목록 조회 (create_proposal remaining_accounts용)
 * listingIds를 받아 각각 PropertyToken PDA를 derive하고, Active인 것만 반환
 */
export async function fetchActivePropertyTokenPdas(
    listingIds: string[]
): Promise<string[]> {
    const rwaProgramId = new PublicKey(SERVER_PROGRAM_ID);
    const activePdas: string[] = [];

    for (const lid of listingIds) {
        try {
            const [pt] = PublicKey.findProgramAddressSync(
                [Buffer.from("property"), Buffer.from(lid)],
                rwaProgramId
            );

            // rwa.onchain.server.ts를 직접 사용하지 않고 독립적으로 체크
            const connection = getConnection();
            const accountInfo = await connection.getAccountInfo(pt);
            if (accountInfo && accountInfo.data.length > 0) {
                // Active 상태인지 확인 (8바이트 discriminator + 필드 offset)
                // 간단히: PDA가 존재하면 포함 (loader에서 DB 기준 active만 넘김)
                activePdas.push(pt.toBase58());
            }
        } catch {
            // skip
        }
    }

    return activePdas;
}
