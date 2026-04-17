/**
 * admin.treasury.tsx
 * Treasury 관리 — 플랫폼 수수료 현황
 */

import { useLoaderData } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Route } from "./+types/admin.treasury";
import { DateTime } from "luxon";
import { TREASURY_PUBKEY } from "~/lib/constants.server";
import { fmtUsdc, fmtKrw } from "~/lib/formatters";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const rows = await db
        .select({
            id: bookings.id,
            listingTitle: listings.title,
            totalPriceUsdc: bookings.totalPriceUsdc,
            platformFeeKrw: bookings.platformFeeKrw,
            escrowPda: bookings.escrowPda,
            createdAt: bookings.createdAt,
        })
        .from(bookings)
        .leftJoin(listings, eq(listings.id, bookings.listingId))
        .where(eq(bookings.status, "completed"))
        .orderBy(desc(bookings.createdAt))
        .limit(50);

    const totalUsdcMicro = rows
        .filter((r) => r.escrowPda != null && r.totalPriceUsdc != null)
        .reduce((sum, r) => sum + Math.floor((r.totalPriceUsdc ?? 0) / 10), 0);

    const totalKrw = rows
        .filter((r) => r.platformFeeKrw != null)
        .reduce((sum, r) => sum + (r.platformFeeKrw ?? 0), 0);

    return { treasuryPubkey: TREASURY_PUBKEY, totalUsdcMicro, totalKrw, rows };
}

export default function AdminTreasury() {
    const { treasuryPubkey, totalUsdcMicro, totalKrw, rows } = useLoaderData<typeof loader>();

    return (
        <div className="space-y-6 pb-10">
            <div>
                <h1 className="text-2xl font-bold text-[#4a3b2c]">Treasury 관리</h1>
                <p className="text-sm text-[#a0856c] mt-1">플랫폼 수수료 수익 현황</p>
            </div>

            {/* Treasury 주소 */}
            <div className="bg-[#fcfaf7] border border-[#e8e0d6] rounded-2xl p-4 sm:p-5">
                <p className="text-xs font-semibold text-[#a0856c] uppercase tracking-wide mb-1">Treasury 주소</p>
                <p className="font-mono text-sm text-[#4a3b2c] break-all">{treasuryPubkey}</p>
            </div>

            {/* 누적 수수료 요약 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#fcfaf7] border border-[#e8e0d6] rounded-2xl p-5">
                    <p className="text-xs font-semibold text-[#a0856c] uppercase tracking-wide mb-1">누적 USDC 수수료</p>
                    <p className="text-2xl font-bold text-[#4a3b2c]">{fmtUsdc(totalUsdcMicro / 1_000_000)}</p>
                    <p className="text-xs text-[#c4aa92] mt-1">에스크로 결제 10%</p>
                </div>
                <div className="bg-[#fcfaf7] border border-[#e8e0d6] rounded-2xl p-5">
                    <p className="text-xs font-semibold text-[#a0856c] uppercase tracking-wide mb-1">누적 KRW 수수료</p>
                    <p className="text-2xl font-bold text-[#4a3b2c]">{fmtKrw(totalKrw)}</p>
                    <p className="text-xs text-[#c4aa92] mt-1">카드 결제 10%</p>
                </div>
            </div>

            {/* 수수료 내역 */}
            <div>
                <h2 className="text-sm font-semibold text-[#4a3b2c] mb-3">수수료 내역 (최근 50건)</h2>
                {rows.length === 0 ? (
                    <div className="text-center py-16 text-[#c4aa92] text-sm">
                        완료된 예약이 없습니다.
                    </div>
                ) : (
                    <div className="divide-y divide-[#e8e0d6] border border-[#e8e0d6] rounded-2xl bg-[#fcfaf7] overflow-hidden">
                        <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold text-[#a0856c] uppercase tracking-wide">
                            <span>매물</span>
                            <span className="text-right">수수료</span>
                            <span className="text-right">결제 방식</span>
                            <span className="text-right">완료일</span>
                        </div>
                        {rows.map((row) => {
                            const isUsdc = row.escrowPda != null;
                            const feeDisplay = isUsdc
                                ? fmtUsdc(Math.floor((row.totalPriceUsdc ?? 0) / 10) / 1_000_000)
                                : fmtKrw(row.platformFeeKrw ?? 0);

                            return (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-3.5 items-center"
                                >
                                    <p className="text-sm text-[#4a3b2c] truncate">{row.listingTitle ?? "—"}</p>
                                    <p className="text-sm font-semibold text-[#4a3b2c] text-right whitespace-nowrap">
                                        {feeDisplay}
                                    </p>
                                    <span className={`hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${isUsdc ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                                        {isUsdc ? "USDC" : "카드"}
                                    </span>
                                    <p className="hidden sm:block text-xs text-[#a0856c] text-right whitespace-nowrap">
                                        {row.createdAt
                                            ? DateTime.fromJSDate(new Date(row.createdAt)).toFormat("yyyy.MM.dd")
                                            : "—"}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
