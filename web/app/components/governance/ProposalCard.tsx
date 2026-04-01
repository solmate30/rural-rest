import type { ProposalData, ProposalStatus, ProposalCategory } from "~/lib/dao.onchain.server";

export const STATUS_LABELS: Record<ProposalStatus, string> = {
    voting: "투표중",
    succeeded: "가결",
    defeated: "부결",
    cancelled: "취소됨",
};

export const STATUS_STYLES: Record<ProposalStatus, string> = {
    voting: "bg-[#8D6E63] text-white",
    succeeded: "bg-[#D7CCC8] text-[#3E2723]",
    defeated: "bg-[#EFEBE9] text-[#A1887F]",
    cancelled: "bg-transparent border border-dashed border-[#D7CCC8] text-[#A1887F]",
};

export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
    operations: "운영",
    guidelines: "가이드라인",
    fundUsage: "자금 사용",
    other: "기타",
};

export function formatTimeRemaining(endsAt: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = endsAt - now;
    if (diff <= 0) return "종료됨";
    if (diff < 60) return `${diff}초 남음`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 남음`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 남음`;
    return `${Math.floor(diff / 86400)}일 남음`;
}

function formatDate(timestamp: number): string {
    const d = new Date(timestamp * 1000);
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function truncateAddress(addr: string): string {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

interface ProposalCardProps {
    proposal: ProposalData;
    quorumBps: number;
    onClick?: () => void;
}

export function ProposalCard({ proposal, onClick }: ProposalCardProps) {
    const isVoting = proposal.status === "voting";
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const forPercent = totalVoted > 0 ? Math.round((proposal.votesFor / totalVoted) * 100) : 0;
    const againstPercent = totalVoted > 0 ? Math.round((proposal.votesAgainst / totalVoted) * 100) : 0;

    return (
        <button
            onClick={onClick}
            className={`
                group w-full text-left p-6 sm:p-8 transition-all duration-500
                hover:shadow-lg hover:-translate-y-1 relative overflow-hidden bg-[#FCFBF8] border border-[#D7CCC8] shadow-sm
            `}
        >
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <span
                        className={`
                            inline-flex items-center text-[11px] font-bold px-3 py-1 tracking-widest
                            ${STATUS_STYLES[proposal.status]}
                        `}
                    >
                        {STATUS_LABELS[proposal.status]}
                    </span>
                    <span className="text-[12px] font-bold tracking-widest text-[#8D6E63] px-2 border-l border-[#D7CCC8]">
                        {CATEGORY_LABELS[proposal.category]}
                    </span>
                </div>
                <span className="text-[12px] text-[#A1887F] font-mono tracking-widest">
                    #{(proposal.id + 1).toString().padStart(4, '0')}
                </span>
            </div>

            {/* Title */}
            <h3 className={`
                text-2xl font-bold mb-8 transition-colors leading-snug
                ${isVoting ? "text-[#3E2723] group-hover:text-[#8D6E63]" : "text-[#5D4037]"}
            `}>
                {proposal.title}
            </h3>

            {/* Bottom: Meta & Vote Bar */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-auto relative z-10 border-t border-[#D7CCC8]/40 pt-4">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#A1887F] font-medium tracking-wider">
                    <span className="font-mono">{truncateAddress(proposal.creator)}</span>
                    <span className="text-[#D7CCC8]">|</span>
                    <span>{formatDate(proposal.createdAt)}</span>
                    {isVoting && (
                        <>
                            <span className="text-[#D7CCC8]">|</span>
                            <span className="text-[#8D6E63] font-bold bg-[#FAF9F6] px-2 py-0.5 border border-[#D7CCC8]/50">
                                {formatTimeRemaining(proposal.votingEndsAt)}
                            </span>
                        </>
                    )}
                </div>

                {/* Mini Vote Status */}
                {totalVoted > 0 && (
                    <div className="shrink-0 flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2 text-[12px] font-bold tracking-wider">
                                <span className="text-[#5E6E5A]">{forPercent}%</span>
                                <span className="text-[#D7CCC8] font-normal">|</span>
                                <span className="text-[#A94438]">{againstPercent}%</span>
                            </div>
                            <div className="w-32 h-1.5 rounded-full overflow-hidden flex bg-[#EFEBE9] border border-[#D7CCC8]/30">
                                <div
                                    className="h-full bg-[#5E6E5A] transition-all duration-500"
                                    style={{ width: `${forPercent}%` }}
                                />
                                <div
                                    className="h-full bg-[#A94438] transition-all duration-500"
                                    style={{ width: `${againstPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}
