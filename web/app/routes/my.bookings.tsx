import { Link, useLoaderData } from "react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { bookings, listings } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import type { Route } from "./+types/my.bookings";
import { fmtKrw } from "~/lib/formatters";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request);

    const rows = await db
        .select({
            id: bookings.id,
            listingId: bookings.listingId,
            listingTitle: listings.title,
            listingImage: listings.images,
            listingLocation: listings.location,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            totalPrice: bookings.totalPrice,
            status: bookings.status,
            escrowPda: bookings.escrowPda,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .where(eq(bookings.guestId, user.id))
        .orderBy(desc(bookings.createdAt));

    return {
        myBookings: rows.map((r) => ({
            ...r,
            listingImage: (r.listingImage as string[])?.[0] ?? null,
            isUsdc: !!r.escrowPda,
        })),
    };
}

const statusConfig: Record<string, { label: string; labelEn: string; bg: string; text: string; border: string }> = {
    pending:   { label: "승인 대기", labelEn: "Awaiting Approval", bg: "bg-amber-500/10",   text: "text-amber-600",   border: "border-amber-500/20" },
    confirmed: { label: "확정",      labelEn: "Confirmed",          bg: "bg-[#17cf54]/10",  text: "text-[#17cf54]",  border: "border-[#17cf54]/20" },
    cancelled: { label: "취소됨",    labelEn: "Cancelled",          bg: "bg-stone-100",     text: "text-stone-400",  border: "border-stone-200" },
    completed: { label: "완료",      labelEn: "Completed",          bg: "bg-blue-500/10",   text: "text-blue-600",   border: "border-blue-500/20" },
};

export default function MyBookings() {
    const { myBookings } = useLoaderData<typeof loader>();
    const { i18n } = useTranslation();
    const { t } = useTranslation("myBookings");
    const locale = i18n.language;
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

    function fmtDay(d: Date | null) {
        if (!d) return "—";
        return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(d));
    }

    function nights(checkIn: Date | null, checkOut: Date | null) {
        if (!checkIn || !checkOut) return 0;
        return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000);
    }

    async function handleGuestCancel(bookingId: string) {
        if (!confirm(t("cancelConfirm"))) return;
        setCancellingId(bookingId);
        try {
            const res = await fetch("/api/booking/guest-cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId }),
            });
            if (res.ok) {
                setCancelledIds((prev) => new Set(prev).add(bookingId));
            } else {
                const data = await res.json();
                alert(data.error ?? t("cancelError"));
            }
        } catch {
            alert(t("cancelError"));
        } finally {
            setCancellingId(null);
        }
    }

    return (
        <div>
            <h1 className="text-xl font-bold text-[#4a3b2c] mb-6">{t("title")}</h1>

            {myBookings.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-16 flex flex-col items-center gap-4 text-center">
                    <span className="material-symbols-outlined text-[48px] text-stone-200">luggage</span>
                    <p className="font-semibold text-stone-400">{t("empty")}</p>
                    <Link
                        to="/"
                        className="mt-2 text-sm font-semibold text-white bg-[#17cf54] hover:bg-[#13b347] px-5 py-2.5 rounded-xl transition-colors"
                    >
                        {t("findStay")}
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {myBookings.map((b) => {
                        const effectiveStatus = cancelledIds.has(b.id) ? "cancelled" : b.status;
                        const cfg = statusConfig[effectiveStatus] ?? statusConfig.pending;
                        const label = locale === "ko" ? cfg.label : cfg.labelEn;
                        const n = nights(b.checkIn, b.checkOut);
                        const isCancelling = cancellingId === b.id;

                        return (
                            <div key={b.id} className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="flex gap-4 p-5">
                                    <Link to={`/property/${b.listingId}`} className="shrink-0">
                                        <div className="w-24 h-20 rounded-2xl overflow-hidden bg-stone-100">
                                            {b.listingImage ? (
                                                <img src={b.listingImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-stone-300 text-[24px]">home</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <Link to={`/property/${b.listingId}`} className="font-bold text-[#4a3b2c] hover:underline leading-tight">
                                                    {b.listingTitle}
                                                </Link>
                                                <p className="text-xs text-stone-400 mt-0.5">{b.listingLocation}</p>
                                            </div>
                                            <span className={cn(
                                                "shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border",
                                                cfg.bg, cfg.text, cfg.border
                                            )}>
                                                {label}
                                            </span>
                                        </div>

                                        <div className="mt-3 flex items-center gap-3 text-sm text-stone-600">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px] text-stone-300">calendar_today</span>
                                                {fmtDay(b.checkIn)} — {fmtDay(b.checkOut)}
                                            </span>
                                            <span className="text-stone-200">|</span>
                                            <span>{t("nights", { count: n })}</span>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <span className="font-bold text-[#4a3b2c]">{fmtKrw(b.totalPrice)}</span>

                                            {effectiveStatus === "pending" && (
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                                                        {t("pendingNote")}
                                                    </p>
                                                    <button
                                                        onClick={() => handleGuestCancel(b.id)}
                                                        disabled={isCancelling}
                                                        className="text-xs text-stone-400 hover:text-red-500 underline underline-offset-2 transition-colors disabled:opacity-50"
                                                    >
                                                        {isCancelling ? t("cancelling") : t("cancelRequest")}
                                                    </button>
                                                </div>
                                            )}

                                            {effectiveStatus === "cancelled" && (
                                                <p className="text-xs text-stone-400 bg-stone-50 px-2.5 py-1 rounded-lg">
                                                    {b.isUsdc ? t("refundedUsdc") : t("refundedCard")}
                                                </p>
                                            )}
                                        </div>

                                        {(effectiveStatus === "confirmed" || effectiveStatus === "completed") && (
                                            <div className="mt-3 pt-3 border-t border-stone-100">
                                                <Link
                                                    to={`/my/messages/${b.id}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#4a3b2c] transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">chat_bubble</span>
                                                    호스트에게 메시지 보내기
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
