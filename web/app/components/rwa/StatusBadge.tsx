interface Props {
    status: "funding" | "funded" | "active" | "failed";
}

const STATUS_CONFIG = {
    funding: { label: "펀딩 진행 중", color: "bg-blue-50 text-blue-600 border-blue-200" },
    funded:  { label: "펀딩 완료 — 운영 준비", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    active:  { label: "운영 중", color: "bg-[#17cf54]/10 text-[#17cf54] border-[#17cf54]/20" },
    failed:  { label: "모집 종료", color: "bg-stone-100 text-stone-500 border-stone-200" },
};

export function StatusBadge({ status }: Props) {
    const { label, color } = STATUS_CONFIG[status] ?? STATUS_CONFIG.funding;
    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border ${color}`}>
            {label}
        </span>
    );
}
