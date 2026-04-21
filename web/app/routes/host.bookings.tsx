import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { bookings, listings, user as userTable } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import type { Route } from "./+types/host.bookings";
import { fmtKrw } from "~/lib/formatters";
import { cn } from "~/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "~/components/ui/table";

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request, ["spv", "operator", "admin"]);

    const hostListings = await db
        .select({ id: listings.id, title: listings.title })
        .from(listings)
        .where(eq(listings.hostId, user.id));

    if (hostListings.length === 0) {
        return {
            bookingsByStatus: { pending: [], confirmed: [], cancelled: [], completed: [] },
            listingMap: {} as Record<string, string>,
            hostListings: [],
        };
    }

    const listingIds = hostListings.map((l) => l.id);
    const listingMap: Record<string, string> = Object.fromEntries(
        hostListings.map((l) => [l.id, l.title])
    );

    const allBookings = await db
        .select({
            id: bookings.id,
            listingId: bookings.listingId,
            checkIn: bookings.checkIn,
            checkOut: bookings.checkOut,
            totalPrice: bookings.totalPrice,
            status: bookings.status,
            escrowPda: bookings.escrowPda,
            paymentIntentId: bookings.paymentIntentId,
            onchainPayTx: bookings.onchainPayTx,
            createdAt: bookings.createdAt,
            guestName: userTable.name,
            guestEmail: userTable.email,
        })
        .from(bookings)
        .innerJoin(userTable, eq(bookings.guestId, userTable.id))
        .where(inArray(bookings.listingId, listingIds))
        .orderBy(bookings.createdAt);

    return {
        bookingsByStatus: {
            pending: allBookings.filter((b) => b.status === "pending"),
            confirmed: allBookings.filter((b) => b.status === "confirmed"),
            cancelled: allBookings.filter((b) => b.status === "cancelled"),
            completed: allBookings.filter((b) => b.status === "completed"),
        },
        listingMap,
        hostListings,
    };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BookingRow = Awaited<ReturnType<typeof loader>>["bookingsByStatus"]["pending"][number];
type Tab = "pending" | "confirmed" | "history";

/* ------------------------------------------------------------------ */
/*  BookingTable                                                       */
/* ------------------------------------------------------------------ */

const statusBadge: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    confirmed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
    completed: "bg-stone-100 text-stone-500 border-stone-200",
};

function BookingTable({
    rows,
    listingMap,
    showActions,
    showComplete,
    onApprove,
    onReject,
    onComplete,
    onCancelConfirmed,
    actionStates,
    completeStates,
    cancelConfirmedStates,
}: {
    rows: BookingRow[];
    listingMap: Record<string, string>;
    showActions?: boolean;
    showComplete?: boolean;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onComplete?: (id: string) => void;
    onCancelConfirmed?: (id: string) => void;
    actionStates?: Record<string, "idle" | "loading" | "error">;
    completeStates?: Record<string, "idle" | "loading" | "error">;
    cancelConfirmedStates?: Record<string, "idle" | "loading" | "error">;
}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t, i18n } = useTranslation("host") as any;
    const locale = i18n.language as string;

    function fmtDay(d: Date | null) {
        if (!d) return "—";
        return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(d));
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 text-stone-300 py-12">
                <span className="material-symbols-outlined text-[32px]">event_busy</span>
                <span className="text-sm">{t("bookings.empty")}</span>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="border-stone-100">
                    <TableHead className="pl-6">{t("bookings.colGuest")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("bookings.colProperty")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("bookings.colDates")}</TableHead>
                    <TableHead className="text-right">{t("bookings.colAmount")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("bookings.colMethod")}</TableHead>
                    {(showActions || showComplete)
                        ? <TableHead className="text-right pr-6">{t("bookings.colActions")}</TableHead>
                        : <TableHead className="hidden sm:table-cell">{t("bookings.colStatus")}</TableHead>
                    }
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((b) => {
                    const state = actionStates?.[b.id] ?? "idle";
                    const isLoading = state === "loading";
                    const cState = completeStates?.[b.id] ?? "idle";
                    const isCompleting = cState === "loading";
                    const ccState = cancelConfirmedStates?.[b.id] ?? "idle";
                    const isCancellingConfirmed = ccState === "loading";
                    const payMethod = b.paymentIntentId ? "card" : "usdc";
                    const isCheckedOut = b.checkOut != null && new Date(b.checkOut) < new Date();

                    return (
                        <>
                        <TableRow key={`row-${b.id}`} className="border-stone-100">
                            <TableCell className="pl-6">
                                <p className="text-sm font-semibold text-[#4a3b2c]">{b.guestName}</p>
                                <p className="text-xs text-stone-400 truncate max-w-[120px]">{b.guestEmail}</p>
                                {/* 모바일에서만 숙소명 인라인 표시 */}
                                <p className="text-xs text-stone-400 mt-0.5 sm:hidden">
                                    {listingMap[b.listingId] ?? b.listingId}
                                </p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                                <Link
                                    to={`/property/${b.listingId}`}
                                    className="text-sm text-[#4a3b2c] hover:underline font-medium"
                                >
                                    {listingMap[b.listingId] ?? b.listingId}
                                </Link>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <span className="text-sm text-stone-600 whitespace-nowrap">
                                    {fmtDay(b.checkIn)} — {fmtDay(b.checkOut)}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                                <span className="text-sm font-semibold text-[#4a3b2c] whitespace-nowrap">
                                    {fmtKrw(b.totalPrice)}
                                </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-xs rounded-full",
                                        payMethod === "card"
                                            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                            : "bg-violet-500/10 text-violet-600 border-violet-500/20"
                                    )}
                                >
                                    {payMethod === "card" ? t("bookings.methodCard") : t("bookings.methodUsdc")}
                                </Badge>
                            </TableCell>
                            {showActions ? (
                                <TableCell className="text-right pr-6">
                                    {state === "error" ? (
                                        <span className="text-xs text-red-500">{t("bookings.actionError")}</span>
                                    ) : (
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="success"
                                                disabled={isLoading}
                                                onClick={() => onApprove?.(b.id)}
                                            >
                                                {isLoading ? "…" : t("bookings.approve")}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50"
                                                disabled={isLoading}
                                                onClick={() => onReject?.(b.id)}
                                            >
                                                {t("bookings.reject")}
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            ) : showComplete ? (
                                <TableCell className="text-right pr-6">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            to={`/host/messages/${b.id}`}
                                            className="flex items-center gap-1 text-xs text-stone-400 hover:text-[#4a3b2c] transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                            <span className="hidden sm:inline">메시지</span>
                                        </Link>
                                        {cState === "error" || ccState === "error" ? (
                                            <span className="text-xs text-red-500">{t("bookings.actionError")}</span>
                                        ) : (
                                            <>
                                                {isCheckedOut ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                        disabled={isCompleting}
                                                        onClick={() => onComplete?.(b.id)}
                                                    >
                                                        {isCompleting ? "…" : t("bookings.complete")}
                                                    </Button>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn("text-xs rounded-full", statusBadge[b.status] ?? "")}
                                                    >
                                                        {t(`bookings.status.${b.status}`)}
                                                    </Badge>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-200 text-red-500 hover:bg-red-50"
                                                    disabled={isCancellingConfirmed}
                                                    onClick={() => onCancelConfirmed?.(b.id)}
                                                >
                                                    {isCancellingConfirmed ? "…" : "취소"}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            ) : (
                                <TableCell className="hidden sm:table-cell">
                                    <Badge
                                        variant="outline"
                                        className={cn("text-xs rounded-full", statusBadge[b.status] ?? "")}
                                    >
                                        {t(`bookings.status.${b.status}`)}
                                    </Badge>
                                </TableCell>
                            )}
                        </TableRow>
                        </>
                    );
                })}
            </TableBody>
        </Table>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HostBookings() {
    const { bookingsByStatus, listingMap } = useLoaderData<typeof loader>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t } = useTranslation("host") as any;

    const [activeTab, setActiveTab] = useState<Tab>("pending");
    const [pending, setPending] = useState(bookingsByStatus.pending);
    const [confirmed, setConfirmed] = useState(bookingsByStatus.confirmed);
    const [actionStates, setActionStates] = useState<Record<string, "idle" | "loading" | "error">>({});
    const [completeStates, setCompleteStates] = useState<Record<string, "idle" | "loading" | "error">>({});
    const [cancelConfirmedStates, setCancelConfirmedStates] = useState<Record<string, "idle" | "loading" | "error">>({});

    async function handleApprove(bookingId: string) {
        setActionStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setPending((l) => l.filter((b) => b.id !== bookingId));
            setActionStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    async function handleComplete(bookingId: string) {
        setCompleteStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/release-escrow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setConfirmed((l) => l.filter((b) => b.id !== bookingId));
            setCompleteStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setCompleteStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    async function handleCancelConfirmed(bookingId: string) {
        if (!confirm("확정된 예약을 취소하시겠습니까? 취소 정책에 따라 환불이 처리됩니다.")) return;
        setCancelConfirmedStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/cancel-confirmed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setConfirmed((l) => l.filter((b) => b.id !== bookingId));
            setCancelConfirmedStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setCancelConfirmedStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    async function handleReject(bookingId: string) {
        setActionStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setPending((l) => l.filter((b) => b.id !== bookingId));
            setActionStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    const tabs: { key: Tab; label: string; badge?: number }[] = [
        { key: "pending", label: t("bookings.tabPending"), badge: pending.length || undefined },
        { key: "confirmed", label: t("bookings.tabConfirmed") },
        { key: "history", label: t("bookings.tabHistory") },
    ];

    const historyRows = [...bookingsByStatus.cancelled, ...bookingsByStatus.completed];

    return (
        <div>
                {/* 헤더 */}
                <div className="flex items-end justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-[#4a3b2c]">{t("bookings.title")}</h1>
                        <p className="text-sm text-stone-400 mt-1">{t("bookings.subtitle")}</p>
                    </div>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-1 mb-6 bg-stone-100 rounded-2xl p-1 w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                                activeTab === tab.key
                                    ? "bg-white text-[#4a3b2c] shadow-sm"
                                    : "text-stone-500 hover:text-[#4a3b2c]"
                            )}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 탭 콘텐츠 */}
                <Card className="rounded-3xl border-stone-100 shadow-sm">
                    {activeTab === "pending" && (
                        <>
                            <CardHeader>
                                <CardTitle className="text-base font-bold text-[#4a3b2c]">
                                    {t("bookings.pendingDesc")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <BookingTable
                                    rows={pending}
                                    listingMap={listingMap}
                                    showActions
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                    actionStates={actionStates}
                                />
                            </CardContent>
                        </>
                    )}
                    {activeTab === "confirmed" && (
                        <CardContent className="p-0">
                            <BookingTable
                                rows={confirmed}
                                listingMap={listingMap}
                                showComplete
                                onComplete={handleComplete}
                                completeStates={completeStates}
                                onCancelConfirmed={handleCancelConfirmed}
                                cancelConfirmedStates={cancelConfirmedStates}
                            />
                        </CardContent>
                    )}
                    {activeTab === "history" && (
                        <CardContent className="p-0">
                            <BookingTable
                                rows={historyRows}
                                listingMap={listingMap}
                            />
                        </CardContent>
                    )}
                </Card>
        </div>
    );
}
