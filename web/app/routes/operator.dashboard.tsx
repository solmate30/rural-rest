import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { WalletConnectSection } from "../components/WalletConnectSection";
import {
    getDashboardStats,
    getOperatorListings,
    getOperatorBookings,
    getOperatorSettlements,
    type DashboardStats,
    type HostListingRow,
    type OperatorBookingRow,
    type OperatorSettlementRow,
} from "../lib/admin-dashboard.server";
import type { Route } from "./+types/operator.dashboard";
import { cn } from "~/lib/utils";
import { fmtKrw } from "~/lib/formatters";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request, ["operator", "admin"]);
    const [stats, listings, bookings, settlements] = await Promise.all([
        getDashboardStats(user.id),
        getOperatorListings(user.id),
        getOperatorBookings(user.id),
        getOperatorSettlements(user.id),
    ]);
    return { user, stats, listings, bookings, settlements };
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

type Tab = "pending" | "confirmed" | "settlements" | "listings" | "wallet";

export default function OperatorDashboard() {
    const { t } = useTranslation("operator");
    const { user, stats, listings, bookings, settlements } = useLoaderData() as {
        user: { walletAddress: string | null };
        stats: DashboardStats;
        listings: HostListingRow[];
        bookings: OperatorBookingRow[];
        settlements: OperatorSettlementRow[];
    };

    const [activeTab, setActiveTab] = useState<Tab>("pending");
    const [pendingBookings, setPendingBookings] = useState(
        bookings.filter((b) => b.status === "pending")
    );
    const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
    const [actionStates, setActionStates] = useState<Record<string, "idle" | "loading" | "error">>({});
    const [releaseStates, setReleaseStates] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});

    async function handleRelease(bookingId: string) {
        setReleaseStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/release-escrow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        setReleaseStates((s) => ({ ...s, [bookingId]: res.ok ? "done" : "error" }));
    }

    async function handleApprove(bookingId: string) {
        setActionStates((s) => ({ ...s, [bookingId]: "loading" }));
        const res = await fetch("/api/booking/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId }),
        });
        if (res.ok) {
            setPendingBookings((l) => l.filter((b) => b.id !== bookingId));
            setActionStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
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
            setPendingBookings((l) => l.filter((b) => b.id !== bookingId));
            setActionStates((s) => { const n = { ...s }; delete n[bookingId]; return n; });
        } else {
            setActionStates((s) => ({ ...s, [bookingId]: "error" }));
        }
    }

    const tabs: { key: Tab; label: string; badge?: number }[] = [
        { key: "pending", label: t("tab.pending"), badge: pendingBookings.length || undefined },
        { key: "confirmed", label: t("tab.confirmed") },
        { key: "settlements", label: t("tab.settlements") },
        { key: "listings", label: t("tab.listings") },
        { key: "wallet", label: t("tab.wallet") },
    ];

    const statItems = [
        { icon: "payments", label: t("stats.monthlyRevenue"), value: fmtKrw(stats.totalRevenueThisMonth), color: "text-[#17cf54]", bg: "bg-[#17cf54]/10" },
        { icon: "pending_actions", label: t("stats.pendingBookings"), value: pendingBookings.length, color: "text-amber-600", bg: "bg-amber-500/10" },
        { icon: "login", label: t("stats.todayCheckin"), value: stats.todayCheckIns, color: "text-blue-600", bg: "bg-blue-500/10" },
        { icon: "home", label: t("stats.occupancy30d"), value: `${stats.occupancyRatePercent}%`, color: "text-stone-500", bg: "bg-stone-100" },
    ];

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-10 pb-16 px-4 sm:px-8 max-w-4xl">

                {/* 페이지 헤더 */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#4a3b2c]">{t("title")}</h1>
                    <p className="text-sm text-stone-400 mt-1">{t("subtitle", { count: listings.length })}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {statItems.map((s) => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", s.bg)}>
                                <span className={cn("material-symbols-outlined text-[18px]", s.color)}>{s.icon}</span>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium mb-0.5">{s.label}</p>
                            <p className="text-xl font-bold text-[#4a3b2c]">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex gap-1 mb-6 bg-stone-100 rounded-2xl p-1 w-fit overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                                activeTab === tab.key
                                    ? "bg-white text-[#4a3b2c] shadow-sm"
                                    : "text-stone-500 hover:text-[#4a3b2c]"
                            )}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* 탭 콘텐츠 */}
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">

                    {/* 승인 대기 */}
                    {activeTab === "pending" && (
                        <div className="p-6">
                            <h2 className="text-base font-bold text-[#4a3b2c] mb-4">{t("section.pending")}</h2>
                            {pendingBookings.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-stone-300 py-12">
                                    <span className="material-symbols-outlined text-[40px]">check_circle</span>
                                    <p className="text-sm">{t("section.noPending")}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingBookings.map((b) => {
                                        const state = actionStates[b.id] ?? "idle";
                                        const isLoading = state === "loading";
                                        return (
                                            <div key={b.id} className="flex items-center gap-4 p-4 rounded-2xl border border-amber-100 bg-amber-50/50">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-[#4a3b2c] text-sm">{b.listingTitle}</p>
                                                    <p className="text-xs text-stone-500 mt-0.5">
                                                        {b.guestName} &middot; {formatDate(b.checkIn)} — {formatDate(b.checkOut)} &middot; {fmtKrw(b.totalPrice)}
                                                    </p>
                                                    {state === "error" && <p className="text-xs text-red-500 mt-1">{t("action.error")}</p>}
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        disabled={isLoading}
                                                        onClick={() => handleApprove(b.id)}
                                                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#17cf54] text-white hover:bg-[#13b347] disabled:opacity-50 transition-colors"
                                                    >
                                                        {isLoading ? t("action.processing") : t("action.approve")}
                                                    </button>
                                                    <button
                                                        disabled={isLoading}
                                                        onClick={() => handleReject(b.id)}
                                                        className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                    >
                                                        {t("action.reject")}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 확정된 예약 */}
                    {activeTab === "confirmed" && (
                        <div className="p-6">
                            <h2 className="text-base font-bold text-[#4a3b2c] mb-4">{t("section.upcoming")}</h2>
                            {confirmedBookings.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-stone-300 py-12">
                                    <span className="material-symbols-outlined text-[40px]">event_available</span>
                                    <p className="text-sm">{t("section.noConfirmed")}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {confirmedBookings.map((b) => {
                                        const canRelease = !!b.escrowPda && new Date(b.checkOut) < new Date();
                                        const releaseState = releaseStates[b.id] ?? "idle";
                                        return (
                                        <div key={b.id} className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100 bg-stone-50/50">
                                            <div className="w-10 h-10 rounded-xl bg-[#17cf54]/10 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[18px] text-[#17cf54]">calendar_month</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-[#4a3b2c] text-sm">{b.listingTitle}</p>
                                                <p className="text-xs text-stone-500 mt-0.5">
                                                    {b.guestName} &middot; {formatDate(b.checkIn)} — {formatDate(b.checkOut)}
                                                </p>
                                                {releaseState === "error" && <p className="text-xs text-red-500 mt-1">{t("action.error")}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs font-semibold text-[#17cf54] bg-[#17cf54]/10 px-2.5 py-1 rounded-full">
                                                    {fmtKrw(b.totalPrice)}
                                                </span>
                                                {canRelease && releaseState !== "done" && (
                                                    <button
                                                        disabled={releaseState === "loading"}
                                                        onClick={() => handleRelease(b.id)}
                                                        className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {releaseState === "loading" ? t("action.processing") : "USDC 정산"}
                                                    </button>
                                                )}
                                                {releaseState === "done" && (
                                                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">정산 완료</span>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 정산 내역 */}
                    {activeTab === "settlements" && (
                        <div className="p-6">
                            <h2 className="text-base font-bold text-[#4a3b2c] mb-4">{t("section.settlementHistory")}</h2>
                            {settlements.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-stone-300 py-12">
                                    <span className="material-symbols-outlined text-[40px]">receipt_long</span>
                                    <p className="text-sm">{t("section.noSettlements")}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {settlements.map((s) => (
                                        <div key={s.id} className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-[#4a3b2c] text-sm">{s.listingTitle}</p>
                                                <p className="text-xs text-stone-500 mt-0.5">
                                                    {t("settlement.detail", {
                                                        month: s.month,
                                                        revenue: s.grossRevenueKrw.toLocaleString(),
                                                        profit: s.operatingProfitKrw.toLocaleString(),
                                                    })}
                                                </p>
                                            </div>
                                            {s.payoutTx ? (
                                                <span className="text-xs font-semibold text-[#17cf54] bg-[#17cf54]/10 border border-[#17cf54]/20 px-2.5 py-1 rounded-lg">
                                                    {t("status.auto")}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400 font-medium">{t("status.processing")}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 담당 매물 */}
                    {activeTab === "listings" && (
                        <div className="p-6">
                            <h2 className="text-base font-bold text-[#4a3b2c] mb-4">{t("section.listings")}</h2>
                            {listings.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 text-stone-300 py-12">
                                    <span className="material-symbols-outlined text-[40px]">home_work</span>
                                    <p className="text-sm">{t("section.noListings")}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {listings.map((listing) => (
                                        <div key={listing.id} className="flex items-center gap-4 p-4 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
                                            <div className="w-16 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                                                {listing.image ? (
                                                    <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-stone-300 text-[20px]">home</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-[#4a3b2c] text-sm">{listing.title}</p>
                                                <p className="text-xs text-stone-400 mt-0.5">{listing.location} &middot; {fmtKrw(listing.pricePerNight)}{t("listing.perNight")}</p>
                                            </div>
                                            <Link
                                                to={`/property/${listing.id}`}
                                                className="text-xs font-medium text-stone-400 hover:text-[#4a3b2c] px-3 py-1.5 rounded-xl hover:bg-stone-100 transition-colors"
                                            >
                                                {t("listing.view")}
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 정산 지갑 */}
                    {activeTab === "wallet" && (
                        <div className="p-6">
                            <h2 className="text-base font-bold text-[#4a3b2c] mb-1">{t("section.settlementWallet")}</h2>
                            <p className="text-sm text-stone-400 mb-6">{t("section.walletDesc")}</p>
                            <WalletConnectSection currentWalletAddress={user.walletAddress} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
