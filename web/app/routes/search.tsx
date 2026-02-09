import { Header, Button, Card, Badge, Slider, Footer } from "~/components/ui-mockup";
import { useState, useMemo } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/search";
import { mockListings } from "~/data/listings";

const ITEMS_PER_PAGE = 12;

const locations = [
    { name: "서울 근처", value: "seoul-suburbs" },
    { name: "부산 근처", value: "busan-suburbs" },
    { name: "경주 근처", value: "gyeongju" },
    { name: "인천 근처", value: "incheon" },
    { name: "제주도", value: "jeju" },
];

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const location = url.searchParams.get("location");
    const maxPrice = Number(url.searchParams.get("maxPrice")) || 500000;

    const filtered = mockListings.filter((listing) => {
        const matchesLocation = !location || listing.location === location;
        const matchesPrice = listing.pricePerNight <= maxPrice;
        return matchesLocation && matchesPrice;
    });

    return {
        listings: filtered,
        totalCount: filtered.length,
        filters: { location, maxPrice },
    };
}

export default function SearchResults() {
    const { listings, totalCount, filters } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // 필터 상태: URL params에서 초기화
    const [selectedLocation, setSelectedLocation] = useState<string | null>(
        filters.location
    );
    const [maxPrice, setMaxPrice] = useState(filters.maxPrice);

    // 페이지네이션 상태
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    const visibleListings = useMemo(
        () => listings.slice(0, visibleCount),
        [listings, visibleCount]
    );
    const hasMore = visibleCount < listings.length;

    // 필터 변경 핸들러: URL params 업데이트 -> loader 재호출
    function applyFilters(location: string | null, price: number) {
        const params = new URLSearchParams();
        if (location) params.set("location", location);
        params.set("maxPrice", String(price));
        setSearchParams(params);
        setVisibleCount(ITEMS_PER_PAGE); // 페이지네이션 초기화
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
                                Where to?
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
                                    Max Budget
                                </label>
                                <span className="text-sm font-bold text-primary">
                                    ₩{maxPrice.toLocaleString()} 미만
                                </span>
                            </div>
                            <Slider
                                min={50000}
                                max={500000}
                                value={maxPrice}
                                onChange={handlePriceChange}
                            />
                            <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
                                <span>₩5만</span>
                                <span>₩50만+</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Results Summary */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {selectedLocation
                            ? locations.find((l) => l.value === selectedLocation)?.name
                            : "전체 지역"}
                    </h1>
                    <span className="text-sm text-stone-500 font-medium">
                        {totalCount}곳의 숙소를 찾았어요
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
                                        />
                                    </div>
                                    <div className="p-6 bg-white">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-primary tracking-widest uppercase">
                                                {listing.locationLabel}
                                            </span>
                                            <span className="text-sm font-medium">★ {listing.rating}</span>
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{listing.title}</h3>
                                        <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                                            {listing.description}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t">
                                            <span className="text-lg font-bold">
                                                ₩{listing.pricePerNight.toLocaleString()}{" "}
                                                <span className="text-sm font-normal text-muted-foreground">
                                                    / night
                                                </span>
                                            </span>
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/property/${listing.id}`);
                                                }}
                                            >
                                                Details
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
                                    더 보기 ({listings.length - visibleCount}곳 남음)
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
                            조건에 맞는 숙소가 없어요
                        </h3>
                        <p className="text-stone-500 max-w-xs mx-auto">
                            지역이나 예산을 바꿔 가며 당신만의 휴식처를 찾아보세요.
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
                            필터 초기화
                        </Button>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
