import { Header, Button, Card, Footer } from "~/components/ui-mockup";
import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import type { Route } from "./+types/property";
import { getListingById } from "~/data/listings";
import type { TransportOption, PickupPoint } from "~/data/listings";
import { cn } from "~/lib/utils";
import { PropertyMap } from "~/components/PropertyMap";

function TransportIcon({ mode }: { mode: TransportOption["mode"] }) {
    switch (mode) {
        case "train":
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 18l-2 2m0 0l-2-2m2 2V6a2 2 0 012-2h8a2 2 0 012 2v12m-4 2l2 2m0 0l2-2M12 4v4m-4 4h8" />
                </svg>
            );
        case "bus":
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M6 3h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm0 14v2m12-2v2M4 9h16" />
                </svg>
            );
        case "taxi":
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM5 13V7a2 2 0 012-2h10a2 2 0 012 2v6M3 13h18v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm6-8V3h6v2" />
                </svg>
            );
        case "shuttle":
            return (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17h.01M16 17h.01M3 11l1-6h16l1 6M3 11h18M3 11v6a1 1 0 001 1h1m14-7v6a1 1 0 01-1 1h-1m-10 0h8" />
                </svg>
            );
    }
}

export async function loader({ params }: Route.LoaderArgs) {
    const listing = await getListingById(params.id);

    if (!listing) {
        throw new Response("Not Found", { status: 404 });
    }

    return { listing };
}

export default function PropertyDetail() {
    const { listing } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const [showGallery, setShowGallery] = useState(false);
    const nights = 3; // MVP 고정값

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />

            <main className="container mx-auto py-8 px-4 sm:px-8 max-w-6xl">
                {/* Title & Badge */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                            Heritage Stay
                        </span>
                        <span className="text-sm text-muted-foreground">{listing.locationLabel}, South Korea</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{listing.title}</h1>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        <span className="flex items-center gap-1">★ {listing.rating}</span>
                        <span className="text-muted-foreground underline cursor-pointer">{listing.reviews.length} reviews</span>
                    </div>
                </div>

                {/* Gallery Grid */}
                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-auto md:h-[450px]">
                        <div className="md:col-span-3 rounded-2xl overflow-hidden shadow-lg relative group">
                            <img
                                src={listing.images[0] || listing.image}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                alt={listing.title}
                                onClick={() => setShowGallery(true)}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        </div>
                        <div className="hidden md:grid grid-rows-2 gap-4">
                            <div className="rounded-2xl overflow-hidden shadow-md relative group">
                                <img
                                    src={listing.images[1] || listing.image}
                                    className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-105"
                                    alt={`${listing.title} 1`}
                                    onClick={() => setShowGallery(true)}
                                />
                            </div>
                            <button
                                className="rounded-2xl overflow-hidden shadow-md bg-stone-100 flex flex-col items-center justify-center gap-2 font-bold text-stone-600 hover:bg-stone-200 transition-colors group"
                                onClick={() => setShowGallery(true)}
                            >
                                <svg className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                                <span>+{listing.images.length - 2} Photos</span>
                            </button>
                        </div>
                        {/* Mobile View all button */}
                        <div className="md:hidden">
                            <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowGallery(true)}>
                                모든 사진 보기 ({listing.images.length})
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left Column: Information */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* About Section */}
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-foreground">About This Home</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg">
                                {listing.about || listing.description}
                            </p>
                        </section>

                        {/* Amenities Section */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">Amenities</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {listing.amenities.map((amenity) => (
                                    <div
                                        key={amenity}
                                        className="flex items-center gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100 shadow-sm text-sm font-semibold text-stone-700"
                                    >
                                        <span className="h-2 w-2 rounded-full bg-primary" />
                                        {amenity}
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Host Section */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">Your Host</h2>
                            <div className="flex items-start gap-6 p-8 rounded-2xl bg-stone-50 border border-stone-100 shadow-sm transition-all hover:shadow-md">
                                <img
                                    src={listing.hostImage}
                                    className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md"
                                    alt={listing.hostName}
                                />
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold text-stone-800">{listing.hostName}</h3>
                                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/20">
                                            Superhost
                                        </span>
                                    </div>
                                    <p className="text-stone-600 leading-relaxed italic">" {listing.hostBio} "</p>
                                </div>
                            </div>
                        </section>

                        {/* Location & Map Section */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">Location & Map</h2>

                            <PropertyMap
                                lat={listing.coordinates.lat}
                                lng={listing.coordinates.lng}
                                locationLabel={listing.locationLabel}
                                height={280}
                                className="shadow-md"
                            />

                            {/* Nearby Landmarks */}
                            {listing.nearbyLandmarks.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {listing.nearbyLandmarks.map((landmark) => (
                                        <span
                                            key={landmark}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-sm font-medium text-stone-600 border border-stone-200"
                                        >
                                            <svg className="w-3.5 h-3.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                            </svg>
                                            {landmark}
                                        </span>
                                    ))}
                                </div>
                            )}

                        </section>

                        {/* Getting Here (Transport) Section */}
                        {listing.transportOptions.length > 0 && (
                            <section className="space-y-6 pt-8 border-t">
                                <h2 className="text-2xl font-bold text-foreground">Getting Here</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {listing.transportOptions.map((opt) => (
                                        <div
                                            key={opt.mode}
                                            className={cn(
                                                "p-5 rounded-2xl border shadow-sm space-y-3 transition-all hover:shadow-md",
                                                opt.mode === "shuttle"
                                                    ? "bg-primary/5 border-primary/20"
                                                    : "bg-white border-stone-100"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "p-2 rounded-xl",
                                                        opt.mode === "shuttle" ? "bg-primary/10 text-primary" : "bg-stone-100 text-stone-600"
                                                    )}>
                                                        <TransportIcon mode={opt.mode} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-stone-800">{opt.label}</p>
                                                        <p className="text-xs text-stone-400 font-medium">{opt.routeName}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-stone-500 leading-relaxed">{opt.description}</p>
                                            <div className="flex items-center gap-4 pt-1">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                                                    </svg>
                                                    <span className="font-medium text-stone-700">{opt.estimatedTime}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className={cn(
                                                        "font-bold",
                                                        opt.estimatedCost === "무료" ? "text-primary" : "text-stone-700"
                                                    )}>
                                                        {opt.estimatedCost}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Shuttle Pickup Points */}
                                {listing.pickupPoints.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                            </svg>
                                            Shuttle Pickup Points
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {listing.pickupPoints.map((point) => (
                                                <div
                                                    key={point.id}
                                                    className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100"
                                                >
                                                    <div className="mt-0.5 p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                                                        <svg className="w-4 h-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-stone-800">{point.name}</p>
                                                        <p className="text-xs text-stone-500 mt-0.5">{point.description}</p>
                                                        <p className="text-xs text-primary font-semibold mt-1.5">
                                                            숙소까지 {point.estimatedTimeToProperty}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Reviews Section */}
                        <section className="space-y-6 pt-8 border-t pb-12">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                    Reviews <span className="text-lg font-medium text-stone-400">({listing.reviews.length})</span>
                                </h2>
                                <div className="flex items-center gap-1 font-bold text-lg">★ {listing.rating}</div>
                            </div>

                            {listing.reviews.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {listing.reviews.map((review) => (
                                        <div key={review.id} className="p-6 rounded-2xl bg-white border border-stone-100 shadow-sm space-y-4 transition-all hover:shadow-md">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={review.authorImage}
                                                        className="h-12 w-12 rounded-full object-cover border border-stone-100"
                                                        alt={review.authorName}
                                                    />
                                                    <div>
                                                        <div className="font-bold text-stone-800">{review.authorName}</div>
                                                        <div className="text-xs text-stone-400 font-medium">{review.date}</div>
                                                    </div>
                                                </div>
                                                <div className="flex text-primary text-xs">
                                                    {"★".repeat(review.rating)}
                                                </div>
                                            </div>
                                            <p className="text-stone-600 text-sm leading-relaxed">{review.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                                    <p className="text-stone-400 font-medium">아직 리뷰가 없습니다. 첫 번째 게스트가 되어보세요.</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column: Booking Card */}
                    <div className="lg:col-span-1">
                        <Card className="p-8 sticky top-24 shadow-2xl border-none bg-white rounded-3xl">
                            <div className="flex items-baseline justify-between mb-8">
                                <div className="flex flex-col">
                                    <span className="text-3xl font-bold text-stone-900">
                                        ₩{listing.pricePerNight.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">Per Night</span>
                                </div>
                                <div className="text-sm font-bold text-primary">★ {listing.rating}</div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="grid grid-cols-2 gap-0 border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
                                    <div className="p-4 border-r border-b bg-stone-50/50">
                                        <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Check-in</label>
                                        <div className="text-sm font-bold text-stone-700">Select date</div>
                                    </div>
                                    <div className="p-4 border-b bg-stone-50/50">
                                        <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Check-out</label>
                                        <div className="text-sm font-bold text-stone-700">Select date</div>
                                    </div>
                                    <div className="p-4 col-span-2 bg-stone-50/50 hover:bg-stone-100 transition-colors cursor-pointer">
                                        <label className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Guests</label>
                                        <div className="text-sm font-bold text-stone-700">Max {listing.maxGuests} guests</div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    onClick={() => navigate(`/book/${listing.id}`)}
                                >
                                    Reserve Now
                                </Button>
                                <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                    No charge until host approval
                                </p>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-stone-100 font-medium text-sm">
                                <div className="flex justify-between text-stone-600">
                                    <span>₩{listing.pricePerNight.toLocaleString()} x {nights} nights</span>
                                    <span className="font-bold">₩{(listing.pricePerNight * nights).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-stone-600">
                                    <div className="flex items-center gap-1">
                                        <span>Transport Concierge</span>
                                        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <span className="text-primary font-bold">Free</span>
                                </div>
                                <div className="flex justify-between border-t border-stone-200 pt-5 text-xl font-bold text-stone-900">
                                    <span>Total</span>
                                    <span>₩{(listing.pricePerNight * nights).toLocaleString()}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
                    <div className="sticky top-0 z-[110] flex justify-between items-center p-6 bg-black/40 backdrop-blur-md border-b border-white/10">
                        <div className="flex flex-col">
                            <h2 className="text-white text-xl font-bold">{listing.title}</h2>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Gallery Loop — {listing.images.length} Photos</p>
                        </div>
                        <Button
                            variant="ghost"
                            className="text-white hover:bg-white/10 h-12 w-12 rounded-full p-0"
                            onClick={() => setShowGallery(false)}
                        >
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    </div>
                    <div className="max-w-6xl mx-auto px-6 py-12 md:columns-2 lg:columns-3 gap-6 space-y-6">
                        {listing.images.map((img, i) => (
                            <div key={i} className="group relative rounded-2xl overflow-hidden shadow-2xl break-inside-avoid animate-in zoom-in-95 duration-500 delay-75">
                                <img
                                    src={img}
                                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                                    alt={`${listing.title} gallery ${i + 1}`}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
