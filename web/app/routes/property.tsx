import { Header, Button, Card, Footer } from "~/components/ui-mockup";
import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { usePythRate } from "~/hooks/usePythRate";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/property";
import { cn } from "~/lib/utils";
import { PropertyMap } from "~/components/PropertyMap";
import { db } from "~/db/index.server";
import { listings, user, rwaTokens, bookings } from "~/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { detectLocale } from "~/lib/i18n.server";
import { applyListingLocale, translateAmenities } from "~/data/listing-translations";
import { InvestmentUpsellCard } from "~/components/InvestmentUpsellCard";
import { fetchPropertyOnchain } from "~/lib/rwa.onchain.server";
import { toLocalDateStr } from "~/lib/date-utils";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { ko as koLocale, enUS } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

function toCityLabel(location: string): string {
    const m = location.match(/([가-힣]+)시/);
    return m ? `${m[1]} 근처` : location;
}

type TransportMode = "train" | "bus" | "taxi" | "shuttle";

function TransportIcon({ mode }: { mode: TransportMode }) {
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


export async function loader({ params, request }: Route.LoaderArgs) {
    const locale = await detectLocale(request);
    const row = await db
        .select({
            id: listings.id,
            title: listings.title,
            description: listings.description,
            location: listings.location,
            region: listings.region,
            pricePerNight: listings.pricePerNight,
            maxGuests: listings.maxGuests,
            amenities: listings.amenities,
            images: listings.images,
            lat: listings.lat,
            lng: listings.lng,
            hostId: listings.hostId,
            tokenStatus: rwaTokens.status,
            totalSupply: rwaTokens.totalSupply,
            tokensSold: rwaTokens.tokensSold,
            fundingDeadline: rwaTokens.fundingDeadline,
            minFundingBps: rwaTokens.minFundingBps,
        })
        .from(listings)
        .leftJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(eq(listings.id, params.id!))
        .then((rows) => rows[0] ?? null);

    if (!row) throw new Response("Not Found", { status: 404 });

    // 온체인 상태가 진실 — DB는 fallback
    if (row.tokenStatus) {
        const onchain = await fetchPropertyOnchain(params.id!);
        if (onchain) {
            row.tokenStatus = onchain.status as typeof row.tokenStatus;
            row.tokensSold = onchain.tokensSold;
        }
        // invest.tsx와 동일한 데드라인 보정: 기간 경과 + 목표 미달 → failed
        if (row.tokenStatus === "funding" && row.fundingDeadline) {
            const deadlineMs = new Date(row.fundingDeadline).getTime();
            if (Date.now() > deadlineMs) {
                const totalSupply = row.totalSupply ?? 0;
                const tokensSold = row.tokensSold ?? 0;
                const progressBps = totalSupply > 0 ? (tokensSold / totalSupply) * 10000 : 0;
                if (progressBps < (row.minFundingBps ?? 6000)) {
                    row.tokenStatus = "failed" as typeof row.tokenStatus;
                }
            }
        }
    }

    // RWA 토큰이 있으면 active 상태일 때만 예약 가능
    const bookingAllowed = !row.tokenStatus || row.tokenStatus === "active";

    const hostUser = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, row.hostId))
        .then((rows) => rows[0]);

    const images = row.images as string[];

    const listingBase = applyListingLocale({
        id: row.id,
        title: row.title,
        description: row.description,
        cityLabel: toCityLabel(row.location),
    }, locale);

    const hostBio = locale === "en"
        ? "We breathe new life into abandoned rural homes and share the culture and nature of our village with travelers from around the world."
        : "우리 마을의 빈집을 되살려 여행자에게 특별한 경험을 제공하고 있습니다. 마을 주민들과 함께 숙소를 운영하며, 지역 문화와 자연을 나누는 일을 하고 있습니다.";

    const listing = {
        id: listingBase.id,
        title: listingBase.title,
        description: listingBase.description,
        about: listingBase.description,
        location: row.location,
        locationLabel: listingBase.cityLabel,
        pricePerNight: row.pricePerNight,
        maxGuests: row.maxGuests,
        amenities: translateAmenities(row.amenities as string[], locale),
        images,
        image: images[0] ?? "/house.png",
        rating: null as number | null,
        reviews: [] as { id: string; authorName: string; authorImage: string; rating: number; comment: string; date: string }[],
        hostName: locale === "en"
            ? `${row.location.split(" ").at(-1)} Village Host`
            : `${row.location.split(" ").at(-1)} 마을지기`,
        hostImage: `https://api.dicebear.com/7.x/notionists/svg?seed=${row.hostId}&backgroundColor=e2e8f0`,
        hostBio,
        coordinates: { lat: row.lat ?? 35.8394, lng: row.lng ?? 129.2917 },
        nearbyLandmarks: [] as string[],
        transportOptions: [] as { mode: TransportMode; label: string; routeName: string; estimatedTime: string; estimatedCost: string; description: string }[],
        pickupPoints: [] as { id: string; name: string; description: string; estimatedTimeToProperty: string }[],
    };

    const bookedRanges = await db
        .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(
            and(
                eq(bookings.listingId, params.id!),
                eq(bookings.status, "confirmed"),
            )
        );

    return { listing, bookingAllowed, bookedRanges };
}

export default function PropertyDetail() {
    const { listing, bookingAllowed, bookedRanges } = useLoaderData<typeof loader>();
    const navigate = useNavigate();
    const { t } = useTranslation("property");
    const [showGallery, setShowGallery] = useState(false);
    const [calCheckInOpen, setCalCheckInOpen] = useState(false);
    const [calCheckOutOpen, setCalCheckOutOpen] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [guests, setGuests] = useState(1);
    const { rate: pythRate, loading: rateLoading } = usePythRate();
    const { i18n } = useTranslation();
    const calLocale = i18n.language === "ko" ? koLocale : enUS;

    const checkIn = dateRange?.from ? toLocalDateStr(dateRange.from) : "";
    const checkOut = dateRange?.to ? toLocalDateStr(dateRange.to) : "";
    const nights = dateRange?.from && dateRange?.to
        ? Math.max(0, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000))
        : 0;
    const totalKrw = listing.pricePerNight * Math.max(1, nights);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    function formatDate(d: Date) {
        return d.toLocaleDateString(i18n.language === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
    }

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />

            <main className="container mx-auto py-8 px-4 sm:px-8 max-w-6xl">
                {/* Title & Badge */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                            {t("badge.heritage")}
                        </span>
                        <span className="text-sm text-muted-foreground">{listing.locationLabel}, South Korea</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">{listing.title}</h1>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        {listing.rating != null && <span className="flex items-center gap-1">★ {listing.rating}</span>}
                        <span className="text-muted-foreground">
                            {listing.reviews.length > 0
                                ? t("rating.reviews", { count: listing.reviews.length })
                                : t("rating.noReview")}
                        </span>
                    </div>
                </div>

                {/* Gallery Grid */}
                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:h-[450px]">
                        <div className="md:col-span-3 rounded-2xl overflow-hidden shadow-lg relative group h-[280px] md:h-full">
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
                                {listing.images.length > 2
                                    ? <span>{t("gallery.morePhotos", { count: listing.images.length - 2 })}</span>
                                    : <span>{t("gallery.allPhotos")}</span>
                                }
                            </button>
                        </div>
                        {/* Mobile View all button */}
                        <div className="md:hidden">
                            <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowGallery(true)}>
                                {t("gallery.viewAll", { count: listing.images.length })}
                            </Button>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left Column: Information */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* About Section */}
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-foreground">{t("section.about")}</h2>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-lg">
                                {listing.about || listing.description}
                            </p>
                        </section>

                        {/* Amenities Section */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("section.amenities")}</h2>
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
                            <h2 className="text-2xl font-bold text-foreground">{t("section.operator")}</h2>
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
                                            {t("operator.superhost")}
                                        </span>
                                    </div>
                                    {listing.hostBio && <p className="text-stone-600 leading-relaxed italic">" {listing.hostBio} "</p>}
                                </div>
                            </div>
                        </section>

                        {/* Location & Map Section */}
                        <section className="space-y-6 pt-8 border-t">
                            <h2 className="text-2xl font-bold text-foreground">{t("section.location")}</h2>

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
                                <h2 className="text-2xl font-bold text-foreground">{t("section.transport")}</h2>

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
                                                        {opt.estimatedCost === "무료" ? t("transport.free") : opt.estimatedCost}
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
                                            {t("transport.pickupPoints")}
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
                                                            {t("transport.travelTime", { time: point.estimatedTimeToProperty })}
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
                                    {t("section.reviews")} <span className="text-lg font-medium text-stone-400">({listing.reviews.length})</span>
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
                                    <p className="text-stone-400 font-medium">{t("reviews.empty")}</p>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column: Booking Card */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            <Card className="p-8 shadow-2xl border-none bg-white rounded-3xl">
                                {/* 가격 */}
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex flex-col">
                                        <span className="text-3xl font-bold text-stone-900">
                                            ₩{listing.pricePerNight.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">{t("booking.perNight")}</span>
                                        {!rateLoading && (
                                            <span className="text-sm text-primary font-semibold mt-0.5">
                                                ≈ {(listing.pricePerNight / pythRate).toFixed(2)} USDC
                                            </span>
                                        )}
                                    </div>
                                    {listing.rating != null && (
                                        <div className="text-sm font-bold text-primary">★ {listing.rating}</div>
                                    )}
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="border border-stone-200 rounded-2xl overflow-hidden">
                                        <div className="grid grid-cols-2 divide-x divide-stone-200">
                                            {/* 체크인 */}
                                            <Popover open={calCheckInOpen} onOpenChange={setCalCheckInOpen}>
                                                <PopoverTrigger asChild>
                                                    <button type="button" className={cn("p-4 text-left hover:bg-primary/5 transition-colors w-full", calCheckInOpen && "bg-primary/5")}>
                                                        <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">{t("booking.checkin")}</p>
                                                        <p className={cn("text-sm font-semibold", dateRange?.from ? "text-stone-800" : "text-stone-400")}>
                                                            {dateRange?.from ? formatDate(dateRange.from) : t("booking.selectDates")}
                                                        </p>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={dateRange?.from}
                                                        onSelect={(day) => {
                                                            if (!day) return;
                                                            const newTo = dateRange?.to && dateRange.to > day ? dateRange.to : undefined;
                                                            setDateRange({ from: day, to: newTo });
                                                            setCalCheckInOpen(false);
                                                            if (!newTo) setCalCheckOutOpen(true);
                                                        }}
                                                        disabled={[
                                                            { before: today },
                                                            ...bookedRanges.map((r) => ({ from: r.checkIn, to: r.checkOut })),
                                                        ]}
                                                        locale={calLocale}
                                                        className="rounded-2xl"
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            {/* 체크아웃 */}
                                            <Popover open={calCheckOutOpen} onOpenChange={setCalCheckOutOpen}>
                                                <PopoverTrigger asChild>
                                                    <button type="button" className={cn("p-4 text-left hover:bg-primary/5 transition-colors w-full", calCheckOutOpen && "bg-primary/5")}>
                                                        <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">{t("booking.checkout")}</p>
                                                        <p className={cn("text-sm font-semibold", dateRange?.to ? "text-stone-800" : "text-stone-400")}>
                                                            {dateRange?.to ? formatDate(dateRange.to) : t("booking.selectDates")}
                                                        </p>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0 shadow-2xl" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={dateRange?.to}
                                                        onSelect={(day) => {
                                                            if (!day) return;
                                                            setDateRange((prev) => ({ from: prev?.from, to: day }));
                                                            setCalCheckOutOpen(false);
                                                        }}
                                                        disabled={[
                                                            { before: dateRange?.from ? new Date(dateRange.from.getTime() + 86400000) : today },
                                                            ...bookedRanges.map((r) => ({ from: r.checkIn, to: r.checkOut })),
                                                        ]}
                                                        locale={calLocale}
                                                        className="rounded-2xl"
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    <div className="border border-stone-200 rounded-2xl p-4">
                                        <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1.5">{t("booking.guests")}</p>
                                        <select
                                            value={guests}
                                            onChange={e => setGuests(Number(e.target.value))}
                                            className="w-full text-sm font-semibold text-stone-700 bg-transparent outline-none cursor-pointer"
                                        >
                                            {Array.from({ length: listing.maxGuests }, (_, i) => (
                                                <option key={i + 1} value={i + 1}>{t("booking.guestOption", { count: i + 1 })}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {bookingAllowed ? (
                                        <>
                                            <Button
                                                className="w-full h-14 text-xl font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                onClick={() => {
                                                    const p = new URLSearchParams();
                                                    if (checkIn) p.set("checkIn", checkIn);
                                                    if (checkOut) p.set("checkOut", checkOut);
                                                    p.set("guests", String(guests));
                                                    navigate(`/book/${listing.id}?${p.toString()}`);
                                                }}
                                            >
                                                {t("booking.reserve")}
                                            </Button>
                                            <p className="text-center text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                                {t("booking.noCharge")}
                                            </p>
                                        </>
                                    ) : (
                                        <div className="w-full h-14 rounded-2xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center gap-0.5">
                                            <span className="text-sm font-bold text-stone-400">{t("booking.fundingPending")}</span>
                                            <span className="text-[10px] text-stone-300">{t("booking.fundingPendingNote")}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 pt-5 border-t border-stone-100 font-medium text-sm">
                                    <div className="flex justify-between text-stone-600">
                                        <span>₩{listing.pricePerNight.toLocaleString()} × {t("booking.nightCount", { count: nights > 0 ? nights : 1 })}</span>
                                        <span className="font-bold">₩{totalKrw.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-stone-600">
                                        <div className="flex items-center gap-1">
                                            <span>{t("booking.concierge")}</span>
                                            <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-primary font-bold">{t("booking.conciergePrice")}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-stone-200 pt-4 text-base font-bold text-stone-900">
                                        <span>{t("booking.total")}</span>
                                        <div className="text-right">
                                            <p>₩{totalKrw.toLocaleString()}</p>
                                            {!rateLoading && (
                                                <p className="text-sm font-medium text-primary">≈ {(totalKrw / pythRate).toFixed(2)} USDC</p>
                                            )}
                                        </div>
                                    </div>
                                    {!checkIn && (
                                        <p className="text-xs text-stone-400 text-center">{t("booking.selectDates")}</p>
                                    )}
                                </div>

                            </Card>
                            <InvestmentUpsellCard listingId={listing.id} />
                        </div>
                    </div>
                </div>
            </main>

            {/* Gallery Modal */}
            {showGallery && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md overflow-y-auto animate-in fade-in duration-300">
                    <div className="sticky top-0 z-[110] flex justify-between items-center p-6 bg-black/40 backdrop-blur-md border-b border-white/10">
                        <div className="flex flex-col">
                            <h2 className="text-white text-xl font-bold">{listing.title}</h2>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest">{t("gallery.loop", { count: listing.images.length })}</p>
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
