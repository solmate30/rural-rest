import { Header, Button, Card } from "../components/ui-mockup";

export default function Book() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-4xl">
                <h1 className="text-3xl font-bold mb-8">Confirm your booking</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <section>
                            <h2 className="text-xl font-bold mb-4">Your trip</h2>
                            <Card className="p-6 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">Dates</p>
                                        <p className="text-sm text-muted-foreground">May 12 – 15, 2026</p>
                                    </div>
                                    <Button variant="ghost">Edit</Button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">Guests</p>
                                        <p className="text-sm text-muted-foreground">2 guests</p>
                                    </div>
                                    <Button variant="ghost">Edit</Button>
                                </div>
                            </Card>
                        </section>
                        <Button className="w-full h-12 text-lg">Confirm and Pay</Button>
                    </div>
                    <div>
                        <Card className="p-6 sticky top-24">
                            <div className="flex gap-4 mb-6">
                                <div className="h-20 w-20 rounded-xl overflow-hidden shadow-sm">
                                    <img src="/hero.png" className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Traditional House</p>
                                    <p className="font-bold">Grandma's Stone House</p>
                                    <p className="text-xs">★ 4.9 (12 reviews)</p>
                                </div>
                            </div>
                            <div className="border-t pt-6 space-y-3 text-sm">
                                <div className="flex justify-between font-bold text-lg pt-3 border-t">
                                    <span>Total (KRW)</span>
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
