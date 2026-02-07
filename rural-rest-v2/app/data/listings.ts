
export interface Listing {
    id: string;
    title: string;
    description: string;
    location: string;
    locationLabel: string;
    pricePerNight: number;
    rating: number;
    image: string;
    maxGuests: number;
}

const LOCATION_VALUES = ["seoul-suburbs", "busan-suburbs", "gyeongju", "incheon", "jeju"] as const;
const LOCATION_LABELS = ["서울 근처", "부산 근처", "경주 근처", "인천 근처", "제주도"];

function buildDeterministicListings(count: number, startId: number): Listing[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = startId + i;
    const locIndex = idx % LOCATION_VALUES.length;
    const location = LOCATION_VALUES[locIndex];
    const locationLabel = LOCATION_LABELS[locIndex];
    const id = idx.toString();
    const pricePerNight = 50000 + ((idx * 9000) % 450001);
    const rating = 4 + (idx % 10) / 10;
    const maxGuests = 2 + (idx % 5);

    return {
      id,
      title: `${locationLabel} 감성 숙소 ${id}`,
      description: "고즈넉한 풍경과 따뜻한 정이 기다리는 곳입니다. 일상의 스트레스를 날려버리세요.",
      location,
      locationLabel,
      pricePerNight,
      rating: parseFloat(rating.toFixed(1)),
      image: "/house.png",
      maxGuests
    };
  });
}

export const mockListings: Listing[] = [
    {
        id: "1",
        title: "성주 할머니댁 돌담집",
        description: "할머니의 정취가 느껴지는 고즈넉한 돌담집입니다. 마당에서 구워먹는 삼겹살이 일품입니다.",
        location: "gyeongju",
        locationLabel: "경주 근처",
        pricePerNight: 120000,
        rating: 4.9,
        image: "/house.png",
        maxGuests: 4
    },
    {
        id: "2",
        title: "양평 숲속 오두막",
        description: "서울에서 1시간 거리, 피톤치드 가득한 숲속에서 진정한 휴식을 즐기세요.",
        location: "seoul-suburbs",
        locationLabel: "서울 근처",
        pricePerNight: 250000,
        rating: 4.8,
        image: "/house.png",
        maxGuests: 2
    },
    {
        id: "3",
        title: "기장 바다 앞 민박",
        description: "파도 소리를 들으며 일어나는 아침, 부산 바다의 매력을 온전히 느껴보세요.",
        location: "busan-suburbs",
        locationLabel: "부산 근처",
        pricePerNight: 180000,
        rating: 4.7,
        image: "/house.png",
        maxGuests: 6
    },
    {
        id: "4",
        title: "강화도 낙조 한옥",
        description: "지는 해를 바라보며 마시는 차 한잔의 여유, 인천의 숨은 보석 같은 공간입니다.",
        location: "incheon",
        locationLabel: "인천 근처",
        pricePerNight: 320000,
        rating: 4.9,
        image: "/house.png",
        maxGuests: 4
    },
    {
        id: "5",
        title: "제주 애월 돌담 민박",
        description: "제주도 푸른 밤, 별을 헤며 잠드는 로맨틱한 시골집입니다.",
        location: "jeju",
        locationLabel: "제주도",
        pricePerNight: 150000,
        rating: 4.6,
        image: "/house.png",
        maxGuests: 2
    },
    ...buildDeterministicListings(45, 6)
];

export async function getFeaturedListings(): Promise<Listing[]> {
  return Promise.resolve(mockListings);
}
