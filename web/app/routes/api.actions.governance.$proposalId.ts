/**
 * Solana Blinks — DAO 거버넌스 투표
 *
 * GET  /api/actions/governance/:proposalId  → Action 메타데이터
 * POST /api/actions/governance/:proposalId  → 미서명 cast_vote 트랜잭션
 *
 * Blinks spec: https://docs.dialect.to/documentation/actions/specification
 *
 * 주의: Council Token만 보유하는 의원은 이 엔드포인트가 아닌 UI를 사용해야 함.
 * Blinks는 voter_council_ata를 Optional(null)로 전달하므로 RWA 포지션이 없으면
 * 온체인에서 NoVotingPower 에러가 발생함.
 */
import {
    Connection,
    PublicKey,
    Transaction,
    Keypair,
    SystemProgram,
    type AccountMeta,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { RPC_URL, SERVER_DAO_PROGRAM_ID, SERVER_PROGRAM_ID } from "~/lib/constants.server";
import { fetchProposal, fetchActiveListingIds } from "~/lib/dao.onchain.server";
import IDL from "~/anchor-idl/rural_rest_dao.json";
import type { Route } from "./+types/api.actions.governance.$proposalId";

// Blinks 필수 CORS 헤더
const BLINKS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Accept-Action-Version, X-Accept-Blockchain-Ids",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": "2.4",
    "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // devnet
};

function auditLog(event: Record<string, unknown>) {
    console.log("[AUDIT]", JSON.stringify({ ...event, ts: new Date().toISOString() }));
}

// Anchor VoteType enum → 객체 변환
const VOTE_TYPE_MAP: Record<string, object> = {
    for:     { for: {} },
    against: { against: {} },
    abstain: { abstain: {} },
};

const VOTE_LABEL_MAP: Record<string, string> = {
    for:     "찬성",
    against: "반대",
    abstain: "기권",
};

/**
 * 투표자의 InvestorPosition PDA 서버사이드 조회
 * cast_vote remaining_accounts용 [PropertyToken, InvestorPosition] 쌍 반환
 */
async function fetchVoterPositionsServer(
    connection: Connection,
    voterPubkey: PublicKey,
    activeListingIds: string[],
): Promise<{ propertyTokenPda: PublicKey; investorPositionPda: PublicKey }[]> {
    if (activeListingIds.length === 0) return [];

    const rwaProgramId = new PublicKey(SERVER_PROGRAM_ID);

    const candidates = activeListingIds.map((lid) => {
        const [propertyTokenPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(lid)],
            rwaProgramId
        );
        const [investorPositionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyTokenPda.toBuffer(), voterPubkey.toBuffer()],
            rwaProgramId
        );
        return { propertyTokenPda, investorPositionPda };
    });

    const positionPubkeys = candidates.map((c) => c.investorPositionPda);
    const accountInfos = await connection.getMultipleAccountsInfo(positionPubkeys);

    return candidates.filter((_, i) => accountInfos[i] !== null);
}

// OPTIONS preflight
export async function loader({ params, request }: Route.LoaderArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const proposalId = parseInt(params.proposalId ?? "", 10);
    if (isNaN(proposalId) || proposalId < 0) {
        return Response.json(
            { message: "유효하지 않은 제안 ID입니다" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    const proposal = await fetchProposal(proposalId);
    if (!proposal) {
        return Response.json(
            { message: "제안을 찾을 수 없습니다" },
            { status: 404, headers: BLINKS_HEADERS }
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const isVoting = proposal.status === "voting" && now <= proposal.votingEndsAt;

    const endsAt = new Date(proposal.votingEndsAt * 1000).toLocaleDateString("ko-KR");
    const description = isVoting
        ? `찬성 ${proposal.votesFor} · 반대 ${proposal.votesAgainst} · 기권 ${proposal.votesAbstain} | 마감 ${endsAt}`
        : `투표 종료 · 찬성 ${proposal.votesFor} · 반대 ${proposal.votesAgainst} · 기권 ${proposal.votesAbstain}`;

    const reqUrl = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto") ?? reqUrl.protocol.replace(":", "");
    const origin = `${proto}://${reqUrl.host}`;

    const actions = isVoting
        ? [
            { type: "transaction", label: "찬성", href: `${origin}/api/actions/governance/${proposalId}?voteType=for` },
            { type: "transaction", label: "반대", href: `${origin}/api/actions/governance/${proposalId}?voteType=against` },
            { type: "transaction", label: "기권", href: `${origin}/api/actions/governance/${proposalId}?voteType=abstain` },
          ]
        : [{ type: "transaction", label: "투표 종료됨", href: `${origin}/api/actions/governance/${proposalId}`, disabled: true }];

    return Response.json(
        {
            type: "action",
            title: proposal.title,
            icon: "https://rural-rest.vercel.app/logo.png",
            description,
            label: "투표하기",
            disabled: !isVoting,
            links: { actions },
        },
        { headers: BLINKS_HEADERS }
    );
}

// POST — 미서명 cast_vote 트랜잭션 반환
export async function action({ params, request }: Route.ActionArgs) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: BLINKS_HEADERS });
    }

    const proposalId = parseInt(params.proposalId ?? "", 10);
    if (isNaN(proposalId) || proposalId < 0) {
        return Response.json(
            { message: "유효하지 않은 제안 ID입니다" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    const url = new URL(request.url);
    const voteTypeStr = url.searchParams.get("voteType") ?? "";
    const voteTypeObj = VOTE_TYPE_MAP[voteTypeStr];
    if (!voteTypeObj) {
        return Response.json(
            { message: "voteType은 for, against, abstain 중 하나여야 합니다" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    const { account } = (await request.json()) as { account: string };
    if (!account) {
        return Response.json(
            { message: "account 필드가 필요합니다" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    // KYC 인증된 등록 사용자만 투표 가능
    const [voter] = await db
        .select({ id: userTable.id, kycVerified: userTable.kycVerified })
        .from(userTable)
        .where(eq(userTable.walletAddress, account));

    if (!voter) {
        auditLog({ action: "blinks_vote_rejected", reason: "unregistered", wallet: account, proposalId });
        return Response.json(
            { message: "rural-rest.com에 회원가입 후 지갑을 연결해주세요." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }
    if (!voter.kycVerified) {
        auditLog({ action: "blinks_vote_rejected", reason: "kyc_required", userId: voter.id, wallet: account, proposalId });
        return Response.json(
            { message: "KYC 인증이 필요합니다. rural-rest.com에서 인증 후 투표하세요." },
            { status: 403, headers: BLINKS_HEADERS }
        );
    }

    // 제안 조회 + 투표 기간 검증
    const proposal = await fetchProposal(proposalId);
    if (!proposal) {
        return Response.json(
            { message: "제안을 찾을 수 없습니다" },
            { status: 404, headers: BLINKS_HEADERS }
        );
    }

    const now = Math.floor(Date.now() / 1000);
    if (proposal.status !== "voting" || now > proposal.votingEndsAt) {
        return Response.json(
            { message: "투표 기간이 아닙니다" },
            { status: 400, headers: BLINKS_HEADERS }
        );
    }

    try {
        const connection = new Connection(RPC_URL, "confirmed");
        const voterPubkey = new PublicKey(account);
        const daoProgramId = new PublicKey(SERVER_DAO_PROGRAM_ID);

        // DAO PDA 도출
        const [daoConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("dao_config")],
            daoProgramId
        );

        const idBuf = Buffer.alloc(8);
        idBuf.writeBigUInt64LE(BigInt(proposalId));
        const [proposalPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("proposal"), idBuf],
            daoProgramId
        );
        const [voteRecordPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vote"), idBuf, voterPubkey.toBuffer()],
            daoProgramId
        );

        // remaining_accounts 구성: 투표자의 Active 매물 InvestorPosition 쌍
        const [activeListingIds] = await Promise.all([fetchActiveListingIds()]);
        const positions = await fetchVoterPositionsServer(connection, voterPubkey, activeListingIds);

        const remainingAccounts: AccountMeta[] = positions.flatMap(
            ({ propertyTokenPda, investorPositionPda }) => [
                { pubkey: propertyTokenPda,    isSigner: false, isWritable: false },
                { pubkey: investorPositionPda, isSigner: false, isWritable: false },
            ]
        );

        // Anchor 프로그램 (더미 지갑 — 트랜잭션 빌드용)
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
        const program = new Program(IDL as any, provider);

        const tx: Transaction = await (program.methods as any)
            .castVote(voteTypeObj)
            .accounts({
                voter: voterPubkey,
                daoConfig: daoConfigPda,
                proposal: proposalPda,
                voteRecord: voteRecordPda,
                voterCouncilAta: null,   // Optional — Council Token 보유 의원은 UI 사용
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .remainingAccounts(remainingAccounts)
            .transaction();

        tx.feePayer = voterPubkey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        const serialized = tx.serialize({ requireAllSignatures: false });
        const base64Tx = Buffer.from(serialized).toString("base64");

        const voteLabel = VOTE_LABEL_MAP[voteTypeStr] ?? voteTypeStr;

        auditLog({
            action: "blinks_vote_tx_built",
            userId: voter.id,
            wallet: account,
            proposalId,
            voteType: voteTypeStr,
            positionCount: positions.length,
        });

        return Response.json(
            {
                type: "transaction",
                transaction: base64Tx,
                message: `제안 #${proposalId + 1} "${proposal.title}"에 ${voteLabel} 투표`,
            },
            { headers: BLINKS_HEADERS }
        );
    } catch (err: any) {
        auditLog({ action: "blinks_vote_error", userId: voter.id, wallet: account, proposalId, error: err?.message });
        console.error("[blinks/governance]", err?.message);
        return Response.json(
            { message: err?.message ?? "트랜잭션 생성 실패" },
            { status: 500, headers: BLINKS_HEADERS }
        );
    }
}
