import { Link, useLoaderData } from "react-router";
import { Header, Button, Card } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { getDashboardStats, getHostListings, type DashboardStats, type HostListingRow } from "../lib/admin-dashboard.server";
import { cn } from "../lib/utils";
import type { Route } from "./+types/admin.dashboard";

const linkButtonClass = cn(
    "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-10 px-6 py-2 rounded-[var(--radius)]",
    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
);

export async function loader({ request }: Route.LoaderArgs) {
    const user = await requireUser(request, ["host", "admin"]);
    const [stats, hostListings] = await Promise.all([
        getDashboardStats(user.id),
        getHostListings(user.id),
    ]);
    return { user, stats, hostListings };
}

function formatRevenue(krw: number): string {
    if (krw >= 1_000_000) return `₩${(krw / 1_000_000).toFixed(1)}M`;
    if (krw >= 1_000) return `₩${(krw / 1_000).toFixed(0)}K`;
    return `₩${krw}`;
}

export default function AdminDashboard() {
    const { stats, hostListings } = useLoaderData() as { stats: DashboardStats; hostListings: HostListingRow[] };

    const statCards = [
        { label: "Total Revenue (This Month)", value: formatRevenue(stats.totalRevenueThisMonth) },
        { label: "Active Listings", value: String(stats.activeListings) },
        { label: "Pending Bookings", value: String(stats.pendingBookings) },
        { label: "Occupancy Rate", value: `${stats.occupancyRatePercent}%` },
        { label: "Today's Check-ins", value: String(stats.todayCheckIns) },
    ];

    return (
        <div className="min-h-screen bg-stone-50/50">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-6xl">
                <div className="flex items-center justify-between mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">Host Dashboard</h1>
                    <Link to="/admin/edit/new" className={linkButtonClass}>+ Add New Listing</Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                    {statCards.map((stat) => (
                        <Card key={stat.label} className="p-6 bg-white border-none shadow-md">
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <h3 className="text-2xl font-bold mt-2">{stat.value}</h3>
                        </Card>
                    ))}
                </div>

                <h2 className="text-2xl font-bold mb-6">Your Properties</h2>
                <div className="grid grid-cols-1 gap-4">
                    {hostListings.length === 0 ? (
                        <Card className="p-8 bg-white border-none shadow-sm text-center text-muted-foreground">
                            <p className="mb-4">No listings yet. Add your first property to get started.</p>
                            <Link to="/admin/edit/new" className={linkButtonClass}>+ Add New Listing</Link>
                        </Card>
                    ) : (
                        hostListings.map((listing) => (
                            <Card key={listing.id} className="p-4 bg-white flex items-center justify-between border-none shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-6">
                                    <div className="h-20 w-32 rounded-xl overflow-hidden shadow-inner bg-stone-200">
                                        {listing.image ? (
                                            <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">No image</div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold">{listing.title}</h4>
                                        <p className="text-sm text-muted-foreground">{listing.location} • {formatRevenue(listing.pricePerNight)} / night</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Link to={`/admin/edit/${listing.id}`} className={linkButtonClass}>Edit Content</Link>
                                    <Link to={`/property/${listing.id}`} className={linkButtonClass}>View</Link>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
