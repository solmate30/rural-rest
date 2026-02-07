import { Header, Button, Card } from "../components/ui-mockup";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative h-[500px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[url('/hero.png')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          </div>
          <div className="relative text-center space-y-6 px-4">
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">Authentic Rural Stays</h1>
            <p className="text-lg text-white/90 max-w-lg mx-auto">Discover the hidden beauty of the Korean countryside in meticulously renovated empty houses.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button className="w-full sm:w-auto text-lg h-12 px-8">Explor Now</Button>
              <Button variant="outline" className="w-full sm:w-auto text-lg h-12 px-8 bg-white/10 text-white border-white/20 hover:bg-white/20">How it works</Button>
            </div>
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
    </div>
  );
}
