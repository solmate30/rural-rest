import { Header, Button, Card, Badge, Slider, Footer } from "~/components/ui-mockup";
import { useState, useMemo } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/search";
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { and, lte, like } from "drizzle-orm";
import { detectLocale } from "~/lib/i18n.server";
import { applyListingLocale } from "~/data/listing-translations";

const ITEMS_PER_PAGE = 12;

// 검색 필터용 지역 목록 (value는 region 코드 = DB region 컬럼과 일치)
const LOCATION_DEFS = [
    { value: "경상", keyword: "경상" },
    { value: "경기", keyword: "경기" },
    { value: "강원", keyword: "강원" },
    { value: "충청", keyword: "충청" },
    { value: "전라", keyword: "전라" },
    { value: "제주", keyword: "제주" },
];

function toCityLabel(location: string, locale: string): string {
    const m = location.match(/([가-힣]+)시/);
    if (!m) return location;
    const city = m[1];
    if (locale === "en") {
        const map: Record<string, string> = {
            "경주": "Gyeongju", "서울": "Seoul", "부산": "Busan",
            "강릉": "Gangneung", "전주": "Jeonju", "제주": "Jeju",
            "인천": "Incheon", "수원": "Suwon",
        };
        return `Near ${map[city] ?? city}`;
    }
    return `${city} 근처`;
}

export async function loader({ request }: Route.LoaderArgs) {
    const locale = await detectLocale(request);
    const url = new URL(request.url);
    const location = url.searchParams.get("location");
    const maxPrice = Number(url.searchParams.get("maxPrice")) || 500000;

    const keyword = location
        ? (LOCATION_DEFS.find((l) => l.value === location)?.keyword ?? location)
        : null;

    const conditions = [lte(listings.pricePerNight, maxPrice)];
    if (keyword) {
        conditions.push(like(listings.location, `%${keyword}%`));
    }

    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            description: listings.description,
            location: listings.location,
            pricePerNight: listings.pricePerNight,
            maxGuests: listings.maxGuests,
            images: listings.images,
        })
        .from(listings)
        .where(and(...conditions));

    const result = rows.map((row) => applyListingLocale({
        id: row.id,
        title: row.title,
        description: row.description,
        cityLabel: toCityLabel(row.location, locale),
        locationLabel: toCityLabel(row.location, locale),
        pricePerNight: row.pricePerNight,
        maxGuests: row.maxGuests,
        image: (row.images as string[])[0] ?? "/house.png",
        rating: null as number | null,
    }, locale));

    return {
        listings: result,
        totalCount: result.length,
        filters: { location, maxPrice },
    };
}

export default function SearchResults() {
    const { listings, totalCount, filters } = useLoaderData<typeof loader>();
    const { t, i18n } = useTranslation("home");
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // 지역 목록: t()로 번역된 이름
    const locations = [
        { name: t("regions.경상도"), value: "경상" },
        { name: t("regions.경기도"), value: "경기" },
        { name: t("regions.강원도"), value: "강원" },
        { name: t("regions.충청도"), value: "충청" },
        { name: t("regions.전라도"), value: "전라" },
        { name: t("regions.제주도"), value: "제주" },
    ];

    const [selectedLocation, setSelectedLocation] = useState<string | null>(
        filters.location
    );
    const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const visibleListings = useMemo(
        () => listings.slice(0, visibleCount),
        [listings, visibleCount]
    );
    const hasMore = visibleCount < listings.length;

    function applyFilters(location: string | null, price: number) {
        const params = new URLSearchParams();
        if (location) params.set("location", location);
        params.set("maxPrice", String(price));
        setSearchParams(params);
        setVisibleCount(ITEMS_PER_PAGE);
    }

    function handleLocationChange(value: string) {
        const newLocation = selectedLocation === value ? null : value;
        setSelectedLocation(newLocation);
        applyFilters(newLocation, maxPrice);
    }

    function handlePriceChange(value: number) {
        setMaxPrice(value);
        applyFilters(selectedLocation, value);
    }

    const selectedLocationName = selectedLocation
        ? locations.find((l) => l.value === selectedLocation)?.name
        : null;

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />
            <main className="container mx-auto px-4 sm:px-8 py-8">
                {/* Filter Bar */}
                <section className="mb-8 p-6 bg-white/95 backdrop-blur rounded-3xl shadow-lg border border-stone-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Location Badges */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                                {t("search.whereTo")}
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {locations.map((loc) => (
                                    <Badge
                                        key={loc.value}
                                        variant={selectedLocation === loc.value ? "default" : "outline"}
                                        className="py-1.5 px-4 text-[13px] border-stone-200 transition-all active:scale-95 cursor-pointer"
                                        onClick={() => handleLocationChange(loc.value)}
                                    >
                                        {loc.name}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Price Slider */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">
                                    {t("search.priceCap")}
                                </label>
                                <span className="text-sm font-bold text-primary">
                                    {t("search.priceUnder", { price: "₩" + maxPrice.toLocaleString() })}
                                </span>
                            </div>
                            <Slider
                                min={50000}
                                max={500000}
                                value={maxPrice}
                                onChange={handlePriceChange}
                            />
                            <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
                                <span>{t("search.priceMin")}</span>
                                <span>{t("search.priceMax")}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Results Summary */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {selectedLocationName ?? t("search.allRegions")}
                    </h1>
                    <span className="text-sm text-stone-500 font-medium">
                        {selectedLocationName
                            ? t("search.available", { region: selectedLocationName, count: totalCount })
                            : t("search.availableAll", { count: totalCount })}
                    </span>
                </div>

                {/* Listing Grid */}
                {listings.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {visibleListings.map((listing) => (
                                <Card
                                    key={listing.id}
                                    className="overflow-hidden group cursor-pointer border-none shadow-lg"
                                    onClick={() => navigate(`/property/${listing.id}`)}
                                >
                                    <div className="aspect-[4/3] overflow-hidden">
                                        <img
                                            src={listing.image}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            alt={listing.title}
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-6 bg-white">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-primary tracking-widest uppercase">
                                                {listing.locationLabel}
                                            </span>
                                            {listing.rating != null && (
                                                <span className="text-sm font-medium">★ {listing.rating}</span>
                                            )}
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{listing.title}</h3>
                                        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                                            {listing.description}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <span className="text-lg font-bold">
                                                ₩{listing.pricePerNight.toLocaleString()}{" "}
                                                <span className="text-sm font-normal text-muted-foreground">
                                                    {t("featured.perNight")}
                                                </span>
                                            </span>
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/property/${listing.id}`);
                                                }}
                                            >
                                                {t("featured.viewDetail")}
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Load More */}
                        {hasMore && (
                            <div className="flex justify-center mt-12">
                                <Button
                                    variant="outline"
                                    className="px-10 h-12 rounded-full"
                                    onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
                                >
                                    {t("search.loadMore", { count: listings.length - visibleCount })}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    /* Empty State */
                    <div className="py-24 text-center">
                        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-stone-50 mb-6">
                            <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-stone-900 mb-2">
                            {t("search.noResults")}
                        </h3>
                        <p className="text-stone-500 max-w-xs mx-auto">
                            {t("search.noResultsSub")}
                        </p>
                        <Button
                            variant="outline"
                            className="mt-8"
                            onClick={() => {
                                setSelectedLocation(null);
                                setMaxPrice(500000);
                                applyFilters(null, 500000);
                            }}
                        >
                            {t("search.reset")}
                        </Button>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
