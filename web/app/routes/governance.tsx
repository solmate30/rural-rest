import { useState, useCallback } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import type { Route } from "./+types/governance";
import { fetchDaoConfig, fetchAllProposals, fetchActiveListingIds } from "~/lib/dao.onchain.server";
import type { DaoConfigData, ProposalData } from "~/lib/dao.onchain.server";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { checkCouncilTokenBalance } from "~/lib/dao-client";

import { Button } from "~/components/ui/button";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

import { Header, Footer } from "~/components/ui-mockup";
import { DaoStats } from "~/components/governance/DaoStats";
import { ProposalCard } from "~/components/governance/ProposalCard";
import { CreateProposalForm } from "~/components/governance/CreateProposalForm";
import { useEffect } from "react";


function getMockData(): { daoConfig: DaoConfigData; proposals: ProposalData[]; activeListingIds: string[] } {
    const now = Math.floor(Date.now() / 1000);
    return {
        daoConfig: {
            authority: "9WzDXwBbmPEd3aTqUVJewSqMfpB9Y7dBo5TDZGQL8sHm",
            councilMint: "CoUNciLtOkEnMiNtXxXxXxXxXxXxXxXxXxXxXxXxXx11",
            votingPeriod: 604800,
            quorumBps: 2000,
            approvalThresholdBps: 6000,
            votingCapBps: 1000,
            proposalCount: 5,
            rwaProgram: "EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR",
        },
        proposals: [
            {
                id: 0, pda: "Prop0xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                title: "경주 한옥마을 예약 취소 정책 개정",
                descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/1",
                category: "operations", status: "voting",
                votesFor: 28, votesAgainst: 8, votesAbstain: 4,
                totalEligibleWeight: 65, voterCount: 12,
                votingStartsAt: now - 86400 * 2, votingEndsAt: now + 86400 * 5,
                createdAt: now - 86400 * 2,
            },
            {
                id: 1, pda: "Prop1xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                creator: "CouNcilMem2xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                title: "마을 공동 기금 사용 -- 전통 체험 프로그램 운영비",
                descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/2",
                category: "fundUsage", status: "voting",
                votesFor: 5, votesAgainst: 2, votesAbstain: 0,
                totalEligibleWeight: 65, voterCount: 3,
                votingStartsAt: now - 3600, votingEndsAt: now + 86400 * 6,
                createdAt: now - 3600,
            },
            {
                id: 2, pda: "Prop2xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                title: "브랜드 가이드라인 v2 채택 -- 사진 촬영 기준",
                descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/3",
                category: "guidelines", status: "succeeded",
                votesFor: 42, votesAgainst: 10, votesAbstain: 6,
                totalEligibleWeight: 65, voterCount: 18,
                votingStartsAt: now - 86400 * 14, votingEndsAt: now - 86400 * 7,
                createdAt: now - 86400 * 14,
            },
            {
                id: 3, pda: "Prop3xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                creator: "CouNcilMem2xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                title: "동절기 난방비 추가 요금 도입",
                descriptionUri: "https://github.com/rural-rest/dao-proposals/issues/4",
                category: "operations", status: "defeated",
                votesFor: 8, votesAgainst: 30, votesAbstain: 12,
                totalEligibleWeight: 65, voterCount: 21,
                votingStartsAt: now - 86400 * 21, votingEndsAt: now - 86400 * 14,
                createdAt: now - 86400 * 21,
            },
            {
                id: 4, pda: "Prop4xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                creator: "CouNcilMem1xXxXxXxXxXxXxXxXxXxXxXxXxXxXx11",
                title: "긴급 안건 -- 수해 복구 기금 요청",
                descriptionUri: "",
                category: "fundUsage", status: "cancelled",
                votesFor: 0, votesAgainst: 0, votesAbstain: 0,
                totalEligibleWeight: 65, voterCount: 0,
                votingStartsAt: now - 86400 * 3, votingEndsAt: now + 86400 * 4,
                createdAt: now - 86400 * 3,
            },
        ],
        activeListingIds: ["gyeongju-001", "gyeongju-002", "gyeongju-003", "gyeongju-004", "gyeongju-005"],
    };
}

export async function loader({ request }: Route.LoaderArgs) {
    const daoConfig = await fetchDaoConfig();

    if (daoConfig) {
        const [proposals, activeListingIds] = await Promise.all([
            fetchAllProposals(daoConfig.proposalCount),
            fetchActiveListingIds(),
        ]);
        return { daoConfig, proposals, activeListingIds, isMock: false };
    }

    const mock = getMockData();
    return { daoConfig: mock.daoConfig, proposals: mock.proposals, activeListingIds: mock.activeListingIds, isMock: true };
}

export default function GovernancePage() {
    const { daoConfig, proposals, activeListingIds, isMock } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const revalidator = useRevalidator();
    const wallet = useWallet();
    const { connection } = useConnection();

    const [activeTab, setActiveTab] = useState<"voting" | "completed" | "all">("voting");
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [isCouncilMember, setIsCouncilMember] = useState(false);
    const [rulesOpen, setRulesOpen] = useState(false);

    useEffect(() => {
        async function check() {
            if (!wallet.publicKey || !daoConfig || !connection) {
                console.log("[DAO] 지갑 미연결 또는 config 없음", { wallet: wallet.publicKey?.toBase58(), daoConfig: !!daoConfig });
                setIsCouncilMember(false);
                return;
            }
            console.log("[DAO] Council Token 체크:", { wallet: wallet.publicKey.toBase58(), councilMint: daoConfig.councilMint });
            const balance = await checkCouncilTokenBalance(
                connection, daoConfig.councilMint, wallet.publicKey
            );
            console.log("[DAO] Council Token 잔액:", balance);
            setIsCouncilMember(balance > 0);
        }
        check();
    }, [wallet.publicKey, daoConfig, connection]);

    const handleRefresh = useCallback(() => {
        revalidator.revalidate();
        setCreateDialogOpen(false);
    }, [revalidator]);

    const votingProposals = proposals.filter((p) => p.status === "voting");
    const completedProposals = proposals.filter((p) => p.status !== "voting");
    let displayedProposals =
        activeTab === "voting" ? votingProposals :
        activeTab === "completed" ? completedProposals :
        [...proposals].reverse();

    if (activeCategory !== "all") {
        displayedProposals = displayedProposals.filter((p) => p.category === activeCategory);
    }

    if (!daoConfig) {
        return (
            <>
                <Header />
                <main className="container mx-auto py-16 px-4 sm:px-8 min-h-[calc(100vh-160px)]">
                    <div className="text-center space-y-4">
                        <h1 className="text-3xl font-bold text-[#3E2723]">거버넌스</h1>
                        <p className="text-[#8D6E63]">
                            DAO가 아직 초기화되지 않았습니다.
                        </p>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    const tabs = [
        { key: "voting" as const, label: "투표중", count: votingProposals.length },
        { key: "completed" as const, label: "완료", count: completedProposals.length },
        { key: "all" as const, label: "전체", count: proposals.length },
    ];

    return (
        <>
        <Header />
        <main className="min-h-[calc(100vh-160px)] pb-20">
            {/* 히어로 & 파라미터 영역 */}
            <div className="relative pt-16 pb-24 overflow-hidden bg-[#FAF9F6] border-b border-[#D7CCC8]/40">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-[#D7CCC8]/20 to-transparent blur-3xl rounded-full"></div>
                <div className="absolute top-20 left-10 w-64 h-64 bg-[#8D6E63]/5 blur-3xl rounded-full"></div>
                
                <div className="container mx-auto px-4 sm:px-8 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div className="max-w-xl">
                            <h1 className="text-4xl sm:text-5xl font-bold text-[#3E2723] tracking-tight leading-tight mb-3">
                                Rural Rest 거버넌스
                            </h1>
                            <p className="text-lg text-[#5D4037] font-medium">
                                마을의 중요한 생태계 정책과 자금 운용을 제안하고 투표하세요.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {(isCouncilMember || isMock) && (
                                <Button 
                                    variant="wood" 
                                    size="lg" 
                                    onClick={() => navigate("/governance/new")}
                                    className="rounded-none px-6 font-bold bg-[#8D6E63] hover:bg-[#6D4C41] text-white shadow-sm transition-all focus:ring-2 focus:ring-[#8D6E63]/30 tracking-widest text-xs uppercase"
                                >
                                    새 안건 상정
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* 파라미터 뷰 */}
                    <DaoStats config={daoConfig} />

                    {/* 거버넌스 규칙 접이식 */}
                    <div className="border border-[#D7CCC8]/60 bg-[#FCFBF8]">
                        <button
                            onClick={() => setRulesOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                        >
                            <span className="text-[11px] font-bold tracking-widest uppercase text-[#A1887F]">
                                거버넌스 참여 규칙
                            </span>
                            <span className="text-[#A1887F] text-xs font-mono transition-transform duration-200" style={{ display: "inline-block", transform: rulesOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                                &#x25BE;
                            </span>
                        </button>
                        {rulesOpen && (
                            <div className="px-5 pb-5 pt-1 grid sm:grid-cols-2 gap-x-10 gap-y-3 border-t border-[#D7CCC8]/40">
                                {[
                                    { label: "제안 등록", desc: "Council Token 보유자만 안건을 상정할 수 있습니다. Council Token은 마을 운영자·지자체 담당자에게 발급됩니다." },
                                    { label: "투표권", desc: `RWA 토큰 보유 수량 1개당 1표, Council Token 보유 시 추가 1표가 부여됩니다.` },
                                    { label: "가결 조건", desc: `전체 투표권의 ${daoConfig.quorumBps / 100}% 이상 참여하고, 찬성표가 ${daoConfig.approvalThresholdBps / 100}% 이상이면 가결됩니다.` },
                                    { label: "1인 투표 한도", desc: `한 사람이 행사할 수 있는 투표는 전체의 최대 ${daoConfig.votingCapBps / 100}%로 제한됩니다. 특정 세력의 독점을 방지합니다.` },
                                ].map(({ label, desc }) => (
                                    <div key={label} className="pt-3">
                                        <p className="text-[11px] font-bold tracking-widest uppercase text-[#8D6E63] mb-1">{label}</p>
                                        <p className="text-[13px] text-[#5D4037] leading-relaxed">{desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-8 mt-12">
                {/* 탭 영역 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-[#D7CCC8]/40">
                    <div className="flex items-center gap-4 sm:gap-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`
                                    relative py-2 text-[15px] font-bold transition-colors group
                                    ${activeTab === tab.key
                                        ? "text-foreground"
                                        : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    {tab.label}
                                    <span className={`
                                        px-2 py-0.5 rounded-full text-xs font-mono
                                        ${activeTab === tab.key 
                                            ? "bg-foreground text-background" 
                                            : "bg-stone-100 dark:bg-stone-800 text-stone-500 group-hover:bg-stone-200 dark:group-hover:bg-stone-700"
                                        } transition-colors
                                    `}>
                                        {tab.count}
                                    </span>
                                </div>
                                {activeTab === tab.key && (
                                    <span className="absolute -bottom-[18px] left-0 right-0 h-1 bg-[#8D6E63] rounded-t-lg shadow" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#8D6E63]">
                            카테고리
                        </span>
                        <Select value={activeCategory} onValueChange={setActiveCategory}>
                            <SelectTrigger className="w-[160px] bg-[#FAF9F6] border-[#D7CCC8]/60 text-[#3E2723] focus:ring-[#8D6E63]/30 rounded-lg shadow-sm">
                                <SelectValue placeholder="카테고리 필터" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-[#D7CCC8]/60 text-[#3E2723] rounded-lg shadow-md">
                                <SelectItem value="all">전체보기</SelectItem>
                                <SelectItem value="operations">운영</SelectItem>
                                <SelectItem value="guidelines">가이드라인</SelectItem>
                                <SelectItem value="fundUsage">자금 사용</SelectItem>
                                <SelectItem value="other">기타</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 제안 목록 */}
                {displayedProposals.length === 0 ? (
                    <div className="py-24 flex flex-col items-center justify-center bg-[#FCFBF8] border border-[#D7CCC8]/40 shadow-sm mt-4">
                        <h3 className="text-lg font-bold text-[#5D4037] mb-2">
                            {activeTab === "voting" ? "진행중인 투표가 없습니다." :
                             activeTab === "completed" ? "완료된 제안이 없습니다." :
                             "등록된 제안이 없습니다."}
                        </h3>
                        <p className="text-[13px] text-[#A1887F] tracking-wide">
                            새로운 안건이 상정되면 이곳에 표시됩니다.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {displayedProposals.map((p) => (
                            <ProposalCard
                                key={p.id}
                                proposal={p}
                                quorumBps={daoConfig.quorumBps}
                                onClick={() => navigate(`/governance/${p.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
        <Footer />
        </>
    );
}
