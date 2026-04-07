import { useTranslation } from "react-i18next";

interface Props {
    status: "funding" | "funded" | "active" | "failed";
}

const STATUS_COLORS = {
    funding: "bg-blue-50 text-blue-600 border-blue-200",
    funded:  "bg-yellow-50 text-yellow-700 border-yellow-200",
    active:  "bg-[#17cf54]/10 text-[#17cf54] border-[#17cf54]/20",
    failed:  "bg-stone-100 text-stone-500 border-stone-200",
};

export function StatusBadge({ status }: Props) {
    const { t } = useTranslation("admin");
    const color = STATUS_COLORS[status] ?? STATUS_COLORS.funding;
    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border ${color}`}>
            {t(`dashboard.status.${status}`)}
        </span>
    );
}
