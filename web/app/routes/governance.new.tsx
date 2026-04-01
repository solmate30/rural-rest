import { useState } from "react";
import { useNavigate } from "react-router";
import { useLoaderData } from "react-router";
import { authClient } from "~/lib/auth.client";
import ReactMarkdown from "react-markdown";
import type { Route } from "./+types/governance.new";
import { fetchDaoConfig, fetchActiveListingIds } from "~/lib/dao.onchain.server";
import type { DaoConfigData } from "~/lib/dao.onchain.server";

import { Header, Footer } from "~/components/ui-mockup";
import { CreateProposalForm, CATEGORIES } from "~/components/governance/CreateProposalForm";


function getMockDaoConfig(): DaoConfigData {
    return {
        authority: "9WzDXwBbmPEd3aTqUVJewSqMfpB9Y7dBo5TDZGQL8sHm",
        councilMint: "CoUNciLtOkEnMiNtXxXxXxXxXxXxXxXxXxXxXxXxXx11",
        votingPeriod: 604800,
        quorumBps: 2000,
        approvalThresholdBps: 6000,
        votingCapBps: 1000,
        proposalCount: 5,
        rwaProgram: "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR",
    };
}

export async function loader({ request }: Route.LoaderArgs) {
    const daoConfig = await fetchDaoConfig();
    const activeListingIds = daoConfig ? await fetchActiveListingIds() : [];

    return {
        daoConfig: daoConfig ?? getMockDaoConfig(),
        activeListingIds,
        isMock: !daoConfig,
    };
}

export default function GovernanceNewPage() {
    const { daoConfig, activeListingIds, isMock } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    const defaultDeadline = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 16);
    const [preview, setPreview] = useState<{
        title: string;
        category: string;
        markdown: string;
        votingDeadline: string;
    }>({
        title: "",
        category: CATEGORIES[0].value,
        markdown: "",
        votingDeadline: defaultDeadline,
    });

    const session = authClient.useSession?.()?.data;
    const creatorLabel = session?.user?.name ?? "작성자";
    const categoryLabel = CATEGORIES.find((c) => c.value === preview.category)?.label ?? "";
    const hasContent = preview.title.trim() || preview.markdown.trim();
    const deadlineDisplay = preview.votingDeadline
        ? new Date(preview.votingDeadline).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : "";

    return (
        <>
            <Header />
            <main className="min-h-[calc(100vh-160px)] pb-20 bg-[#FAF9F6] relative">
                {/* 상단 배경 그라데이션 */}
                <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-[#D7CCC8]/20 to-transparent pointer-events-none -z-10"></div>

                <div className="container mx-auto py-8 px-4 sm:px-8">
                    {/* 뒤로 가기 */}
                    <button
                        onClick={() => navigate("/governance")}
                        className="group flex items-center gap-1.5 text-[12px] font-bold tracking-widest uppercase text-[#A1887F] hover:text-[#8D6E63] transition-colors mb-6"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
                        거버넌스 목록
                    </button>

                    <h1 className="text-3xl font-bold text-[#3E2723] tracking-tight mb-2">
                        새 안건 상정
                    </h1>
                    <p className="text-[15px] text-[#8D6E63] mb-4">
                        제안 내용을 작성하면 온체인에 기록되고 투표가 시작됩니다.
                    </p>

                    {isMock && (
                        <div className="mb-8 p-4 rounded-lg bg-[#FFF3E0] border border-[#FFCC02]/60 text-[13px] text-[#E65100] font-medium">
                            로컬 validator가 실행되지 않아 DAO 온체인 데이터를 불러올 수 없습니다. 제안 등록을 하려면 validator를 실행한 후 새로고침하세요.
                        </div>
                    )}

                    {/* 2열 레이아웃: 폼 | 프리뷰 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                        {/* 왼쪽: 입력 폼 */}
                        <div>
                            <CreateProposalForm
                                daoConfig={daoConfig}
                                activeListingIds={activeListingIds}
                                onCreated={() => navigate("/governance")}
                                onClose={() => navigate("/governance")}
                                onPreviewChange={setPreview}
                            />
                        </div>

                        {/* 오른쪽: 게시글 전체 프리뷰 */}
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#A1887F] mb-3 block">
                                게시글 미리보기
                            </span>
                            <div className="border border-[#D7CCC8] bg-white rounded-lg p-6 sm:p-8 shadow-sm flex-1 overflow-y-auto">
                                {hasContent ? (
                                    <article>
                                        {/* 분류 뱃지 */}
                                        <div className="flex items-center gap-3 mb-5">
                                            <span className="inline-flex items-center text-[11px] font-bold px-3 py-1 tracking-widest bg-[#8D6E63] text-white">
                                                투표중
                                            </span>
                                            <span className="text-[12px] font-bold tracking-widest text-[#8D6E63] px-2 border-l border-[#D7CCC8]">
                                                {categoryLabel}
                                            </span>
                                        </div>

                                        {/* 제목 */}
                                        <h2 className="text-2xl sm:text-3xl font-bold text-[#3E2723] leading-snug mb-6">
                                            {preview.title || "제목 미입력"}
                                        </h2>

                                        {/* 메타 정보 */}
                                        <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#A1887F] font-medium tracking-wider mb-6 pb-4 border-b border-[#D7CCC8]/40">
                                            <span className="font-mono">{session?.user?.name ?? "작성자"}</span>
                                            <span className="text-[#D7CCC8]">|</span>
                                            <span>{new Date().toLocaleDateString("ko-KR")}</span>
                                            {deadlineDisplay && (
                                                <>
                                                    <span className="text-[#D7CCC8]">|</span>
                                                    <span className="text-[#FFAB91] font-bold">마감 {deadlineDisplay}</span>
                                                </>
                                            )}
                                        </div>

                                        {/* 본문 */}
                                        {preview.markdown.trim() ? (
                                            <div className="md-preview">
                                                <ReactMarkdown
                                                    components={{
                                                        h1: ({ children }) => <h1 className="text-2xl font-bold text-[#3E2723] mt-6 mb-3">{children}</h1>,
                                                        h2: ({ children }) => <h2 className="text-xl font-bold text-[#3E2723] mt-5 mb-2">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="text-lg font-bold text-[#3E2723] mt-4 mb-2">{children}</h3>,
                                                        h4: ({ children }) => <h4 className="text-base font-bold text-[#3E2723] mt-3 mb-1">{children}</h4>,
                                                        p: ({ children }) => <p className="text-[15px] text-[#5D4037] leading-relaxed mb-3">{children}</p>,
                                                        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[#5D4037]">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[#5D4037]">{children}</ol>,
                                                        li: ({ children }) => <li className="text-[15px] leading-relaxed">{children}</li>,
                                                        a: ({ href, children }) => <a href={href} className="text-[#8D6E63] hover:underline" target="_blank" rel="noreferrer">{children}</a>,
                                                        strong: ({ children }) => <strong className="font-bold text-[#3E2723]">{children}</strong>,
                                                        em: ({ children }) => <em className="italic text-[#5D4037]">{children}</em>,
                                                        blockquote: ({ children }) => <blockquote className="border-l-4 border-[#D7CCC8] pl-4 my-3 text-[#8D6E63] italic">{children}</blockquote>,
                                                        code: ({ children }) => <code className="bg-[#FAF9F6] text-[#5D4037] px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>,
                                                        pre: ({ children }) => <pre className="bg-[#FAF9F6] border border-[#D7CCC8] rounded-lg p-4 overflow-x-auto mb-3 text-[13px]">{children}</pre>,
                                                        hr: () => <hr className="border-[#D7CCC8] my-6" />,
                                                    }}
                                                >
                                                    {preview.markdown}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-[13px] text-[#A1887F] italic">
                                                본문을 작성하면 여기에 표시됩니다.
                                            </p>
                                        )}
                                    </article>
                                ) : (
                                    <div className="flex items-center justify-center h-full min-h-[350px]">
                                        <p className="text-[14px] text-[#A1887F] italic">
                                            왼쪽에서 내용을 입력하면 실시간으로 미리보기가 표시됩니다.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
