import { useTranslation } from "react-i18next";
import type { DaoConfigData } from "~/lib/dao.onchain.server";

function formatDuration(seconds: number): string {
    if (seconds >= 86400) {
        return `${Math.floor(seconds / 86400)}`;
    }
    if (seconds >= 3600) {
        return `${Math.floor(seconds / 3600)}`;
    }
    return `${seconds}`;
}

export function DaoStats({ config }: { config: DaoConfigData }) {
    const { t, i18n } = useTranslation("governance");
    const isEn = i18n.language === "en";

    const votingUnit = config.votingPeriod >= 86400
        ? (isEn ? "days" : "일")
        : config.votingPeriod >= 3600
            ? (isEn ? "hrs" : "시간")
            : (isEn ? "sec" : "초");

    const stats = [
        { label: t("stats.votingPeriod"), value: formatDuration(config.votingPeriod), unit: votingUnit },
        { label: t("stats.quorum"),        value: `${config.quorumBps / 100}`,                       unit: "%" },
        { label: t("stats.approval"),      value: `${config.approvalThresholdBps / 100}`,            unit: "%" },
        { label: t("stats.votingCap"),     value: config.votingCapBps >= 10000 ? t("stats.votingCapNone") : `${config.votingCapBps / 100}`, unit: config.votingCapBps >= 10000 ? "" : "%" },
    ];

    return (
        <div className="w-full bg-[#FCFBF8] border border-[#D7CCC8] shadow-sm flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#D7CCC8]/60 my-8">
            {stats.map((stat, i) => (
                <div key={i} className="flex-1 px-6 py-10 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#A1887F] uppercase mb-4">
                        {stat.label}
                    </span>
                    <div className="flex items-baseline gap-1 text-[#5D4037]">
                        <span className="text-6xl sm:text-7xl font-bold tracking-tight">
                            {stat.value}
                        </span>
                        <span className="text-3xl font-bold text-[#A1887F] ml-1">
                            {stat.unit}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
