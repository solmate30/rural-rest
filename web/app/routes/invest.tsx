import { Header, Footer } from "~/components/ui-mockup";
import RwaWalletProvider from "~/components/RwaWalletProvider";
import { useNavigate } from "react-router";

export default function InvestDashboard() {
    const navigate = useNavigate();

    const properties = [
        {
            id: "jeonju-01",
            title: "경주 할머니댁 돌담집",
            location: "경주 근처",
            image: "/house.png",
            apy: "8.2%",
            tokenPrice: "₩50,000",
            totalValuation: "5억 원",
            fundingProgress: 78,
            raised: "3.9억 원",
            remaining: "1.1억 원",
            status: "active"
        },
        {
            id: "andong-01",
            title: "양평 숲속 오두막",
            location: "서울 근처",
            image: "/house.png",
            apy: "7.5%",
            tokenPrice: "₩50,000",
            totalValuation: "4.2억 원",
            fundingProgress: 45,
            raised: "1.89억 원",
            remaining: "2.31억 원",
            status: "active"
        },
        {
            id: "gangneung-01",
            title: "기장 바다 앞 민박",
            location: "부산 근처",
            image: "/house.png",
            apy: "9.1%",
            tokenPrice: "₩50,000",
            totalValuation: "6.8억 원",
            fundingProgress: 92,
            raised: "6.25억 원",
            remaining: "0.55억 원",
            status: "active"
        },
        {
            id: "gyeongju-01",
            title: "제주 애월 돌담 민박",
            location: "제주도",
            image: "/house.png",
            apy: "~8.5%",
            tokenPrice: "₩50,000",
            totalValuation: "미정",
            fundingProgress: 0,
            raised: "0",
            remaining: "0",
            status: "coming_soon"
        }
    ];

    return (
        <RwaWalletProvider>
            <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
                <Header />

                <main className="flex-1">
                    <div className="container mx-auto py-16 px-4 sm:px-8">
                        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                            <div className="max-w-2xl">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-3">
                                    Invest in Rural Korea
                                </h1>
                            <p className="text-lg text-muted-foreground">
                                한국 농촌의 작은 마을 한 켠을, 지금 소유하세요.<br />
                                리모델링된 빈집이 매달 배당 수익을 만들고, 마을은 다시 살아납니다.
                            </p>
                            </div>
                            <div className="flex w-full md:w-auto items-center overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                                <div className="flex gap-2 items-center flex-nowrap w-max">
                                    <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/80 shadow-sm hover:bg-background shrink-0">
                                        <span className="material-symbols-outlined text-[18px]">tune</span>
                                        필터
                                    </button>
                                    <div className="h-9 w-[1px] bg-border mx-1 shrink-0 hidden sm:block"></div>
                                    <button className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-sm shrink-0">전체 지역</button>
                                    <button className="rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-background transition-colors shrink-0">전주</button>
                                    <button className="rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-background transition-colors shrink-0">안동</button>
                                    <button className="rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-background transition-colors shrink-0">강릉</button>
                                </div>
                            </div>
                        </div>

                        <div className="w-full">
                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {properties.map((property) => (
                                    <div key={property.id} onClick={() => navigate(`/invest/${property.id}`)} className={`group relative flex flex-col overflow-hidden rounded-[calc(var(--radius)*2)] bg-card border-none shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer ${property.status === 'coming_soon' ? 'opacity-80 hover:opacity-100' : ''}`}>

                                        {property.status === 'coming_soon' && (
                                            <div className="absolute inset-0 bg-background/60 z-20 flex items-center justify-center backdrop-blur-[1px] group-hover:backdrop-blur-none transition-all">
                                                <div className="bg-card px-4 py-2 rounded-full shadow-lg border border-border text-sm font-bold text-foreground flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
                                                    오픈 예정
                                                </div>
                                            </div>
                                        )}

                                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/20">
                                            <div className="absolute top-3 right-3 z-10 rounded-full bg-card/90 px-2.5 py-1 text-xs font-bold text-foreground backdrop-blur-sm shadow-sm flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px] text-green-600">trending_up</span>
                                                연 {property.apy}
                                            </div>
                                            <img
                                                alt={property.title}
                                                className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${property.status === 'coming_soon' ? 'grayscale group-hover:grayscale-0' : ''}`}
                                                src={property.image}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 to-transparent opacity-60"></div>
                                            <div className="absolute bottom-4 left-4 text-white z-10">
                                                <div className="flex items-center gap-1 text-xs font-medium bg-foreground/40 backdrop-blur-md px-2 py-1 rounded mb-1 w-fit">
                                                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                    {property.location}
                                                </div>
                                                <h3 className="text-xl font-bold">{property.title}</h3>
                                            </div>
                                        </div>

                                        <div className="flex flex-1 flex-col justify-between p-5">
                                            <div className="mb-4 grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs font-medium text-foreground/60">토큰 당 가격</p>
                                                    <p className="text-lg font-bold text-foreground">{property.tokenPrice}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-medium text-foreground/60">{property.status === 'coming_soon' ? '예상 수익률' : '자산 총액'}</p>
                                                    <p className="text-lg font-bold text-foreground">{property.status === 'coming_soon' ? property.apy : property.totalValuation}</p>
                                                </div>
                                            </div>

                                            {property.status === 'active' ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium text-foreground/80">모집률</span>
                                                            <span className="font-bold text-primary">{property.fundingProgress}%</span>
                                                        </div>
                                                        <div className="h-2.5 w-full rounded-full bg-background overflow-hidden border border-border/50">
                                                            <div className="h-full rounded-full bg-primary" style={{ width: `${property.fundingProgress}%` }}></div>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-foreground/50 pt-1">
                                                            <span>{property.raised} 모집 조달</span>
                                                            <span>{property.remaining} 남음</span>
                                                        </div>
                                                    </div>
                                                    <button className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors shadow-sm">
                                                        상세 보기
                                                    </button>
                                                </>
                                            ) : (
                                                <button className="mt-auto w-full rounded-lg border border-border bg-transparent py-2.5 text-sm font-semibold text-foreground/80 hover:border-primary hover:text-foreground hover:bg-background transition-colors">
                                                    오픈 알림 받기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        </RwaWalletProvider>
    );
}
