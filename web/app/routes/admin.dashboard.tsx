import { Header, Button, Card } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
import type { Route } from "./+types/admin.dashboard";

export async function loader({ request }: Route.LoaderArgs) {
    // Only hosts and admins can access the dashboard
    return await requireUser(request, ["host", "admin"]);
}

export default function AdminDashboard() {
    return (
        <div className="min-h-screen bg-stone-50/50">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-6xl">
                <div className="flex items-center justify-between mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">Host Dashboard</h1>
                    <Button onClick={() => window.location.href = '/admin/edit/new'}>+ Add New Listing</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: "Total Revenue", value: "₩2,450,000", delta: "+12%" },
                        { label: "Active Listings", value: "3", delta: "0" },
                        { label: "Pending Bookings", value: "12", delta: "+2" },
                        { label: "Occupancy Rate", value: "64%", delta: "+5%" }
                    ].map((stat, i) => (
                        <Card key={stat.label} className="p-6 bg-white border-none shadow-md">
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <h3 className="text-2xl font-bold mt-2">{stat.value}</h3>
                            <p className="text-xs text-primary font-bold mt-1">{stat.delta}</p>
                        </Card>
                    ))}
                </div>

                <h2 className="text-2xl font-bold mb-6">Your Properties</h2>
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2].map((i) => (
                        <Card key={i} className="p-4 bg-white flex items-center justify-between border-none shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-6">
                                <div className="h-20 w-32 rounded-xl overflow-hidden shadow-inner">
                                    <img src={`https://images.unsplash.com/photo-1542332213-9b5a5a3fab35?q=80&w=2670&auto=format&fit=crop&sig=${i}`} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold">Grandma's Stone House</h4>
                                    <p className="text-sm text-muted-foreground">Namhae-gun • ₩120,000 / night</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => window.location.href = '/admin/edit/1'}>Edit Content</Button>
                                <Button variant="outline">View Stats</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </main>
        </div>
    );
}
