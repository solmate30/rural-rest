import { useTranslation } from "react-i18next";

interface VotingProgressBarProps {
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    totalEligibleWeight: number;
    quorumBps: number;
    voterCount?: number;
}

export function VotingProgressBar({
    votesFor,
    votesAgainst,
    votesAbstain,
    totalEligibleWeight,
    quorumBps,
    voterCount = 0,
}: VotingProgressBarProps) {
    const { t } = useTranslation("governance");
    const totalVoted = votesFor + votesAgainst + votesAbstain;
    const quorumThreshold = Math.ceil((totalEligibleWeight * quorumBps) / 10000);
    const quorumPercent = totalEligibleWeight > 0 ? Math.min((totalVoted / totalEligibleWeight) * 100, 100) : 0;
    const quorumMet = totalVoted >= quorumThreshold;

    const forPercent = totalVoted > 0 ? (votesFor / totalVoted) * 100 : 0;
    const againstPercent = totalVoted > 0 ? (votesAgainst / totalVoted) * 100 : 0;
    const abstainPercent = totalVoted > 0 ? (votesAbstain / totalVoted) * 100 : 0;

    return (
        <div className="space-y-3">
            {/* 투표 비율 바 */}
            <div className="h-4 rounded-full bg-[#EFEBE9] overflow-hidden flex border border-[#D7CCC8]/30">
                {forPercent > 0 && (
                    <div
                        className="h-full bg-[#5E6E5A] transition-all duration-500"
                        style={{ width: `${forPercent}%` }}
                    />
                )}
                {againstPercent > 0 && (
                    <div
                        className="h-full bg-[#A94438] transition-all duration-500"
                        style={{ width: `${againstPercent}%` }}
                    />
                )}
                {abstainPercent > 0 && (
                    <div
                        className="h-full bg-[#D7CCC8] transition-all duration-500"
                        style={{ width: `${abstainPercent}%` }}
                    />
                )}
            </div>

            {/* 수치 */}
            <div className="flex justify-between text-[13px] font-bold">
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#5E6E5A]" />
                    <span className="text-[#5E6E5A]">{t("vote.for")} {votesFor}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#A94438]" />
                    <span className="text-[#A94438]">{t("vote.against")} {votesAgainst}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D7CCC8]" />
                    <span className="text-[#8D6E63]">{t("vote.abstain")} {votesAbstain}</span>
                </div>
            </div>

            {/* 집계 요약 */}
            <div className="flex items-center justify-between text-xs text-[#A1887F] pt-0.5">
                <span>{t("vote.total")}</span>
                <span className="font-medium">
                    <span className="text-[#5D4037] font-bold">{totalVoted}</span>
                    {" / "}
                    <span className="text-[#5D4037] font-bold">{totalEligibleWeight} {t("vote.votes")}</span>
                    <span className="text-[#A1887F]"> ({voterCount}{t("vote.participants")})</span>
                </span>
            </div>

            {/* 정족수 */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#8D6E63]">
                    <span>{t("vote.quorum")} ({quorumBps / 100}%)</span>
                    <span className={quorumMet ? "text-[#8D6E63] font-bold" : "text-[#A1887F]"}>
                        {quorumMet ? t("vote.quorumMet") : `${totalVoted} / ${quorumThreshold} (${t("vote.quorumShort")})`}
                    </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#EFEBE9] overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 rounded-full ${quorumMet ? "bg-[#8D6E63]" : "bg-[#FFAB91]"}`}
                        style={{ width: `${Math.min(quorumPercent, 100)}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
