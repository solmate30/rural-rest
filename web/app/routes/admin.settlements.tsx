/**
 * admin.settlements.tsx
 * 정산 현황 — 운영중 매물 목록 + 매물별 정산 페이지 링크
 */

import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { listings, rwaTokens, operatorSettlements } from "~/db/schema";
import { eq, sql } from "drizzle-orm";
import type { Route } from "./+types/admin.settlements";
import { DateTime } from "luxon";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { fmtKrw } from "~/lib/formatters";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    // 토큰화된 매물 + 최신 정산 정보
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            region: listings.region,
            images: listings.images,
            tokenStatus: rwaTokens.status,
            tokenSymbol: rwaTokens.symbol,
            lastSettlementAt: rwaTokens.lastSettlementAt,
            totalSettlementUsdc: sql<number>`coalesce(sum(${operatorSettlements.settlementUsdc}), 0)`,
            settlementCount: sql<number>`count(${operatorSettlements.id})`,
        })
        .from(listings)
        .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .leftJoin(operatorSettlements, eq(operatorSettlements.listingId, listings.id))
        .groupBy(listings.id, rwaTokens.id)
        .orderBy(rwaTokens.status);

    return { rows };
}

const STATUS_CLASS: Record<string, string> = {
    draft: "bg-stone-100 text-stone-500",
    funding: "bg-amber-50 text-amber-600",
    funded: "bg-blue-50 text-blue-600",
    active: "bg-emerald-50 text-emerald-600",
    failed: "bg-red-50 text-red-500",
};

export default function AdminSettlements() {
    const { rows } = useLoaderData<typeof loader>();
    const { t } = useTranslation("admin");

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#4a3b2c]">{t("settlements.title")}</h1>
                <p className="text-sm text-[#a0856c] mt-1">{t("settlements.subtitle")}</p>
            </div>

            {rows.length === 0 ? (
                <div className="text-center py-20 text-[#c4aa92]">
                    <p className="text-sm">{t("settlements.empty")}</p>
                </div>
            ) : (
                <div className="divide-y divide-[#e8e0d6] border border-[#e8e0d6] rounded-2xl bg-[#fcfaf7] overflow-hidden">
                    {rows.map((row) => (
                        <Link
                            key={row.id}
                            to={`/admin/settlements/${row.id}`}
                            className="flex items-center gap-4 px-6 py-4 hover:bg-[#f5f0ea] transition-colors"
                        >
                            {/* 썸네일 */}
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                                {(row.images as string[])[0] ? (
                                    <img src={(row.images as string[])[0]} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">
                                        없음
                                    </div>
                                )}
                            </div>

                            {/* 정보 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-semibold text-[#4a3b2c] truncate">{row.title}</p>
                                    {row.tokenSymbol && (
                                        <span className="text-xs text-[#c4aa92] font-mono shrink-0">{row.tokenSymbol}</span>
                                    )}
                                </div>
                                <p className="text-xs text-[#a0856c]">{row.region}</p>
                            </div>

                            {/* 상태 */}
                            <span className={cn("text-xs font-medium px-2 py-1 rounded-full shrink-0", STATUS_CLASS[row.tokenStatus ?? "draft"])}>
                                {t(`settlements.status.${row.tokenStatus ?? "draft"}` as any)}
                            </span>

                            {/* 정산 횟수 */}
                            <div className="text-right shrink-0 w-28">
                                <p className="text-sm font-semibold text-[#4a3b2c]">{t("settlements.settledCount", { count: Number(row.settlementCount) })}</p>
                            </div>

                            {/* 마지막 정산일 */}
                            <div className="text-right shrink-0 w-28">
                                <p className="text-sm text-[#4a3b2c]">
                                    {row.lastSettlementAt
                                        ? DateTime.fromJSDate(new Date(row.lastSettlementAt)).toFormat("yyyy.MM.dd")
                                        : "—"}
                                </p>
                                <p className="text-xs text-[#a0856c]">{t("settlements.lastSettlement")}</p>
                            </div>

                            {/* 화살표 */}
                            <span className="text-[#c4aa92] shrink-0">→</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
