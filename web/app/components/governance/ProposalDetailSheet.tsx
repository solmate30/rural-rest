import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { VotingProgressBar } from "./VotingProgressBar";
import { VotePanel } from "./VotePanel";
import {
    STATUS_LABELS,
    STATUS_STYLES,
    CATEGORY_LABELS,
    formatTimeRemaining,
    truncateAddress,
} from "./ProposalCard";
import type { ProposalData, DaoConfigData } from "~/lib/dao.onchain.server";
import {
    getDaoProgram,
    getDaoConfigPda,
    getProposalPda,
    parseDaoError,
} from "~/lib/dao-client";

interface ProposalDetailSheetProps {
    proposal: ProposalData | null;
    daoConfig: DaoConfigData;
    activeListingIds: string[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: () => void;
}

export function ProposalDetailSheet({
    proposal,
    daoConfig,
    activeListingIds,
    open,
    onOpenChange,
    onUpdated,
}: ProposalDetailSheetProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t } = useTranslation("governance") as any;
    const wallet = useWallet();
    const { connection } = useConnection();
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    if (!proposal) return null;

    const isVoting = proposal.status === "voting";
    const now = Math.floor(Date.now() / 1000);
    const votingEnded = now > proposal.votingEndsAt;
    const canFinalize = isVoting && votingEnded;
    const handleFinalize = async () => {
        if (!wallet.publicKey) return;
        setActionLoading(true);
        setActionError(null);
        try {
            const program = await getDaoProgram(connection, wallet);
            const daoConfigPda = await getDaoConfigPda();
            const proposalPda = await getProposalPda(proposal.id);

            await (program.methods as any)
                .finalizeProposal()
                .accounts({
                    daoConfig: daoConfigPda,
                    proposal: proposalPda,
                })
                .rpc();

            onUpdated?.();
        } catch (err: any) {
            setActionError(parseDaoError(err));
        } finally {
            setActionLoading(false);
        }
    };

    // 가결 판정 계산 (UI 표시용)
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const quorumThreshold = Math.ceil(
        (proposal.totalEligibleWeight * daoConfig.quorumBps) / 10000
    );
    const quorumMet = totalVoted >= quorumThreshold;
    const votesCast = proposal.votesFor + proposal.votesAgainst;
    const approvalPercent = votesCast > 0 ? Math.round((proposal.votesFor / votesCast) * 100) : 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="overflow-y-auto sm:max-w-md border-l border-[#D7CCC8]/50 bg-[#FAF9F6] shadow-xl p-0">
                <div className="sticky top-0 bg-white z-10 px-6 py-5 border-b border-[#D7CCC8]/40 shadow-sm">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[12px] text-[#A1887F] font-mono bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#D7CCC8]/30">
                                #{(proposal.id + 1).toString().padStart(4, '0')}
                            </span>
                            <span
                                className={`text-[12px] font-bold px-3 py-1 rounded border uppercase tracking-wide ${STATUS_STYLES[proposal.status]}`}
                            >
                                {STATUS_LABELS[proposal.status]}
                            </span>
                        </div>
                        <SheetTitle className="text-left text-xl font-bold text-[#3E2723] leading-tight mt-3">
                            {proposal.title}
                        </SheetTitle>
                    </SheetHeader>
                </div>

                <div className="px-6 py-6 space-y-8">
                    {/* 메타 정보 */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg bg-white border border-[#D7CCC8]/40 p-4">
                            <p className="text-xs text-[#8D6E63] mb-1 font-semibold">분류</p>
                            <p className="font-bold text-[#3E2723]">
                                {CATEGORY_LABELS[proposal.category]}
                            </p>
                        </div>
                        <div className="rounded-lg bg-white border border-[#D7CCC8]/40 p-4">
                            <p className="text-xs text-[#8D6E63] mb-1 font-semibold">
                                {isVoting ? "남은 시간" : "안건 상정일"}
                            </p>
                            <p className={`font-bold ${isVoting ? 'text-[#FFAB91]' : 'text-[#3E2723]'}`}>
                                {isVoting
                                    ? formatTimeRemaining(proposal.votingEndsAt, t)
                                    : new Date(proposal.createdAt * 1000).toLocaleDateString()
                                }
                            </p>
                        </div>
                        <div className="rounded-lg bg-white border border-[#D7CCC8]/40 p-4">
                            <p className="text-xs text-[#8D6E63] mb-1 font-semibold">제안자 지갑</p>
                            <p className="font-mono font-medium text-[#5D4037] text-xs bg-[#FAF9F6] inline-block px-1.5 py-0.5 rounded border border-[#D7CCC8]/30">
                                {truncateAddress(proposal.creator)}
                            </p>
                        </div>
                        <div className="rounded-lg bg-white border border-[#D7CCC8]/40 p-4">
                            <p className="text-xs text-[#8D6E63] mb-1 font-semibold">총 투표권(가중치)</p>
                            <p className="font-bold text-[#3E2723]">
                                {proposal.totalEligibleWeight.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* 설명 URI */}
                    {proposal.descriptionUri && (
                        <div className="rounded-lg bg-white border border-[#D7CCC8]/50 p-5 shadow-sm">
                            <p className="text-xs font-bold text-[#8D6E63] mb-2">상세 문서 링크</p>
                            <a href={proposal.descriptionUri} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-sm text-[#FFAB91] hover:text-[#8D6E63] font-mono break-all bg-white py-3 px-4 rounded-lg border border-[#D7CCC8]/60 transition-colors">
                                <span className="truncate">{proposal.descriptionUri}</span>
                            </a>
                        </div>
                    )}

                    <div className="h-px bg-[#D7CCC8]/30"></div>

                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="text-xl font-bold text-[#3E2723]">실시간 투표 현황</h3>
                        </div>
                        <div className="bg-white rounded-lg p-5 border border-[#D7CCC8]/50 shadow-sm">
                            <VotingProgressBar
                                votesFor={proposal.votesFor}
                                votesAgainst={proposal.votesAgainst}
                                votesAbstain={proposal.votesAbstain}
                                totalEligibleWeight={proposal.totalEligibleWeight}
                                quorumBps={daoConfig.quorumBps}
                                voterCount={proposal.voterCount}
                            />
                            {votesCast > 0 && (
                                <div className="mt-4 pt-4 border-t border-[#D7CCC8]/30 flex justify-between items-center text-xs">
                                    <span className="text-[#8D6E63] font-semibold">현재 찬성률</span>
                                    <span className="font-bold text-[#3E2723] bg-[#FAF9F6] px-2 py-1 rounded border border-[#D7CCC8]/30">
                                        <span className="text-[#8D6E63]">{approvalPercent}%</span> 
                                        <span className="text-[#D7CCC8] mx-1">/</span>
                                        <span className="text-[#A1887F]">통과 기준 {daoConfig.approvalThresholdBps / 100}%</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {isVoting && !votingEnded && (
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <h3 className="text-xl font-bold text-[#3E2723]">내 권리 행사하기</h3>
                            </div>
                            <div className="bg-white rounded-lg p-5 border border-[#D7CCC8]/50 shadow-sm">
                                <VotePanel
                                    proposal={proposal}
                                    activeListingIds={activeListingIds}
                                    councilMint={daoConfig.councilMint}
                                    onVoted={onUpdated}
                                />
                            </div>
                        </div>
                    )}

                    {canFinalize && wallet.publicKey && (
                        <div className="space-y-3 pt-6 border-t border-[#D7CCC8]/30">
                            <Button
                                variant="wood"
                                onClick={handleFinalize}
                                disabled={actionLoading}
                                className="w-full bg-[#8D6E63] hover:bg-[#6D4C41] text-white shadow-sm"
                            >
                                안건 확정 및 실행 (Execute)
                            </Button>
                        </div>
                    )}

                    {actionError && (
                        <div className="mt-4 p-4 rounded-lg bg-[#FFEBEE] border border-[#FFCDD2] flex gap-2 text-[#EF5350] text-sm">
                            <p className="font-medium">{actionError}</p>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
