import { Header, Button, Card, Badge, Slider, Footer } from "../components/ui-mockup";
import { useState, useMemo } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { detectLocale } from "~/lib/i18n.server";
import { applyListingLocale } from "~/data/listing-translations";
import type { Route } from "./+types/home";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

function toCityLabel(location: string): string {
    const m = location.match(/([가-힣]+)시/);
    return m ? `${m[1]} 근처` : location;
}


export async function loader({ request }: Route.LoaderArgs) {
    const locale = await detectLocale(request);
    const rows = await db
        .select({
            id: listings.id,
            title: listings.title,
            description: listings.description,
            location: listings.location,
            region: listings.region,
            pricePerNight: listings.pricePerNight,
            maxGuests: listings.maxGuests,
            images: listings.images,
            tokenStatus: rwaTokens.status,
        })
        .from(listings)
        .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(and(
            inArray(rwaTokens.status, ["funding", "funded", "active"]),
            isNotNull(rwaTokens.tokenMint),
        ));

    return {
        featuredListings: rows.map((row) => applyListingLocale({
            id: row.id,
            title: row.title,
            description: row.description,
            location: row.location,
            region: row.region,
            cityLabel: toCityLabel(row.location),
            pricePerNight: row.pricePerNight,
            maxGuests: row.maxGuests,
            image: (row.images as string[])[0] ?? "/house.png",
            rating: null as number | null,
        }, locale)),
    };
}

export default function Home() {
  const { featuredListings } = useLoaderData<typeof loader>();
  const { t } = useTranslation("home");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(300000);
  const navigate = useNavigate();

  function handleSearch() {
    const params = new URLSearchParams();
    if (selectedLocation) {
      params.set("location", selectedLocation);
    }
    params.set("maxPrice", String(maxPrice));
    navigate(`/search?${params.toString()}`);
  }

  const locations = [
    { name: t("regions.경상도"), value: "경상" },
    { name: t("regions.경기도"), value: "경기" },
    { name: t("regions.강원도"), value: "강원" },
    { name: t("regions.충청도"), value: "충청" },
    { name: t("regions.전라도"), value: "전라" },
    { name: t("regions.제주도"), value: "제주" },
  ];

  const filteredListings = useMemo(() => {
    return featuredListings.filter((listing) => {
      const matchesLocation = !selectedLocation || listing.region === selectedLocation;
      const matchesPrice = listing.pricePerNight <= maxPrice;
      return matchesLocation && matchesPrice;
    });
  }, [featuredListings, selectedLocation, maxPrice]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main>
        {/* Hero Section with Smart Search */}
        <section className="relative h-[650px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[url('/hero.png')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          </div>

          <div className="relative z-10 w-full max-w-4xl px-4 text-center space-y-10">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-7xl font-bold text-white tracking-tight">
                <span className="block leading-tight">{t("hero.headline")}</span>
                <span className="block leading-tight mt-3 md:mt-4 text-white/90 font-medium italic">{t("hero.headlineSub")}</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light">
                {t("hero.subtitle")}
              </p>
            </div>

            {/* Smart Search Bar */}
            <Card className="p-6 md:p-8 bg-white/95 backdrop-blur shadow-2xl border-none rounded-[2rem] max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                {/* Location Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest pl-1">{t("search.whereTo")}</label>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((loc) => (
                      <Badge
                        key={loc.value}
                        variant={selectedLocation === loc.value ? "default" : "outline"}
                        className="py-1.5 px-4 text-[13px] border-stone-200 transition-all active:scale-95"
                        onClick={() => setSelectedLocation(selectedLocation === loc.value ? null : loc.value)}
                      >
                        {loc.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Price Range Selection */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">{t("search.priceCap")}</label>
                    <span className="text-sm font-bold text-primary">{t("search.priceUnder", { price: "₩" + maxPrice.toLocaleString() })}</span>
                  </div>
                  <div className="pt-2">
                    <Slider
                      min={50000}
                      max={500000}
                      value={maxPrice}
                      onChange={(val) => setMaxPrice(val)}
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-stone-400 font-medium px-1 uppercase tracking-tighter">
                      <span>{t("search.priceMin")}</span>
                      <span>{t("search.priceMax")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-stone-400 text-sm italic">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {selectedLocation
                      ? t("search.available", { region: locations.find(l => l.value === selectedLocation)?.name, count: filteredListings.length })
                      : t("search.availableAll", { count: filteredListings.length })}
                  </span>
                </div>
                <Button
                  onClick={handleSearch}
                  className="w-full sm:w-auto h-12 px-10 text-md font-bold rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                  {t("search.findStay")}
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* Featured Stays */}
        <section className="container mx-auto py-16 px-4 sm:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold tracking-tight">{t("featured.title")}</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-400 font-medium">{t("featured.count", { count: filteredListings.length })}</span>
              <Button variant="ghost">{t("featured.viewAll")}</Button>
            </div>
          </div>

          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden group cursor-pointer border-none shadow-lg">
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img
                      src={listing.image}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={listing.title}
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-primary tracking-widest uppercase">{listing.cityLabel}</span>
                      {listing.rating != null && (
                        <span className="text-xs text-stone-500 font-medium flex items-center gap-0.5">
                          ★ {listing.rating}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{listing.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{listing.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-lg font-bold">₩{listing.pricePerNight.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t("featured.perNight")}</span></span>
                      <Button onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/property/${listing.id}`);
                      }}>{t("featured.viewDetail")}</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-stone-50 mb-6">
                <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">{t("search.noResults")}</h3>
              <p className="text-stone-500 max-w-xs mx-auto">{t("search.noResultsSub")}</p>
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => {
                  setSelectedLocation(null);
                  setMaxPrice(500000);
                }}
              >
                {t("search.reset")}
              </Button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
