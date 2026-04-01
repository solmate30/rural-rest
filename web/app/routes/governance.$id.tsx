import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { useCallback } from "react";
import type { Route } from "./+types/governance.$id";
import { fetchDaoConfig, fetchProposal, tryAutoFinalize, fetchActiveListingIds } from "~/lib/dao.onchain.server";
import type { DaoConfigData, ProposalData } from "~/lib/dao.onchain.server";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

import { Header, Footer } from "~/components/ui-mockup";
import { VotingProgressBar } from "~/components/governance/VotingProgressBar";
import { VotePanel } from "~/components/governance/VotePanel";
import {
    STATUS_LABELS,
    STATUS_STYLES,
    CATEGORY_LABELS,
    formatTimeRemaining,
    truncateAddress,
} from "~/components/governance/ProposalCard";
import type { ProposalCategory } from "~/lib/dao.onchain.server";


// 더미 데이터 (온체인 미연결 시 UI 확인용)
function getMockProposal(id: number): ProposalData | null {
    const now = Math.floor(Date.now() / 1000);
    const mockProposals: ProposalData[] = [
        {
            id: 0,
            pda: "Prop0xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            title: "경주 한옥마을 예약 취소 정책 개정",
            descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/1",
            category: "operations",
            status: "voting",
            votesFor: 28,
            votesAgainst: 8,
            votesAbstain: 4,
            totalEligibleWeight: 65,
            voterCount: 12,
            votingStartsAt: now - 86400 * 2,
            votingEndsAt: now + 86400 * 5,
            createdAt: now - 86400 * 2,
        },
        {
            id: 1,
            pda: "Prop1xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            creator: "CouNcilMem2xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            title: "마을 공동 기금 사용 -- 전통 체험 프로그램 운영비",
            descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/2",
            category: "fundUsage",
            status: "voting",
            votesFor: 5,
            votesAgainst: 2,
            votesAbstain: 0,
            totalEligibleWeight: 65,
            voterCount: 3,
            votingStartsAt: now - 3600,
            votingEndsAt: now + 86400 * 6,
            createdAt: now - 3600,
        },
        {
            id: 2,
            pda: "Prop2xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            title: "브랜드 가이드라인 v2 채택 -- 사진 촬영 기준",
            descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/3",
            category: "guidelines",
            status: "succeeded",
            votesFor: 42,
            votesAgainst: 10,
            votesAbstain: 6,
            totalEligibleWeight: 65,
            voterCount: 18,
            votingStartsAt: now - 86400 * 14,
            votingEndsAt: now - 86400 * 7,
            createdAt: now - 86400 * 14,
        },
        {
            id: 3,
            pda: "Prop3xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            creator: "CouNcilMem2xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            title: "동절기 난방비 추가 요금 도입",
            descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/4",
            category: "operations",
            status: "defeated",
            votesFor: 8,
            votesAgainst: 30,
            votesAbstain: 12,
            totalEligibleWeight: 65,
            voterCount: 21,
            votingStartsAt: now - 86400 * 21,
            votingEndsAt: now - 86400 * 14,
            createdAt: now - 86400 * 21,
        },
        {
            id: 4,
            pda: "Prop4xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            title: "긴급 안건 -- 수해 복구 기금 요청",
            descriptionUri: "",
            category: "fundUsage",
            status: "cancelled",
            votesFor: 0,
            votesAgainst: 0,
            votesAbstain: 0,
            totalEligibleWeight: 65,
            voterCount: 0,
            votingStartsAt: now - 86400 * 3,
            votingEndsAt: now + 86400 * 4,
            createdAt: now - 86400 * 3,
        },
    ];
    return mockProposals.find((p) => p.id === id) ?? null;
}

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

export async function loader({ params }: Route.LoaderArgs) {
    const proposalId = parseInt((params as any).id, 10);
    if (isNaN(proposalId)) {
        throw new Response("Invalid proposal ID", { status: 400 });
    }

    const daoConfig = await fetchDaoConfig();
    const activeListingIds = daoConfig ? await fetchActiveListingIds() : [];

    // Issue/Gist content fetch 헬퍼
    async function fetchDescriptionMarkdown(uri: string): Promise<string | null> {
        if (!uri) return null;

        // GitHub Issue URL → API로 body 조회
        const issueMatch = uri.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
        if (issueMatch) {
            try {
                const [, repo, issueNumber] = issueMatch;
                const token = process.env.GITHUB_TOKEN;
                const headers: Record<string, string> = {
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                };
                if (token) headers.Authorization = `Bearer ${token}`;
                const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    return data.body || null;
                }
            } catch { /* silent */ }
            return null;
        }

        // Gist raw URL (레거시 호환)
        if (uri.includes("gist.")) {
            try {
                const res = await fetch(uri);
                if (res.ok) return await res.text();
            } catch { /* silent */ }
            return null;
        }

        return null;
    }

    if (daoConfig) {
        let proposal = await fetchProposal(proposalId);
        if (!proposal) {
            throw new Response("Proposal not found", { status: 404 });
        }

        // 투표 기간 만료 + 아직 voting 상태 → 서버에서 자동 finalize
        const nowSec = Math.floor(Date.now() / 1000);
        if (proposal.status === "voting" && nowSec > proposal.votingEndsAt) {
            const finalized = await tryAutoFinalize(proposalId);
            if (finalized) {
                proposal = finalized;
            }
        }

        const descriptionMarkdown = await fetchDescriptionMarkdown(proposal.descriptionUri);
        return { daoConfig, proposal, activeListingIds, descriptionMarkdown };
    }

    // 온체인 미연결 시 더미
    const proposal = getMockProposal(proposalId);
    if (!proposal) {
        throw new Response("Proposal not found", { status: 404 });
    }

    // 더미 마크다운 (UI 확인용)
    const mockMarkdown = proposalId === 0
        ? `## 배경\n\n현재 경주 한옥마을의 예약 취소 정책이 게스트에게 불리하여 예약 전환율이 낮은 상황입니다.\n\n## 제안 내용\n\n- **7일 전 취소**: 전액 환불\n- **3일 전 취소**: 50% 환불\n- **당일 취소**: 환불 불가\n\n## 예상 효과\n\n예약 전환율 **15% 상승** 예상. 유사 플랫폼(Airbnb, 야놀자) 대비 경쟁력 확보.\n\n> 참고: 현재 전환율 데이터는 2026년 1분기 기준입니다.`
        : null;

    return { daoConfig: getMockDaoConfig(), proposal, activeListingIds, descriptionMarkdown: mockMarkdown };
}

export default function ProposalDetailPage() {
    const { daoConfig, proposal, activeListingIds, descriptionMarkdown } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const { t, i18n } = useTranslation("governance");
    const locale = i18n.language === "ko" ? "ko-KR" : "en-US";
    const isVoting = proposal.status === "voting";
    const now = Math.floor(Date.now() / 1000);
    const votingEnded = now > proposal.votingEndsAt;
    const handleRefresh = useCallback(() => {
        revalidator.revalidate();
    }, [revalidator]);

    // 가결 판정 계산
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const quorumThreshold = Math.ceil(
        (proposal.totalEligibleWeight * daoConfig.quorumBps) / 10000
    );
    const quorumMet = totalVoted >= quorumThreshold;
    const votesCast = proposal.votesFor + proposal.votesAgainst;
    const approvalPercent = votesCast > 0 ? Math.round((proposal.votesFor / votesCast) * 100) : 0;

    function formatDate(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    function formatDateTime(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleString(locale, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return (
        <>
        <Header />
        <main className="min-h-[calc(100vh-160px)] pb-20 bg-[#FAF9F6]">
            {/* 상단 배경 그라데이션 */}
            <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-[#D7CCC8]/20 to-transparent pointer-events-none -z-10"></div>

            <div className="container mx-auto py-8 px-4 sm:px-8">
                {/* 뒤로 가기 (브레드크럼 스타일) */}
                <button
                    onClick={() => navigate("/governance")}
                    className="group flex items-center gap-1.5 text-[12px] font-bold tracking-widest uppercase text-[#A1887F] hover:text-[#8D6E63] transition-colors mb-6"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
                    {t("detail.breadcrumb")}
                </button>

                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                    {/* 왼쪽 메인 컨텐츠 */}
                    <div className="flex-1 space-y-8 min-w-0">
                        {/* 헤더 부분 */}
                        <div>
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <span className="text-xs font-bold text-[#A1887F] font-mono">
                                    #{(proposal.id + 1).toString().padStart(4, '0')}
                                </span>
                                <Badge
                                    className={`text-[11px] px-3 py-1 rounded-sm font-bold uppercase tracking-wider ${STATUS_STYLES[proposal.status]}`}
                                >
                                    {({ voting: t("card.statusVoting"), succeeded: t("card.statusSucceeded"), defeated: t("card.statusDefeated"), cancelled: t("card.statusCancelled") })[proposal.status]}
                                </Badge>
                                <span className="text-xs font-bold text-[#8D6E63] tracking-widest px-2 border-l border-[#D7CCC8]">
                                    {({ operations: t("card.catOperations"), guidelines: t("card.catGuidelines"), fundUsage: t("card.catFundUsage"), other: t("card.catOther") } as Record<string, string>)[proposal.category]}
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-[#3E2723] leading-tight tracking-tight">
                                {proposal.title}
                            </h1>
                        </div>

                        {/* 메타보드 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-lg bg-white border border-[#D7CCC8]/50 shadow-sm">
                            <div>
                                <p className="text-xs font-semibold text-[#8D6E63] mb-1">{t("detail.proposer")}</p>
                                <p className="font-mono text-[13px] font-bold text-[#5D4037] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#D7CCC8]/30 inline-block">
                                    {truncateAddress(proposal.creator)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-[#8D6E63] mb-1">{t("detail.proposedAt")}</p>
                                <p className="font-bold text-[14px] text-[#3E2723]">{formatDate(proposal.createdAt)}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#8D6E63] mb-1">{t("detail.deadline")}</p>
                                <p className="font-bold text-[13px] text-[#3E2723] truncate">{formatDateTime(proposal.votingEndsAt)}</p>
                            </div>
                            <div className="min-w-0">
                                <p className={`text-xs font-semibold mb-1 ${isVoting ? 'text-[#FFAB91]' : 'text-[#8D6E63]'}`}>
                                    {isVoting ? t("detail.timeLeft") : t("detail.ended")}
                                </p>
                                <p className={`font-bold text-[13px] truncate ${isVoting ? "text-[#FFAB91]" : "text-[#3E2723]"}`}>
                                    {isVoting
                                        ? formatTimeRemaining(proposal.votingEndsAt, t as any)
                                        : formatDate(proposal.votingEndsAt)
                                    }
                                </p>
                            </div>
                        </div>

                        {/* 설명 영역 */}
                        {(descriptionMarkdown || proposal.descriptionUri) && (
                            <div className="p-6 sm:p-8 rounded-lg bg-white border border-[#D7CCC8]/50 shadow-sm">
                                <h3 className="text-[16px] font-bold text-[#3E2723] mb-5">
                                    {t("detail.body")}
                                </h3>

                                {descriptionMarkdown ? (
                                    <>
                                        <div className="
                                            [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:text-[#3E2723] [&_h1]:mb-3 [&_h1]:mt-6 first:[&_h1]:mt-0
                                            [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-[#3E2723] [&_h2]:mb-2 [&_h2]:mt-5 first:[&_h2]:mt-0
                                            [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[#5D4037] [&_h3]:mb-2 [&_h3]:mt-4
                                            [&_p]:text-[15px] [&_p]:text-[#5D4037] [&_p]:leading-relaxed [&_p]:mb-3
                                            [&_ul]:text-[#5D4037] [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc
                                            [&_ol]:text-[#5D4037] [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal
                                            [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:mb-1
                                            [&_a]:text-[#8D6E63] [&_a]:underline [&_a]:underline-offset-2
                                            [&_strong]:text-[#3E2723] [&_strong]:font-bold
                                            [&_blockquote]:border-l-4 [&_blockquote]:border-[#D7CCC8] [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-[#A1887F]
                                            [&_code]:bg-[#FAF9F6] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:border [&_code]:border-[#D7CCC8]/50 [&_code]:font-mono
                                            [&_hr]:border-[#D7CCC8]/40 [&_hr]:my-5
                                        ">
                                            <ReactMarkdown>{descriptionMarkdown}</ReactMarkdown>
                                        </div>

                                        {/* 원문 링크 - GitHub Issue 또는 외부 URL */}
                                        {proposal.descriptionUri && (
                                            <div className="mt-5 pt-4 border-t border-[#D7CCC8]/40">
                                                <a
                                                    href={proposal.descriptionUri}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[12px] font-medium text-[#A1887F] hover:text-[#8D6E63] transition-colors underline underline-offset-2"
                                                >
                                                    {t("detail.viewSource")} &rarr;
                                                </a>
                                            </div>
                                        )}
                                    </>
                                ) : proposal.descriptionUri ? (
                                    <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#D7CCC8]/40">
                                        <p className="text-sm font-semibold text-[#8D6E63] mb-2">{t("detail.viewSourceLabel")}</p>
                                        <a
                                            href={proposal.descriptionUri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[14px] font-medium text-[#5D4037] hover:text-[#8D6E63] transition-colors break-all underline underline-offset-2"
                                        >
                                            {proposal.descriptionUri}
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* 투표 현황 + 투표하기 (모바일) */}
                        <div className="lg:hidden rounded-lg bg-white border border-[#D7CCC8]/50 shadow-sm p-6">
                            <h3 className="text-[16px] font-bold text-[#3E2723] mb-5">
                                {t("detail.voteStatus")}
                            </h3>
                            <VotingProgressBar
                                votesFor={proposal.votesFor}
                                votesAgainst={proposal.votesAgainst}
                                votesAbstain={proposal.votesAbstain}
                                totalEligibleWeight={proposal.totalEligibleWeight}
                                quorumBps={daoConfig.quorumBps}
                                voterCount={proposal.voterCount}
                            />
                            {votesCast > 0 && (
                                <div className="mt-5 pt-4 border-t border-[#D7CCC8]/30 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-[#8D6E63]">{t("detail.approvalRate")}</span>
                                    <div className="flex items-center gap-2 text-[13px] bg-[#FAF9F6] px-3 py-1.5 rounded border border-[#D7CCC8]/40">
                                        <span className="font-bold text-[#8D6E63] text-[15px]">{approvalPercent}%</span>
                                        <span className="text-[#D7CCC8]">/</span>
                                        <span className="font-medium text-[#A1887F]">{t("detail.approvalThreshold", { pct: daoConfig.approvalThresholdBps / 100 })}</span>
                                    </div>
                                </div>
                            )}
                            {isVoting && !votingEnded && (
                                <div className="mt-6 pt-6 border-t border-[#D7CCC8]/40">
                                    <h3 className="text-[16px] font-bold text-[#3E2723] mb-5">
                                        {t("detail.vote")}
                                    </h3>
                                    <VotePanel
                                        proposal={proposal}
                                        activeListingIds={activeListingIds}
                                        councilMint={daoConfig.councilMint}
                                        onVoted={handleRefresh}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 사이드바 */}
                    <div className="w-full lg:w-[400px] shrink-0">
                        <div className="sticky top-24">
                            <div className="hidden lg:block rounded-lg bg-white border border-[#D7CCC8]/50 shadow-sm p-6">
                                {/* 투표 현황 */}
                                <h3 className="text-[16px] font-bold text-[#3E2723] mb-5">
                                    {t("detail.voteStatus")}
                                </h3>
                                <VotingProgressBar
                                    votesFor={proposal.votesFor}
                                    votesAgainst={proposal.votesAgainst}
                                    votesAbstain={proposal.votesAbstain}
                                    totalEligibleWeight={proposal.totalEligibleWeight}
                                    quorumBps={daoConfig.quorumBps}
                                    voterCount={proposal.voterCount}
                                />
                                {votesCast > 0 && (
                                    <div className="mt-5 pt-4 border-t border-[#D7CCC8]/30 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-[#8D6E63]">{t("detail.approvalRate")}</span>
                                        <div className="flex items-center gap-2 text-xs bg-[#FAF9F6] px-2 py-1 rounded border border-[#D7CCC8]/40">
                                            <span className="font-bold text-[#8D6E63] text-[14px]">{approvalPercent}%</span>
                                            <span className="text-[#D7CCC8]">/</span>
                                            <span className="text-[#A1887F]">{t("detail.approvalThreshold", { pct: daoConfig.approvalThresholdBps / 100 })}</span>
                                        </div>
                                    </div>
                                )}

                                {/* 투표하기 */}
                                {isVoting && !votingEnded && (
                                    <div className="mt-6 pt-6 border-t border-[#D7CCC8]/40">
                                        <h3 className="text-[16px] font-bold text-[#3E2723] mb-5">
                                            {t("detail.vote")}
                                        </h3>
                                        <VotePanel
                                            proposal={proposal}
                                            activeListingIds={activeListingIds}
                                            councilMint={daoConfig.councilMint}
                                            onVoted={handleRefresh}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        <Footer />
        </>
    );
}
