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
                    <span className="text-[#5E6E5A]">찬성 {votesFor}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#A94438]" />
                    <span className="text-[#A94438]">반대 {votesAgainst}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D7CCC8]" />
                    <span className="text-[#8D6E63]">기권 {votesAbstain}</span>
                </div>
            </div>

            {/* 집계 요약: 총 의결권 / 참여자 수 */}
            <div className="flex items-center justify-between text-xs text-[#A1887F] pt-0.5">
                <span>총 집계</span>
                <span className="font-medium">
                    <span className="text-[#5D4037] font-bold">{totalVoted}</span>
                    {" / 전체 "}
                    <span className="text-[#5D4037] font-bold">{totalEligibleWeight} 의결권</span>
                    <span className="text-[#A1887F]"> ({voterCount}명 참여)</span>
                </span>
            </div>

            {/* 최소 참여율 (Quorum) */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#8D6E63]">
                    <span>정족수 ({quorumBps / 100}%)</span>
                    <span className={quorumMet ? "text-[#8D6E63] font-bold" : "text-[#A1887F]"}>
                        {quorumMet ? "충족" : `${totalVoted} / ${quorumThreshold} (미달)`}
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
