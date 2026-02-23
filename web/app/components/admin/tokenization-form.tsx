import React, { useState } from "react";
import { Input, Button } from "../ui-mockup";

export function TokenizationForm() {
    const [tokenCount, setTokenCount] = useState(10000);

    return (
        <form className="bg-white rounded-[calc(var(--radius)*2)] p-6 md:p-8 shadow-sm border border-border" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground font-['Gaegu']">내 숙소 토큰화 신청</h2>
                    <p className="text-sm text-muted-foreground mt-1">RWA 토큰을 발행하여 운영 자금과 수익을 공유하세요.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-2">숙소 선택</label>
                        <div className="relative">
                            <select className="w-full h-12 bg-background border border-input rounded-[var(--radius)] px-4 text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none appearance-none cursor-pointer">
                                <option value="">숙소를 선택해주세요</option>
                                <option value="1">양평 돌담 고택</option>
                                <option value="2">고성 바다 한옥 (운영 중)</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                                expand_more
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-foreground mb-2">희망 토큰 발행량</label>
                        <div className="flex items-center gap-3">
                            <Input
                                type="number"
                                value={tokenCount}
                                onChange={(e) => setTokenCount(Number(e.target.value))}
                                className="font-mono text-lg font-semibold w-1/3"
                            />
                            <span className="text-stone-500 font-medium">tokens</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">일반적으로 숙소 전체 가치의 1/10000 단위로 분할합니다.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="border border-input rounded-[var(--radius)] p-4 cursor-pointer hover:bg-stone-50 transition-colors border-dashed">
                            <label className="flex flex-col items-center justify-center gap-2 cursor-pointer h-full">
                                <span className="material-symbols-outlined text-stone-400 text-3xl">upload_file</span>
                                <span className="text-sm font-bold text-foreground">감정평가서 업로드</span>
                                <span className="text-xs text-stone-400">PDF, Max 5MB</span>
                                <input type="file" className="hidden" accept=".pdf" />
                            </label>
                        </div>
                        <div className="border border-input rounded-[var(--radius)] p-4 cursor-pointer hover:bg-stone-50 transition-colors border-dashed">
                            <label className="flex flex-col items-center justify-center gap-2 cursor-pointer h-full">
                                <span className="material-symbols-outlined text-stone-400 text-3xl">contract</span>
                                <span className="text-sm font-bold text-foreground">등기부등본 업로드</span>
                                <span className="text-xs text-stone-400">PDF, Max 5MB</span>
                                <input type="file" className="hidden" accept=".pdf" />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
                    <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
                    <div className="text-sm text-amber-800 leading-relaxed">
                        <span className="font-bold">신청 유의사항</span><br />
                        법률 검토 및 감정평가가 진행되며 승인까지 <span className="font-bold">평균 2-4주</span>가 소요됩니다. 신청 수수료는 발생하지 않습니다.
                    </div>
                </div>

                <Button className="w-full h-12 text-md font-bold bg-[#8D6E63] hover:bg-[#7a5e55] text-white">
                    신청서 제출하기
                </Button>
            </div>
        </form>
    );
}
