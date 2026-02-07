import { Header, Button, Card } from "../components/ui-mockup";

export default function PropertyDetail() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto py-12 px-4 sm:px-8 max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">Heritage Stay</span>
                                <span className="text-sm text-muted-foreground">Namhae-gun, South Korea</span>
                            </div>
                            <h1 className="text-4xl font-bold tracking-tight">Grandma's Stone House</h1>
                            <div className="grid grid-cols-4 gap-4 h-[400px]">
                                <div className="col-span-3 rounded-2xl overflow-hidden shadow-lg">
                                    <img src="/hero.png" className="w-full h-full object-cover" />
                                </div>
                                <div className="grid grid-rows-2 gap-4">
                                    <div className="rounded-2xl overflow-hidden shadow-md">
                                        <img src="/house.png" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="rounded-2xl overflow-hidden shadow-md bg-stone-100 flex items-center justify-center font-bold text-muted-foreground">
                                        +12 View all
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="prose max-w-none text-muted-foreground">
                            <h2 className="text-foreground text-2xl font-bold mb-4">About this home</h2>
                            <p>Nestled in a quiet valley, this traditional stone house has been preserved for three generations. Recently renovated to include modern amenities while keeping its rustic charm.</p>
                            <h3 className="text-foreground font-bold mt-6 mb-2">The Experience</h3>
                            <ul>
                                <li>Morning coffee with village elders</li>
                                <li>Traditional orange picking (seasonal)</li>
                                <li>Night market shuttle service available</li>
                            </ul>
                        </div>
                    </div>

                    {/* Booking Summary Card */}
                    <div className="lg:col-span-1">
                        <Card className="p-8 sticky top-24 shadow-xl border-none">
                            <div className="flex items-baseline justify-between mb-6">
                                <span className="text-2xl font-bold">₩120,000</span>
                                <span className="text-muted-foreground">/ night</span>
                            </div>
                            <div className="space-y-4 mb-8">
                                <div className="grid grid-cols-2 gap-0 border rounded-xl overflow-hidden">
                                    <div className="p-3 border-r border-b">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Check-in</label>
                                        <div className="text-sm">2026-05-12</div>
                                    </div>
                                    <div className="p-3 border-b">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Check-out</label>
                                        <div className="text-sm">2026-05-15</div>
                                    </div>
                                    <div className="p-3 col-span-2">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Guests</label>
                                        <div className="text-sm">2 guests</div>
                                    </div>
                                </div>
                                <Button className="w-full h-12 text-lg" onClick={() => window.location.href = '/book/1'}>Reserve Now</Button>
                                <p className="text-center text-xs text-muted-foreground">No charge until host approval</p>
                            </div>
                            <div className="space-y-3 pt-6 border-t font-medium text-sm">
                                <div className="flex justify-between">
                                    <span>₩120,000 x 3 nights</span>
                                    <span>₩360,000</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Transport Concierge</span>
                                    <span className="text-primary">Included</span>
                                </div>
                                <div className="flex justify-between border-t pt-3 text-lg font-bold">
                                    <span>Total</span>
                                    <span>₩360,000</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
