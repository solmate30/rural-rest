import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useTranslation } from "react-i18next";
import { Button } from "~/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    getDaoProgram,
    getDaoConfigPda,
    getProposalPda,
    derivePropertyTokenPdas,
    parseDaoError,
} from "~/lib/dao-client";
import type { DaoConfigData } from "~/lib/dao.onchain.server";

export const CATEGORIES = [
    { value: "operations", label: "운영", arg: { operations: {} } },
    { value: "guidelines", label: "가이드라인", arg: { guidelines: {} } },
    { value: "fundUsage", label: "자금 사용", arg: { fundUsage: {} } },
    { value: "other", label: "기타", arg: { other: {} } },
] as const;

interface CreateProposalFormProps {
    daoConfig: DaoConfigData;
    activeListingIds: string[];
    onCreated?: () => void;
    onClose?: () => void;
    onPreviewChange?: (data: { title: string; category: string; markdown: string; votingDeadline: string }) => void;
}

export function CreateProposalForm({
    daoConfig,
    activeListingIds,
    onCreated,
    onClose,
    onPreviewChange,
}: CreateProposalFormProps) {
    const wallet = useWallet();
    const { connection } = useConnection();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t } = useTranslation("governance") as any;

    const [title, setTitle] = useState("");
    const [markdownContent, setMarkdownContent] = useState("");
    const [categoryValue, setCategoryValue] = useState<string>(CATEGORIES[0].value);
    // 기본 마감일: 7일 후
    const defaultDeadline = new Date(Date.now() + 7 * 86400 * 1000);
    const [votingDeadline, setVotingDeadline] = useState<string>(
        defaultDeadline.toISOString().slice(0, 16) // "YYYY-MM-DDTHH:mm"
    );
    const [loading, setLoading] = useState(false);
    const [issueLoading, setIssueLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const notifyPreview = (updates: Partial<{ title: string; category: string; markdown: string; votingDeadline: string }>) => {
        const current = {
            title: updates.title ?? title,
            category: updates.category ?? categoryValue,
            markdown: updates.markdown ?? markdownContent,
            votingDeadline: updates.votingDeadline ?? votingDeadline,
        };
        onPreviewChange?.(current);
    };

    const handleTitleChange = (v: string) => { setTitle(v); notifyPreview({ title: v }); };
    const handleCategoryChange = (v: string) => { setCategoryValue(v); notifyPreview({ category: v }); };
    const handleMarkdownChange = (v: string) => { setMarkdownContent(v); notifyPreview({ markdown: v }); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wallet.publicKey || !wallet.signTransaction) return;

        if (!title.trim()) {
            setError(t("form.errorTitle"));
            return;
        }

        // councilMint 유효성 검사 (validator 미실행 시 mock 주소 차단)
        try {
            const { PublicKey } = await import("@solana/web3.js");
            new PublicKey(daoConfig.councilMint);
        } catch {
            setError(t("form.errorDaoNotInit"));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // GitHub Issue 등록 (마크다운 내용이 있을 때)
            let finalDescriptionUri = "";

            if (markdownContent.trim()) {
                setIssueLoading(true);
                try {
                    const res = await fetch("/api/governance/issue", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            title: title.trim(),
                            content: markdownContent.trim(),
                            category: categoryValue,
                        }),
                    });
                    const data = await res.json();
                    if (res.ok && data.url) {
                        finalDescriptionUri = data.url;
                    }
                } catch {
                    // GitHub 등록 실패해도 제안은 계속 진행
                }
                setIssueLoading(false);
            }

            const program = await getDaoProgram(connection, wallet);
            const { SystemProgram } = await import("@solana/web3.js");
            const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");
            const { PublicKey } = await import("@solana/web3.js");

            const daoConfigPda = await getDaoConfigPda();
            const proposalPda = await getProposalPda(daoConfig.proposalCount);

            const councilMintPk = new PublicKey(daoConfig.councilMint);
            const creatorCouncilAta = getAssociatedTokenAddressSync(
                councilMintPk,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID
            );

            const propertyTokenPdas = await derivePropertyTokenPdas(activeListingIds, connection);

            const { BN } = await import("@coral-xyz/anchor");
            // 마감일에서 현재 시간을 뺀 초 단위 기간 계산
            const deadlineTs = Math.floor(new Date(votingDeadline).getTime() / 1000);
            const nowTs = Math.floor(Date.now() / 1000);
            const periodSecs = deadlineTs - nowTs;
            const customPeriod = new BN(periodSecs > 0 ? periodSecs : 0);

            await (program.methods as any)
                .createProposal(
                    title.trim(),
                    finalDescriptionUri,
                    CATEGORIES.find((c) => c.value === categoryValue)!.arg,
                    customPeriod,
                )
                .accounts({
                    creator: wallet.publicKey,
                    daoConfig: daoConfigPda,
                    proposal: proposalPda,
                    creatorCouncilAta,
                    councilMint: councilMintPk,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .remainingAccounts(
                    propertyTokenPdas.map((pubkey) => ({
                        pubkey,
                        isWritable: false,
                        isSigner: false,
                    }))
                )
                .rpc();

            onCreated?.();
        } catch (err: any) {
            setError(parseDaoError(err));
        } finally {
            setLoading(false);
        }
    };

    const buttonLabel = issueLoading
        ? t("form.uploadingIssue")
        : loading
            ? t("form.submitting")
            : t("form.submit");

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 분류 */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-[#5D4037]">
                    {t("form.category")}
                </label>
                <Select value={categoryValue} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-full rounded-lg bg-[#FAF9F6] border-[#D7CCC8] text-[#3E2723] focus:ring-[#8D6E63]/30 py-3.5 text-[15px] shadow-sm">
                        <SelectValue placeholder={t("form.categoryPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#D7CCC8]/60 text-[#3E2723] rounded-lg shadow-md">
                        {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                                {t(`card.cat${cat.value.charAt(0).toUpperCase()}${cat.value.slice(1)}`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 투표 마감일 */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-[#5D4037]">
                    {t("form.deadline")}
                </label>
                <input
                    type="datetime-local"
                    value={votingDeadline}
                    onChange={(e) => {
                        setVotingDeadline(e.target.value);
                        notifyPreview({ votingDeadline: e.target.value });
                    }}
                    min={new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 16)}
                    max={new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 16)}
                    className="w-full rounded-lg border border-[#D7CCC8] bg-[#FAF9F6] px-4 py-3.5 text-[15px] text-[#3E2723] focus:outline-none focus:ring-2 focus:ring-[#8D6E63]/30 focus:border-[#8D6E63] transition-all duration-300"
                />
                <p className="text-[11px] text-[#A1887F]">
                    {t("form.deadlineHint")}
                </p>
            </div>

            {/* 제목 */}
            <div className="space-y-2 relative group">
                <label className="text-sm font-semibold text-[#5D4037]">
                    {t("form.agendaTitle")}
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder={t("form.titlePlaceholder")}
                        maxLength={128}
                        className="w-full rounded-lg border border-[#D7CCC8] bg-[#FAF9F6] px-4 py-3.5 text-[15px] text-[#3E2723] placeholder:text-[#A1887F] focus:outline-none focus:ring-2 focus:ring-[#8D6E63]/30 focus:border-[#8D6E63] transition-all duration-300"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#A1887F] bg-white px-2 py-0.5 rounded border border-[#D7CCC8]/50">
                        {title.length}/128
                    </div>
                </div>
            </div>

            {/* 상세 설명 */}
            <div className="space-y-2">
                <label className="text-sm font-semibold text-[#5D4037]">
                    {t("form.description")} <span className="text-[#A1887F] font-normal ml-1">{t("form.descriptionOptional")}</span>
                </label>
                <textarea
                    value={markdownContent}
                    onChange={(e) => handleMarkdownChange(e.target.value)}
                    placeholder={t("form.descriptionPlaceholder")}
                    rows={16}
                    className="w-full rounded-lg border border-[#D7CCC8] bg-[#FAF9F6] px-4 py-3.5 text-[14px] text-[#3E2723] placeholder:text-[#A1887F]/60 focus:outline-none focus:ring-2 focus:ring-[#8D6E63]/30 focus:border-[#8D6E63] transition-all duration-300 resize-none font-mono leading-relaxed"
                />
                <p className="text-[11px] text-[#A1887F]">
                    {t("form.descriptionHint")}
                </p>
            </div>

            {/* 에러 */}
            {error && (
                <div className="p-4 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] flex gap-2 text-[#EF5350] text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                    {error}
                </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 pt-4 border-t border-[#D7CCC8]/30">
                {onClose && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 py-6 rounded-lg hover:bg-[#FAF9F6] text-[15px] border-[#D7CCC8] text-[#5D4037]"
                    >
                        {t("form.cancel")}
                    </Button>
                )}
                <Button
                    type="submit"
                    variant="wood"
                    disabled={loading || issueLoading || !title.trim()}
                    className="flex-1 py-6 rounded-lg text-[15px] font-bold bg-[#8D6E63] hover:bg-[#6D4C41] text-white shadow-sm disabled:opacity-50 transition-all duration-300"
                >
                    {(loading || issueLoading) ? (
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            {buttonLabel}
                        </div>
                    ) : (
                        t("form.submit")
                    )}
                </Button>
            </div>
        </form>
    );
}
