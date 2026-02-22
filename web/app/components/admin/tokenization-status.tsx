import React from "react";

interface StatusNode {
    title: string;
    status: "completed" | "current" | "pending";
    description?: string;
    duration?: string;
}

const STAGES: StatusNode[] = [
    { title: "신청", status: "completed" },
    { title: "법률 검토", status: "current", description: "서류 검토 및 권리 분석 중", duration: "예상 소요: 1-2주" },
    { title: "감정평가", status: "pending", duration: "예상 소요: 1주" },
    { title: "승인", status: "pending" },
    { title: "토큰 발행", status: "pending" },
];

export function TokenizationStatus() {
    return (
        <div className="bg-white rounded-[calc(var(--radius)*2)] p-6 md:p-8 shadow-sm border border-border">
            <h2 className="text-xl font-bold text-foreground mb-8">심사 상태</h2>

            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-stone-100 -translate-y-1/2 rounded-full overflow-hidden">
                    {/* Dynamic progress bar line */}
                    <div className="h-full bg-[#17cf54]" style={{ width: '25%' }} />
                </div>

                <div className="relative flex justify-between">
                    {STAGES.map((stage, index) => (
                        <div key={index} className="flex flex-col items-center group">
                            <div
                                className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all bg-white shadow-sm ring-4 ring-white ${stage.status === "completed"
                                        ? "border-2 border-[#17cf54]"
                                        : stage.status === "current"
                                            ? "bg-[#17cf54] border-2 border-[#17cf54] scale-110 shadow-md"
                                            : "border-2 border-stone-200"
                                    }`}
                            >
                                {stage.status === "completed" && (
                                    <span className="material-symbols-outlined text-[14px] text-[#17cf54] font-bold">check</span>
                                )}
                                {stage.status === "current" && (
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                                )}
                            </div>
                            <div className="mt-4 text-center">
                                <span
                                    className={`block text-xs md:text-sm font-bold ${stage.status === "current" || stage.status === "completed"
                                            ? "text-foreground"
                                            : "text-stone-400"
                                        }`}
                                >
                                    {stage.title}
                                </span>
                                {stage.status === "current" && stage.duration && (
                                    <span className="hidden md:block text-[10px] text-[#17cf54] mt-1 font-medium">{stage.duration}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 p-4 bg-stone-50 rounded-xl border border-stone-100 flex items-start gap-3">
                <span className="material-symbols-outlined text-[#17cf54] text-[20px] mt-0.5">info</span>
                <div>
                    <p className="text-sm font-bold text-foreground">현재 법률 검토가 진행 중입니다.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        제출해주신 등기부등본을 바탕으로 신탁 가능 여부를 파악하고 있습니다. 추가 서류가 필요한 경우 이메일로 안내해 드립니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
