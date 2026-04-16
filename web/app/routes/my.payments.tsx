import { useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { bookings, listings } from "~/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Route } from "./+types/my.payments";
import { fmtKrw } from "~/lib/formatters";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request);

    const rows = await db
        .select({
            id: bookings.id,
            listingId: bookings.listingId,
            listingTitle: listings.title,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            totalPrice: bookings.totalPrice,
            totalPriceUsdc: bookings.totalPriceUsdc,
            status: bookings.status,
            escrowPda: bookings.escrowPda,
            onchainPayTx: bookings.onchainPayTx,
            paypalAuthorizationId: bookings.paypalAuthorizationId,
            createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(listings, eq(bookings.listingId, listings.id))
        .where(eq(bookings.guestId, user.id))
        .orderBy(desc(bookings.createdAt));

    return {
        payments: rows.map((r) => ({
            ...r,
            method: r.escrowPda ? ("usdc" as const) : ("card" as const),
        })),
    };
}

const statusConfig: Record<string, { label: string; labelEn: string; color: string }> = {
    pending:   { label: "대기",   labelEn: "Pending",   color: "text-amber-600 bg-amber-50" },
    confirmed: { label: "완료",   labelEn: "Paid",      color: "text-[#17cf54] bg-[#17cf54]/10" },
    cancelled: { label: "환불됨", labelEn: "Refunded",  color: "text-stone-400 bg-stone-100" },
    completed: { label: "정산됨", labelEn: "Settled",   color: "text-blue-600 bg-blue-50" },
};

export default function MyPayments() {
    const { payments } = useLoaderData<typeof loader>();
    const { i18n } = useTranslation();
    const { t } = useTranslation("myPage");
    const locale = i18n.language;

    function fmtDate(d: Date | null) {
        if (!d) return "—";
        return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(d));
    }

    return (
        <div>
            <h1 className="text-xl font-bold text-[#4a3b2c] mb-6">{t("nav.payments")}</h1>

            {payments.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-16 flex flex-col items-center gap-3 text-center">
                    <span className="material-symbols-outlined text-[48px] text-stone-200">receipt_long</span>
                    <p className="font-semibold text-stone-400">{t("payments.empty")}</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                    {/* 헤더 */}
                    <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 bg-stone-50 border-b border-stone-100 text-xs font-semibold text-stone-400 uppercase tracking-wide">
                        <span>{t("payments.property")}</span>
                        <span className="text-right">{t("payments.method")}</span>
                        <span className="text-right w-24">{t("payments.amount")}</span>
                        <span className="text-right w-20">{t("payments.payStatus")}</span>
                    </div>

                    <div className="divide-y divide-stone-100">
                        {payments.map((p) => {
                            const cfg = statusConfig[p.status] ?? statusConfig.pending;
                            const statusLabel = locale === "ko" ? cfg.label : cfg.labelEn;

                            return (
                                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 hover:bg-stone-50 transition-colors">
                                    {/* 숙소 + 날짜 */}
                                    <div>
                                        <p className="font-semibold text-[#4a3b2c] text-sm leading-snug">{p.listingTitle}</p>
                                        <p className="text-xs text-stone-400 mt-0.5">
                                            {fmtDate(p.checkIn)} — {fmtDate(p.checkOut)}
                                        </p>
                                        <p className="text-xs text-stone-300 mt-0.5">
                                            {fmtDate(p.createdAt)}
                                        </p>
                                    </div>

                                    {/* 결제 수단 */}
                                    <div className="sm:text-right flex sm:block items-center gap-2">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                                            p.method === "usdc"
                                                ? "bg-purple-50 text-purple-600"
                                                : "bg-blue-50 text-blue-600"
                                        )}>
                                            <span className="material-symbols-outlined text-[12px]">
                                                {p.method === "usdc" ? "currency_bitcoin" : "credit_card"}
                                            </span>
                                            {p.method === "usdc" ? "USDC" : t("payments.card")}
                                        </span>
                                        {/* 온체인 tx 링크 */}
                                        {p.onchainPayTx && (
                                            <a
                                                href={`https://explorer.solana.com/tx/${p.onchainPayTx}?cluster=devnet`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-stone-400 hover:text-purple-600 underline underline-offset-2"
                                            >
                                                Tx
                                            </a>
                                        )}
                                    </div>

                                    {/* 금액 */}
                                    <div className="sm:text-right sm:w-24">
                                        <p className="font-bold text-[#4a3b2c] text-sm">{fmtKrw(p.totalPrice)}</p>
                                        {p.totalPriceUsdc && (
                                            <p className="text-xs text-stone-400">
                                                {(p.totalPriceUsdc / 1_000_000).toFixed(2)} USDC
                                            </p>
                                        )}
                                    </div>

                                    {/* 상태 */}
                                    <div className="sm:text-right sm:w-20">
                                        <span className={cn(
                                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                                            cfg.color
                                        )}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
