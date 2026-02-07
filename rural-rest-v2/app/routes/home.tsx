import { Header, Button, Card, Badge, Slider, Footer } from "../components/ui-mockup";
import { useState, useMemo } from "react";
import { useLoaderData } from "react-router";
import { getFeaturedListings } from "../data/listings";

export async function loader() {
  const featuredListings = await getFeaturedListings();
  return { featuredListings };
}

export default function Home() {
  const { featuredListings } = useLoaderData<typeof loader>();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(300000);

  const locations = [
    { name: "서울 근처", value: "seoul-suburbs" },
    { name: "부산 근처", value: "busan-suburbs" },
    { name: "경주 근처", value: "gyeongju" },
    { name: "인천 근처", value: "incheon" },
    { name: "제주도", value: "jeju" },
  ];

  const filteredListings = useMemo(() => {
    return featuredListings.filter((listing) => {
      const matchesLocation = !selectedLocation || listing.location === selectedLocation;
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
              <h1 className="text-4xl md:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                비어있던 집, <br className="md:hidden" />
                <span className="text-white/90 font-medium italic">다시 숨을 쉬다</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light">
                도시 근처, 가장 조용하고 한국적인 시골 숙소를 발견해보세요.
              </p>
            </div>

            {/* Smart Search Bar */}
            <Card className="p-6 md:p-8 bg-white/95 backdrop-blur shadow-2xl border-none rounded-[2rem] max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                {/* Location Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-widest pl-1">Where to?</label>
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
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Max Budget</label>
                    <span className="text-sm font-bold text-primary">₩{maxPrice.toLocaleString()} 미만</span>
                  </div>
                  <div className="pt-2">
                    <Slider
                      min={50000}
                      max={500000}
                      value={maxPrice}
                      onChange={(val) => setMaxPrice(val)}
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-stone-400 font-medium px-1 uppercase tracking-tighter">
                      <span>₩5만</span>
                      <span>₩50만+</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-stone-400 text-sm italic">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>현재 {selectedLocation ? locations.find(l => l.value === selectedLocation)?.name : "전체 지역"} {filteredListings.length}곳의 빈집이 기다리고 있어요</span>
                </div>
                <Button className="w-full sm:w-auto h-12 px-10 text-md font-bold rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                  숙소 찾기
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* Featured Stays */}
        <section className="container mx-auto py-16 px-4 sm:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Featured Stays</h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-400 font-medium">{filteredListings.length}곳</span>
              <Button variant="ghost">View all</Button>
            </div>
          </div>

          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredListings.map((listing) => (
                <Card key={listing.id} className="overflow-hidden group cursor-pointer border-none shadow-lg">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={listing.image}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt={listing.title}
                    />
                  </div>
                  <div className="p-6 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-primary tracking-widest uppercase">{listing.locationLabel}</span>
                      <span className="text-sm font-medium">★ {listing.rating}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{listing.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{listing.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-lg font-bold">₩{listing.pricePerNight.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ night</span></span>
                      <Button onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/property/${listing.id}`;
                      }}>Details</Button>
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
              <h3 className="text-xl font-bold text-stone-900 mb-2">조건에 맞는 숙소가 없어요</h3>
              <p className="text-stone-500 max-w-xs mx-auto">지역이나 예산을 바꿔 가며 당신만의 휴식처를 찾아보세요.</p>
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => {
                  setSelectedLocation(null);
                  setMaxPrice(500000);
                }}
              >
                필터 초기화
              </Button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
