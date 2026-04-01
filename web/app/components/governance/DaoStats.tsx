import type { DaoConfigData } from "~/lib/dao.onchain.server";

function formatDuration(seconds: number): string {
    if (seconds >= 86400) {
        const days = Math.floor(seconds / 86400);
        return `${String(days).padStart(2, '0')}`;
    }
    if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600);
        return `${String(hours).padStart(2, '0')}`;
    }
    return `${seconds}`;
}

export function DaoStats({ config }: { config: DaoConfigData }) {
    const isDays = config.votingPeriod >= 86400;
    const isHours = config.votingPeriod >= 3600 && !isDays;

    const stats = [
        {
            labelTop: "VOTING PERIOD",
            value: formatDuration(config.votingPeriod),
            labelBottom: "투표 기간",
        },
        {
            labelTop: "QUORUM",
            value: `${config.quorumBps / 100}`,
            unit: "%",
            labelBottom: "최소 참여율",
        },
        {
            labelTop: "APPROVAL",
            value: `${config.approvalThresholdBps / 100}`,
            unit: "%",
            labelBottom: "가결 기준",
        },
        {
            labelTop: "VOTING CAP",
            value: `${(config.votingCapBps / 100).toLocaleString()}`,
            unit: "%",
            labelBottom: "투표 한도",
        },
    ];

    return (
        <div className="w-full bg-[#FCFBF8] border border-[#D7CCC8] shadow-sm flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#D7CCC8]/60 my-8">
            {stats.map((stat, i) => (
                <div key={i} className="flex-1 px-6 py-10 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#A1887F] uppercase mb-4">
                        {stat.labelTop}
                    </span>
                    <div className="flex items-baseline gap-1 text-[#5D4037] mb-3">
                        <span className="text-6xl sm:text-7xl font-bold tracking-tight">
                            {stat.value}
                        </span>
                        {stat.unit && (
                            <span className="text-3xl font-bold text-[#A1887F] ml-1">
                                {stat.unit}
                            </span>
                        )}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.15em] text-[#BCAAA4] uppercase">
                        {stat.labelBottom}
                    </span>
                </div>
            ))}
        </div>
    );
}
