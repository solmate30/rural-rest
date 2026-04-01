import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Button } from "~/components/ui/button";
import {
    getDaoProgram,
    getDaoConfigPda,
    getProposalPda,
    getVoteRecordPda,
    fetchVoterPositions,
    fetchVoteRecord,
    checkCouncilTokenBalance,
    parseDaoError,
} from "~/lib/dao-client";
import type { ProposalData } from "~/lib/dao.onchain.server";

const VOTE_TYPE_LABELS: Record<string, string> = {
    for: "찬성",
    against: "반대",
    abstain: "기권",
};

interface VotePanelProps {
    proposal: ProposalData;
    activeListingIds: string[];
    councilMint: string;
    onVoted?: () => void;
}

export function VotePanel({ proposal, activeListingIds, councilMint, onVoted }: VotePanelProps) {
    const wallet = useWallet();
    const { connection } = useConnection();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [existingVote, setExistingVote] = useState<{
        voteType: string;
        weight: number;
        rawWeight: number;
    } | null>(null);
    const [checkingVote, setCheckingVote] = useState(false);
    const [votingPower, setVotingPower] = useState<number | null>(null);
    const [rwaCount, setRwaCount] = useState(0);
    const [hasCouncilToken, setHasCouncilToken] = useState(false);

    // 기존 투표 확인 + 투표권 조회
    const checkStatus = useCallback(async () => {
        if (!wallet.publicKey || !connection) return;
        setCheckingVote(true);
        try {
            // VoteRecord 확인
            const record = await fetchVoteRecord(connection, wallet, proposal.id, wallet.publicKey);
            setExistingVote(record);

            // 투표권 조회 (RWA positions + council token)
            if (!record) {
                const positions = await fetchVoterPositions(connection, wallet.publicKey, activeListingIds);
                const councilBalance = await checkCouncilTokenBalance(connection, councilMint, wallet.publicKey);
                setRwaCount(positions.length);
                setHasCouncilToken(councilBalance > 0);
                setVotingPower(positions.length + (councilBalance > 0 ? 1 : 0));
            }
        } catch {
            // 무시
        } finally {
            setCheckingVote(false);
        }
    }, [wallet.publicKey, connection, proposal.id, activeListingIds]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const handleVote = async (voteType: "for" | "against" | "abstain") => {
        if (!wallet.publicKey || !wallet.signTransaction) return;
        setLoading(true);
        setError(null);

        try {
            const program = await getDaoProgram(connection, wallet);
            const { SystemProgram, PublicKey } = await import("@solana/web3.js");
            const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");

            const daoConfigPda = await getDaoConfigPda();
            const proposalPda = await getProposalPda(proposal.id);
            const voteRecordPda = await getVoteRecordPda(proposal.id, wallet.publicKey);

            // voter의 InvestorPosition PDAs (remaining_accounts)
            const positions = await fetchVoterPositions(connection, wallet.publicKey, activeListingIds);

            // Council Token ATA 확인 (Optional)
            const councilBalance = await checkCouncilTokenBalance(connection, councilMint, wallet.publicKey);
            const councilMintPk = new PublicKey(councilMint);
            const voterCouncilAta = councilBalance > 0
                ? getAssociatedTokenAddressSync(councilMintPk, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID)
                : null;

            const voteTypeArg =
                voteType === "for" ? { for: {} } :
                voteType === "against" ? { against: {} } :
                { abstain: {} };

            await (program.methods as any)
                .castVote(voteTypeArg)
                .accounts({
                    voter: wallet.publicKey,
                    daoConfig: daoConfigPda,
                    proposal: proposalPda,
                    voteRecord: voteRecordPda,
                    voterCouncilAta: voterCouncilAta,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(
                    positions.flatMap((p) => [
                        { pubkey: p.propertyTokenPda, isWritable: false, isSigner: false },
                        { pubkey: p.pubkey, isWritable: false, isSigner: false },
                    ])
                )
                .rpc({ commitment: "confirmed" });

            // confirmed 후 대기하여 서버 loader가 최신 데이터를 읽을 수 있도록
            await new Promise((r) => setTimeout(r, 1500));

            // 투표 결과 다시 조회
            await checkStatus();
            onVoted?.();
        } catch (err: any) {
            setError(parseDaoError(err));
        } finally {
            setLoading(false);
        }
    };

    // 지갑 미연결
    if (!wallet.publicKey) {
        return (
            <div className="text-center py-6 text-[#A1887F]">
                <p className="mt-2 text-sm font-medium">투표하려면 지갑을 연결하세요</p>
            </div>
        );
    }

    // 투표 기간 종료
    const now = Math.floor(Date.now() / 1000);
    if (proposal.status !== "voting" || now > proposal.votingEndsAt) {
        return null;
    }

    // 기존 투표 있음
    if (existingVote) {
        return (
            <div className="rounded-xl bg-[#FAF9F6] border border-[#D7CCC8]/50 p-5 text-center shadow-sm">
                <p className="text-sm font-bold text-[#3E2723]">
                    {VOTE_TYPE_LABELS[existingVote.voteType]}으로 투표했습니다
                </p>
            </div>
        );
    }

    // 로딩 중
    if (checkingVote) {
        return (
            <div className="text-center py-6 text-[#A1887F] text-sm font-medium">
                투표 상태 확인 중...
            </div>
        );
    }

    // 투표권 없음
    if (votingPower === 0) {
        return (
            <div className="text-center py-5">
                <p className="text-sm text-[#8D6E63] font-medium">투표권이 없습니다 (RWA / Council 토큰 미보유)</p>
                <a href="/invest" className="text-xs text-[#FFAB91] hover:text-[#8D6E63] font-bold hover:underline mt-2 inline-block transition-colors">
                    투자하여 거버넌스에 참여하세요
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <Button
                    variant="wood"
                    size="lg"
                    onClick={() => handleVote("for")}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-1.5 h-auto py-4 rounded-xl bg-[#5E6E5A] hover:bg-[#4A5746] text-white shadow-sm transition-transform active:scale-95"
                >
                    <span className="text-xs font-bold">찬성</span>
                </Button>
                <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => handleVote("against")}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-1.5 h-auto py-4 rounded-xl bg-[#A94438] hover:bg-[#8F372C] text-white shadow-sm transition-transform active:scale-95"
                >
                    <span className="text-xs font-bold">반대</span>
                </Button>
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleVote("abstain")}
                    disabled={loading}
                    className="flex flex-col items-center justify-center gap-1.5 h-auto py-4 rounded-xl border-[#D7CCC8] text-[#5D4037] hover:bg-[#FAF9F6] hover:border-[#8D6E63] shadow-sm transition-all active:scale-95"
                >
                    <span className="text-xs font-bold">기권</span>
                </Button>
            </div>

            {loading && (
                <div className="flex justify-center items-center gap-2 text-xs text-[#8D6E63] font-medium py-2">
                    <span className="w-3.5 h-3.5 border-2 border-[#8D6E63]/30 border-t-[#8D6E63] rounded-full animate-spin"></span>
                    트랜잭션 처리 중...
                </div>
            )}
            {error && (
                <p className="text-xs text-[#EF5350] text-center bg-[#FFEBEE] py-2 rounded-lg border border-[#FFCDD2]">{error}</p>
            )}
        </div>
    );
}
