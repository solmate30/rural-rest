import { Link, useLoaderData } from "react-router";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { getDashboardStats, getHostListings, type DashboardStats, type HostListingRow } from "../lib/admin-dashboard.server";
import type { Route } from "./+types/host.dashboard";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request, ["host", "admin"]);
    const [stats, hostListings] = await Promise.all([
        getDashboardStats(user.id),
        getHostListings(user.id, "host"),
    ]);
    return { user, stats, hostListings };
}

function formatRevenue(krw: number): string {
    if (krw >= 1_000_000) return `₩${(krw / 1_000_000).toFixed(1)}M`;
    if (krw >= 1_000) return `₩${(krw / 1_000).toFixed(0)}K`;
    return `₩${krw}`;
}

const statusLabel: Record<string, string> = {
    funding: "Funding",
    funded: "Funded",
    active: "Active",
    failed: "Failed",
};

const statusColor: Record<string, string> = {
    funding: "bg-[#17cf54]/10 text-[#17cf54] border-[#17cf54]/20",
    funded: "bg-blue-50 text-blue-600 border-blue-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-500 border-red-200",
};

export default function HostDashboard() {
    const { stats, hostListings } = useLoaderData() as { stats: DashboardStats; hostListings: HostListingRow[] };

    const statItems = [
        { label: "Revenue (This Month)", value: formatRevenue(stats.totalRevenueThisMonth) },
        { label: "Pending Bookings", value: stats.pendingBookings },
        { label: "Today's Check-ins", value: stats.todayCheckIns },
        { label: "Occupancy (30d)", value: `${stats.occupancyRatePercent}%` },
    ];

    const minted = hostListings.filter((l) => l.tokenMint).length;
    const notMinted = hostListings.filter((l) => !l.tokenMint).length;

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-24 pb-16 px-4 max-w-5xl">

                {/* Page header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-[#4a3b2c]">My Properties</h1>
                        <p className="text-sm text-stone-500 mt-1">
                            {hostListings.length} total &middot; {minted} tokenized &middot; {notMinted} pending
                        </p>
                    </div>
                    <Link
                        to="/host/edit/new"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-all shadow-lg shadow-[#17cf54]/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Listing
                    </Link>
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

                {/* Listing rows */}
                {hostListings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-16 text-center">
                        <span className="material-symbols-outlined text-[48px] text-stone-300">home_work</span>
                        <p className="text-stone-400 mt-4 mb-6">No listings yet.</p>
                        <Link
                            to="/host/edit/new"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17cf54] text-white text-sm font-bold hover:bg-[#14b847] transition-all"
                        >
                            Add your first property
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {hostListings.map((listing) => (
                            <div
                                key={listing.id}
                                className="bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            >
                                <div className="flex items-center gap-5 p-4">
                                    {/* Thumbnail */}
                                    <div className="h-20 w-28 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                                        {listing.image ? (
                                            <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <span className="material-symbols-outlined text-stone-300 text-[28px]">home</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[#4a3b2c] text-base truncate">{listing.title}</h3>
                                        <p className="text-sm text-stone-400 mt-0.5">
                                            {listing.location} &middot; {formatRevenue(listing.pricePerNight)} / night
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        {listing.tokenMint ? (
                                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor[listing.tokenStatus ?? ""] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}>
                                                {statusLabel[listing.tokenStatus ?? ""] ?? listing.tokenStatus}
                                            </span>
                                        ) : (
                                            <Link
                                                to={`/host/tokenize/${listing.id}`}
                                                className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl bg-[#17cf54] text-white hover:bg-[#14b847] transition-all shadow-lg shadow-[#17cf54]/30 hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">token</span>
                                                Tokenize
                                            </Link>
                                        )}
                                        <Link
                                            to={`/property/${listing.id}`}
                                            className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 font-medium px-3 py-2 rounded-xl hover:bg-stone-100 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                            View
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
