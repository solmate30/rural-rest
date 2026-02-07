import { Header, Button, Card, Badge, Slider, Footer } from "../components/ui-mockup";
import { useState } from "react";

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(300000);

  const locations = [
    { name: "서울 근처", value: "seoul-suburbs" },
    { name: "부산 근처", value: "busan-suburbs" },
    { name: "경주 근처", value: "gyeongju" },
    { name: "인천 근처", value: "incheon" },
    { name: "제주도", value: "jeju" },
  ];

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
                    {locations.slice(0, 4).map((loc) => (
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
                  <span>현재 서울 근처 12곳의 빈집이 기다리고 있어요</span>
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
            <Button variant="ghost">View all</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden group cursor-pointer border-none shadow-lg">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src="/house.png"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    alt="Rural House"
                  />
                </div>
                <div className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary tracking-widest uppercase">Gangwon-do</span>
                    <span className="text-sm font-medium">★ 4.9</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Grandma's Stone House</h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4">A peaceful retreat in a traditional stone house surrounded by orange groves.</p>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-lg font-bold">₩120,000 <span className="text-sm font-normal text-muted-foreground">/ night</span></span>
                    <Button onClick={() => window.location.href = '/property/1'}>Details</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
