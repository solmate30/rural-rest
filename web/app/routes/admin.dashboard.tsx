import { Link, useLoaderData } from "react-router";
import { Header } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import { getHostListings } from "../lib/admin-dashboard.server";
import { db } from "../db/index.server";
import { listings, rwaTokens, rwaInvestments, user as userTable } from "../db/schema";
import { sql, eq } from "drizzle-orm";
import type { Route } from "./+types/admin.dashboard";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const allListings = await getHostListings("", "admin");

    const [investorCountRow] = await db
        .select({ count: sql<number>`count(distinct ${rwaInvestments.userId})` })
        .from(rwaInvestments);

    const [totalInvestedRow] = await db
        .select({ sum: sql<number>`coalesce(sum(${rwaInvestments.investedUsdc}), 0)` })
        .from(rwaInvestments);

    const [userCountRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userTable);

    const tokenizedCount = allListings.filter((l) => l.tokenMint).length;
    const fundingCount = allListings.filter((l) => l.tokenStatus === "funding").length;
    const activeCount = allListings.filter((l) => l.tokenStatus === "active").length;

    return {
        allListings,
        stats: {
            totalListings: allListings.length,
            tokenizedCount,
            fundingCount,
            activeCount,
            totalUsers: Number(userCountRow?.count ?? 0),
            totalInvestors: Number(investorCountRow?.count ?? 0),
            totalInvestedUsdc: Number(totalInvestedRow?.sum ?? 0) / 1_000_000,
        },
    };
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

export default function AdminDashboard() {
    const { allListings, stats } = useLoaderData<typeof loader>();

    const statItems = [
        { label: "Total Listings", value: stats.totalListings },
        { label: "Tokenized", value: stats.tokenizedCount },
        { label: "Total Users", value: stats.totalUsers },
        { label: "Total Investors", value: stats.totalInvestors },
        { label: "Total Invested", value: `$${stats.totalInvestedUsdc.toFixed(2)}` },
        { label: "Funding Now", value: stats.fundingCount },
    ];

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />
            <main className="container mx-auto pt-24 pb-16 px-4 max-w-6xl">

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#4a3b2c]">Platform Overview</h1>
                    <p className="text-sm text-stone-500 mt-1">Rural Rest — Admin</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
                    {statItems.map((s) => (
                        <div key={s.label} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
                            <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">{s.label}</p>
                            <p className="text-2xl font-bold text-[#4a3b2c]">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* All Listings Table */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                        <h2 className="font-bold text-[#4a3b2c]">All Listings</h2>
                        <span className="text-sm text-stone-400">{allListings.length} total</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                    <th className="py-3 px-6">Property</th>
                                    <th className="py-3 px-6">Location</th>
                                    <th className="py-3 px-6">Price/Night</th>
                                    <th className="py-3 px-6">RWA Status</th>
                                    <th className="py-3 px-6" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                                {allListings.map((listing) => (
                                    <tr key={listing.id} className="hover:bg-stone-50/50 transition-colors">
                                        <td className="py-3.5 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-14 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                                                    {listing.image ? (
                                                        <img src={listing.image} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-stone-300 text-[16px]">home</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-semibold text-sm text-stone-800">{listing.title}</span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-6 text-sm text-stone-500">{listing.location}</td>
                                        <td className="py-3.5 px-6 text-sm text-stone-700">
                                            ₩{listing.pricePerNight.toLocaleString()}
                                        </td>
                                        <td className="py-3.5 px-6">
                                            {listing.tokenMint ? (
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor[listing.tokenStatus ?? ""] ?? "bg-stone-100 text-stone-500 border-stone-200"}`}>
                                                    {statusLabel[listing.tokenStatus ?? ""] ?? listing.tokenStatus}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-300 font-medium">Not tokenized</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-6 text-right">
                                            <Link
                                                to={`/invest/${listing.id}`}
                                                className="text-xs text-stone-500 hover:text-stone-800 font-medium px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
                                            >
                                                View →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
