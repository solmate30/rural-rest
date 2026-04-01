import { useTranslation } from "react-i18next";
import type { ProposalData, ProposalStatus, ProposalCategory } from "~/lib/dao.onchain.server";

export const STATUS_STYLES: Record<ProposalStatus, string> = {
    voting: "bg-[#8D6E63] text-white",
    succeeded: "bg-[#D7CCC8] text-[#3E2723]",
    defeated: "bg-[#EFEBE9] text-[#A1887F]",
    cancelled: "bg-transparent border border-dashed border-[#D7CCC8] text-[#A1887F]",
};

// locale-aware 시간 포맷 (t 함수 주입)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatTimeRemaining(endsAt: number, t: any): string {
    const now = Math.floor(Date.now() / 1000);
    const diff = endsAt - now;
    if (diff <= 0) return t("card.ended");
    if (diff < 60)   return t("card.secLeft", { n: diff });
    if (diff < 3600) return t("card.minLeft", { n: Math.floor(diff / 60) });
    if (diff < 86400) return t("card.hrLeft",  { n: Math.floor(diff / 3600) });
    return t("card.dayLeft", { n: Math.floor(diff / 86400) });
}

function formatDate(timestamp: number, locale: string): string {
    return new Date(timestamp * 1000).toLocaleDateString(
        locale === "ko" ? "ko-KR" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
    );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t: tRaw, i18n } = useTranslation("governance");
    const t = tRaw as any;
    const isVoting = proposal.status === "voting";
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const forPercent = totalVoted > 0 ? Math.round((proposal.votesFor / totalVoted) * 100) : 0;
    const againstPercent = totalVoted > 0 ? Math.round((proposal.votesAgainst / totalVoted) * 100) : 0;

    const statusLabel: Record<ProposalStatus, string> = {
        voting:    t("card.statusVoting"),
        succeeded: t("card.statusSucceeded"),
        defeated:  t("card.statusDefeated"),
        cancelled: t("card.statusCancelled"),
    };

    const categoryLabel: Record<ProposalCategory, string> = {
        operations: t("card.catOperations"),
        guidelines: t("card.catGuidelines"),
        fundUsage:  t("card.catFundUsage"),
        other:      t("card.catOther"),
    };

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
                    <span className={`inline-flex items-center text-[11px] font-bold px-3 py-1 tracking-widest ${STATUS_STYLES[proposal.status]}`}>
                        {statusLabel[proposal.status]}
                    </span>
                    <span className="text-[12px] font-bold tracking-widest text-[#8D6E63] px-2 border-l border-[#D7CCC8]">
                        {categoryLabel[proposal.category]}
                    </span>
                </div>
                <span className="text-[12px] text-[#A1887F] font-mono tracking-widest">
                    #{(proposal.id + 1).toString().padStart(4, '0')}
                </span>
            </div>

            <h3 className={`text-2xl font-bold mb-8 transition-colors leading-snug ${isVoting ? "text-[#3E2723] group-hover:text-[#8D6E63]" : "text-[#5D4037]"}`}>
                {proposal.title}
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mt-auto relative z-10 border-t border-[#D7CCC8]/40 pt-4">
                <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#A1887F] font-medium tracking-wider">
                    <span className="font-mono">{truncateAddress(proposal.creator)}</span>
                    <span className="text-[#D7CCC8]">|</span>
                    <span>{formatDate(proposal.createdAt, i18n.language)}</span>
                    {isVoting && (
                        <>
                            <span className="text-[#D7CCC8]">|</span>
                            <span className="text-[#8D6E63] font-bold bg-[#FAF9F6] px-2 py-0.5 border border-[#D7CCC8]/50">
                                {formatTimeRemaining(proposal.votingEndsAt, t)}
                            </span>
                        </>
                    )}
                </div>

                {totalVoted > 0 && (
                    <div className="shrink-0 flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2 text-[12px] font-bold tracking-wider">
                                <span className="text-[#5E6E5A]">{forPercent}%</span>
                                <span className="text-[#D7CCC8] font-normal">|</span>
                                <span className="text-[#A94438]">{againstPercent}%</span>
                            </div>
                            <div className="w-32 h-1.5 rounded-full overflow-hidden flex bg-[#EFEBE9] border border-[#D7CCC8]/30">
                                <div className="h-full bg-[#5E6E5A] transition-all duration-500" style={{ width: `${forPercent}%` }} />
                                <div className="h-full bg-[#A94438] transition-all duration-500" style={{ width: `${againstPercent}%` }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </button>
    );
}

// 하위 호환 export (governance.$id.tsx에서 import 중)
export const STATUS_LABELS: Record<ProposalStatus, string> = {
    voting: "Voting", succeeded: "Passed", defeated: "Failed", cancelled: "Cancelled",
};
export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
    operations: "Operations", guidelines: "Guidelines", fundUsage: "Fund Usage", other: "Other",
};
