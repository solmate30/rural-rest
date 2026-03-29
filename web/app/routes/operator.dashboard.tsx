import { Link, useLoaderData } from "react-router";
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

function formatRevenue(krw: number): string {
    if (krw >= 1_000_000) return `₩${(krw / 1_000_000).toFixed(1)}M`;
    if (krw >= 1_000) return `₩${(krw / 1_000).toFixed(0)}K`;
    return `₩${krw}`;
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

const statusLabel: Record<string, string> = {
    pending: "대기 중",
    confirmed: "확정",
    cancelled: "취소",
    completed: "완료",
};

const statusColor: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-[#17cf54]/10 text-[#17cf54] border-[#17cf54]/20",
    cancelled: "bg-stone-100 text-stone-400 border-stone-200",
    completed: "bg-blue-50 text-blue-600 border-blue-200",
};

export default function OperatorDashboard() {
    const { user, stats, listings, bookings, settlements } = useLoaderData() as {
        user: { walletAddress: string | null };
        stats: DashboardStats;
        listings: HostListingRow[];
        bookings: OperatorBookingRow[];
        settlements: OperatorSettlementRow[];
    };

    const statItems = [
        { label: "이번 달 매출", value: formatRevenue(stats.totalRevenueThisMonth) },
        { label: "대기 예약", value: stats.pendingBookings },
        { label: "오늘 체크인", value: stats.todayCheckIns },
        { label: "점유율 (30일)", value: `${stats.occupancyRatePercent}%` },
    ];

    const pendingBookings = bookings.filter((b) => b.status === "pending");
    const upcomingBookings = bookings.filter((b) => b.status === "confirmed");

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto py-16 px-4 sm:px-8">

                {/* Page header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#4a3b2c]">운영 대시보드</h1>
                    <p className="text-sm text-stone-500 mt-1">담당 매물 {listings.length}채</p>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                    {statItems.map((s) => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                            <p className="text-[11px] uppercase tracking-wider text-stone-400 font-bold mb-1">{s.label}</p>
                            <p className="text-2xl font-bold text-[#4a3b2c]">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* 대기 중 예약 */}
                {pendingBookings.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-bold text-[#4a3b2c] mb-3">
                            대기 중 예약
                            <span className="ml-2 text-sm font-normal text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                                {pendingBookings.length}건
                            </span>
                        </h2>
                        <div className="space-y-2">
                            {pendingBookings.map((b) => (
                                <div key={b.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#4a3b2c] text-sm truncate">{b.listingTitle}</p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {b.guestName} &middot; {formatDate(b.checkIn)} ~ {formatDate(b.checkOut)} &middot; {formatRevenue(b.totalPrice)}
                                        </p>
                                    </div>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor.pending}`}>
                                        {statusLabel.pending}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 확정 예약 (다가오는) */}
                {upcomingBookings.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-bold text-[#4a3b2c] mb-3">다가오는 체크인</h2>
                        <div className="space-y-2">
                            {upcomingBookings.map((b) => (
                                <div key={b.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#4a3b2c] text-sm truncate">{b.listingTitle}</p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {b.guestName} &middot; {formatDate(b.checkIn)} ~ {formatDate(b.checkOut)} &middot; {formatRevenue(b.totalPrice)}
                                        </p>
                                    </div>
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor.confirmed}`}>
                                        {statusLabel.confirmed}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 정산 지갑 등록 */}
                <section className="mb-8">
                    <h2 className="text-lg font-bold text-[#4a3b2c] mb-3">정산 지갑</h2>
                    <WalletConnectSection currentWalletAddress={user.walletAddress} />
                </section>

                {/* 정산 내역 */}
                {settlements.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-bold text-[#4a3b2c] mb-3">정산 내역</h2>
                        <div className="space-y-2">
                            {settlements.map((s) => (
                                <div key={s.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-[#4a3b2c] text-sm truncate">{s.listingTitle}</p>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            {s.month} &middot; 매출 {s.grossRevenueKrw.toLocaleString()}원 &middot; 영업이익 {s.operatingProfitKrw.toLocaleString()}원
                                        </p>
                                    </div>
                                    {s.payoutTx ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#17cf54] bg-[#17cf54]/10 border border-[#17cf54]/20 px-2.5 py-1 rounded-lg">
                                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            자동 지급
                                        </span>
                                    ) : (
                                        <span className="text-xs text-stone-400 font-medium">처리 중</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 담당 매물 목록 */}
                <section>
                    <h2 className="text-lg font-bold text-[#4a3b2c] mb-3">담당 매물</h2>
                    {listings.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-16 text-center">
                            <span className="material-symbols-outlined text-[48px] text-stone-300">home_work</span>
                            <p className="text-stone-400 mt-4">배정된 매물이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {listings.map((listing) => (
                                <div
                                    key={listing.id}
                                    className="bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                                >
                                    <div className="flex items-center gap-5 p-4">
                                        <div className="h-20 w-28 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                                            {listing.image ? (
                                                <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-stone-300 text-[28px]">home</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-[#4a3b2c] text-base truncate">{listing.title}</h3>
                                            <p className="text-sm text-stone-400 mt-0.5">
                                                {listing.location} &middot; {formatRevenue(listing.pricePerNight)} / 박
                                            </p>
                                        </div>
                                        <Link
                                            to={`/property/${listing.id}`}
                                            className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 font-medium px-3 py-2 rounded-xl hover:bg-stone-100 transition-colors shrink-0"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                            보기
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
