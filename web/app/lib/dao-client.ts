/**
 * 클라이언트 컴포넌트용 DAO Anchor 유틸리티.
 * anchor-client.ts (RWA)와 동일한 패턴.
 */
import type { Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { DAO_PROGRAM_ID, PROGRAM_ID } from "~/lib/constants";
import { parseAnchorError } from "~/lib/anchor-client";

/**
 * DAO Program 인스턴스 생성
 */
export async function getDaoProgram(connection: Connection, wallet: WalletContextState) {
    const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
    const { default: IDL } = await import("~/anchor-idl/rural_rest_dao.json");

    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
    return new Program(IDL as any, provider);
}

/**
 * DAO PDA 파생 헬퍼
 */
export async function getDaoConfigPda() {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(DAO_PROGRAM_ID);
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("dao_config")],
        programId
    );
    return pda;
}

export async function getProposalPda(proposalId: number) {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(DAO_PROGRAM_ID);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(proposalId));
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("proposal"), idBuf],
        programId
    );
    return pda;
}

export async function getVoteRecordPda(proposalId: number, voter: import("@solana/web3.js").PublicKey) {
    const { PublicKey } = await import("@solana/web3.js");
    const programId = new PublicKey(DAO_PROGRAM_ID);
    const idBuf = Buffer.alloc(8);
    idBuf.writeBigUInt64LE(BigInt(proposalId));
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vote"), idBuf, voter.toBuffer()],
        programId
    );
    return pda;
}

/**
 * 투표자의 InvestorPosition PDA 조회
 * activeListingIds에서 각 매물에 대한 position PDA를 derive하고 존재하는 것만 반환
 */
export async function fetchVoterPositions(
    connection: Connection,
    voter: import("@solana/web3.js").PublicKey,
    activeListingIds: string[],
): Promise<{ pubkey: import("@solana/web3.js").PublicKey; propertyTokenPda: import("@solana/web3.js").PublicKey; listingId: string }[]> {
    const { PublicKey } = await import("@solana/web3.js");
    const rwaProgramId = new PublicKey(PROGRAM_ID);

    // 각 매물에 대한 PropertyToken + InvestorPosition PDA derive
    const candidates = activeListingIds.map((lid) => {
        const [propertyTokenPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(lid)],
            rwaProgramId
        );
        const [positionPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), propertyTokenPda.toBuffer(), voter.toBuffer()],
            rwaProgramId
        );
        return { pubkey: positionPda, propertyTokenPda, listingId: lid };
    });

    // batch check: getMultipleAccountsInfo로 존재 여부 확인
    const pubkeys = candidates.map((c) => c.pubkey);
    const accounts = await connection.getMultipleAccountsInfo(pubkeys);

    return candidates.filter((_, i) => accounts[i] !== null);
}

/**
 * Council Token 잔액 확인
 */
export async function checkCouncilTokenBalance(
    connection: Connection,
    councilMint: string,
    wallet: import("@solana/web3.js").PublicKey,
): Promise<number> {
    try {
        const { PublicKey } = await import("@solana/web3.js");
        const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");
        const mintPk = new PublicKey(councilMint);
        const ata = getAssociatedTokenAddressSync(mintPk, wallet, false, TOKEN_2022_PROGRAM_ID);
        const balance = await connection.getTokenAccountBalance(ata);
        return Number(balance.value.amount);
    } catch {
        return 0;
    }
}

/**
 * VoteRecord 존재 여부 확인
 */
export async function fetchVoteRecord(
    connection: Connection,
    wallet: WalletContextState,
    proposalId: number,
    voter: import("@solana/web3.js").PublicKey,
): Promise<{ voteType: string; weight: number; rawWeight: number } | null> {
    try {
        const program = await getDaoProgram(connection, wallet);
        const voteRecordPda = await getVoteRecordPda(proposalId, voter);
        const data = await (program.account as any).voteRecord.fetch(voteRecordPda);

        let voteType = "for";
        if (data.voteType?.against !== undefined) voteType = "against";
        if (data.voteType?.abstain !== undefined) voteType = "abstain";

        return {
            voteType,
            weight: Number(data.weight),
            rawWeight: Number(data.rawWeight),
        };
    } catch {
        return null;
    }
}

/**
 * Active PropertyToken PDA 목록 derive (create_proposal remaining_accounts용)
 */
export async function derivePropertyTokenPdas(
    activeListingIds: string[],
    connection?: Connection,
): Promise<import("@solana/web3.js").PublicKey[]> {
    const { PublicKey } = await import("@solana/web3.js");
    const rwaProgramId = new PublicKey(PROGRAM_ID);

    const pdas = activeListingIds.map((lid) => {
        const [pt] = PublicKey.findProgramAddressSync(
            [Buffer.from("property"), Buffer.from(lid)],
            rwaProgramId
        );
        return pt;
    });

    // connection이 있으면 온체인에 실제 존재하고 RWA 프로그램 소유인 계정만 반환
    // (DB에는 active이지만 로컬 validator에 없는 계정 제외)
    if (connection && pdas.length > 0) {
        const infos = await connection.getMultipleAccountsInfo(pdas);
        return pdas.filter((_, i) => {
            const info = infos[i];
            return info !== null && info.owner.toBase58() === PROGRAM_ID;
        });
    }

    return pdas;
}

/**
 * DAO 에러 메시지 파싱
 */
const DAO_ERRORS: Record<string, string> = {
    "InsufficientCouncilTokens": "Council Token이 없어 제안을 생성할 수 없습니다",
    "VotingNotStarted": "투표가 아직 시작되지 않았습니다",
    "VotingEnded": "투표 기간이 종료되었습니다",
    "VotingNotEnded": "투표 기간이 아직 종료되지 않았습니다",
    "InvalidProposalStatus": "현재 제안 상태에서 실행할 수 없습니다",
    "NoVotingPower": "투표권이 없습니다 (RWA / Council 토큰 미보유)",
    "InvalidPositionOwner": "투표자 본인의 포지션이 아닙니다",
    "TitleTooLong": "제목이 128바이트를 초과합니다",
    "DescriptionUriTooLong": "설명 URI가 256바이트를 초과합니다",
    "Unauthorized": "권한이 없습니다",
    "DuplicatePropertyAccount": "중복된 매물 계정이 전달되었습니다",
    "DuplicatePositionAccount": "중복된 포지션 계정이 전달되었습니다",
    "InvalidCouncilAta": "Council Token ATA가 유효하지 않습니다",
    "InvalidCouncilAtaOwner": "Council Token ATA 소유자가 일치하지 않습니다",
};

export function parseDaoError(err: any): string {
    return parseAnchorError(err, DAO_ERRORS);
}

export { parseAnchorError };
