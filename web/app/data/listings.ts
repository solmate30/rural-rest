
export interface Review {
  id: string;
  authorName: string;
  authorImage: string;
  rating: number;
  comment: string;
  date: string;         // ISO date string
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TransportOption {
  mode: "train" | "bus" | "taxi" | "shuttle";
  label: string;
  routeName: string;
  estimatedTime: string;
  estimatedCost: string;
  description: string;
}

export interface PickupPoint {
  id: string;
  name: string;
  description: string;
  estimatedTimeToProperty: string;
}

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
  // -- 상세 페이지 확장 필드 --
  images: string[];     // 갤러리 이미지 배열
  amenities: string[];  // 편의시설 목록
  hostName: string;     // 호스트 이름
  hostImage: string;    // 호스트 아바타
  hostBio: string;      // 호스트 소개
  about: string;        // 상세 설명 (description보다 긴 텍스트)
  reviews: Review[];    // 리뷰 목록
  // -- 지도 & 교통 확장 필드 --
  coordinates: Coordinates;
  nearbyLandmarks: string[];
  transportOptions: TransportOption[];
  pickupPoints: PickupPoint[];
}

const LOCATION_VALUES = ["seoul-suburbs", "busan-suburbs", "gyeongju", "incheon", "jeju"] as const;
const LOCATION_LABELS = ["서울 근처", "부산 근처", "경주 근처", "인천 근처", "제주도"];

// -- 지역별 Lookup Maps --

const LOCATION_COORDINATES: Record<string, Coordinates> = {
  "seoul-suburbs": { lat: 37.4913, lng: 127.5534 },
  "busan-suburbs": { lat: 35.2444, lng: 129.2222 },
  "gyeongju": { lat: 35.8562, lng: 129.2247 },
  "incheon": { lat: 37.4563, lng: 126.7052 },
  "jeju": { lat: 33.4531, lng: 126.5706 },
};

const LOCATION_LANDMARKS: Record<string, string[]> = {
  "seoul-suburbs": ["양평 두물머리", "남한산성", "양평 레일바이크", "세미원 수생식물원"],
  "busan-suburbs": ["기장 죽성성당", "해동용궁사", "기장 시장", "일광해수욕장"],
  "gyeongju": ["불국사", "첨성대", "안압지 (동궁과 월지)", "경주 남산"],
  "incheon": ["강화 고인돌", "마니산", "전등사", "강화도 평화전망대"],
  "jeju": ["한라산", "애월 해안도로", "협재 해수욕장", "오설록 티 뮤지엄"],
};

const LOCATION_TRANSPORT: Record<string, TransportOption[]> = {
  "seoul-suburbs": [
    { mode: "train", label: "KTX / ITX", routeName: "용산역 → 양평역", estimatedTime: "약 1시간", estimatedCost: "₩15,000", description: "용산역에서 ITX-청춘 이용 시 양평역까지 빠르게 이동 가능합니다." },
    { mode: "bus", label: "시외버스", routeName: "동서울터미널 → 양평터미널", estimatedTime: "약 1시간 30분", estimatedCost: "₩8,000", description: "동서울종합터미널에서 양평행 시외버스가 20분 간격으로 운행합니다." },
    { mode: "taxi", label: "택시", routeName: "양평역 → 숙소", estimatedTime: "약 15분", estimatedCost: "₩12,000", description: "양평역에서 숙소까지 택시로 약 15분 소요됩니다." },
    { mode: "shuttle", label: "셔틀 서비스", routeName: "양평역 → 숙소", estimatedTime: "약 20분", estimatedCost: "무료", description: "사전 예약 시 양평역에서 무료 셔틀을 이용하실 수 있습니다." },
  ],
  "busan-suburbs": [
    { mode: "train", label: "KTX", routeName: "서울역 → 부산역", estimatedTime: "약 2시간 30분", estimatedCost: "₩59,800", description: "KTX로 부산역까지 이동 후 동해선으로 환승합니다." },
    { mode: "bus", label: "시외버스", routeName: "부산 사상터미널 → 기장", estimatedTime: "약 50분", estimatedCost: "₩5,000", description: "사상터미널에서 기장행 버스가 30분 간격으로 운행합니다." },
    { mode: "taxi", label: "택시", routeName: "기장역 → 숙소", estimatedTime: "약 10분", estimatedCost: "₩8,000", description: "기장역에서 숙소까지 택시로 약 10분 소요됩니다." },
    { mode: "shuttle", label: "셔틀 서비스", routeName: "기장역 → 숙소", estimatedTime: "약 15분", estimatedCost: "무료", description: "사전 예약 시 기장역에서 무료 셔틀을 이용하실 수 있습니다." },
  ],
  "gyeongju": [
    { mode: "train", label: "KTX", routeName: "서울역 → 신경주역", estimatedTime: "약 2시간", estimatedCost: "₩49,500", description: "KTX로 신경주역까지 직행 이동이 가능합니다." },
    { mode: "bus", label: "시외버스", routeName: "서울 고속터미널 → 경주터미널", estimatedTime: "약 3시간 30분", estimatedCost: "₩25,000", description: "고속터미널에서 경주행 버스가 1시간 간격으로 운행합니다." },
    { mode: "taxi", label: "택시", routeName: "신경주역 → 숙소", estimatedTime: "약 20분", estimatedCost: "₩15,000", description: "신경주역에서 숙소까지 택시로 약 20분 소요됩니다." },
    { mode: "shuttle", label: "셔틀 서비스", routeName: "신경주역 → 숙소", estimatedTime: "약 25분", estimatedCost: "무료", description: "사전 예약 시 신경주역에서 무료 셔틀을 이용하실 수 있습니다." },
  ],
  "incheon": [
    { mode: "train", label: "지하철 / 광역버스", routeName: "서울 → 강화터미널", estimatedTime: "약 1시간 30분", estimatedCost: "₩10,000", description: "신촌에서 3000번 광역버스로 강화터미널까지 이동합니다." },
    { mode: "bus", label: "시외버스", routeName: "신촌 → 강화터미널", estimatedTime: "약 1시간 30분", estimatedCost: "₩7,500", description: "신촌에서 강화행 시외버스가 수시 운행합니다." },
    { mode: "taxi", label: "택시", routeName: "강화터미널 → 숙소", estimatedTime: "약 15분", estimatedCost: "₩10,000", description: "강화터미널에서 숙소까지 택시로 약 15분 소요됩니다." },
    { mode: "shuttle", label: "셔틀 서비스", routeName: "강화터미널 → 숙소", estimatedTime: "약 20분", estimatedCost: "무료", description: "사전 예약 시 강화터미널에서 무료 셔틀을 이용하실 수 있습니다." },
  ],
  "jeju": [
    { mode: "train", label: "항공편", routeName: "김포공항 → 제주공항", estimatedTime: "약 1시간 10분", estimatedCost: "₩50,000~₩100,000", description: "국내선 항공편으로 제주공항까지 이동합니다." },
    { mode: "bus", label: "공항 리무진", routeName: "제주공항 → 애월", estimatedTime: "약 40분", estimatedCost: "₩5,000", description: "제주공항에서 애월 방면 리무진 버스가 운행합니다." },
    { mode: "taxi", label: "택시", routeName: "제주공항 → 숙소", estimatedTime: "약 30분", estimatedCost: "₩20,000", description: "제주공항에서 숙소까지 택시로 약 30분 소요됩니다." },
    { mode: "shuttle", label: "셔틀 서비스", routeName: "제주공항 → 숙소", estimatedTime: "약 40분", estimatedCost: "무료", description: "사전 예약 시 제주공항에서 무료 셔틀을 이용하실 수 있습니다." },
  ],
};

const LOCATION_PICKUPS: Record<string, PickupPoint[]> = {
  "seoul-suburbs": [
    { id: "p1", name: "양평역 2번 출구", description: "역 앞 편의점 앞에서 대기", estimatedTimeToProperty: "약 20분" },
    { id: "p2", name: "양평터미널", description: "터미널 정문 앞 셔틀 정류장", estimatedTimeToProperty: "약 15분" },
  ],
  "busan-suburbs": [
    { id: "p1", name: "기장역 1번 출구", description: "역 앞 주차장에서 대기", estimatedTimeToProperty: "약 15분" },
    { id: "p2", name: "일광역", description: "일광역 정문 앞 셔틀 정류장", estimatedTimeToProperty: "약 10분" },
  ],
  "gyeongju": [
    { id: "p1", name: "신경주역 동편 출구", description: "역 동편 택시 승강장 옆", estimatedTimeToProperty: "약 25분" },
    { id: "p2", name: "경주터미널", description: "터미널 정문 앞 셔틀 정류장", estimatedTimeToProperty: "약 20분" },
  ],
  "incheon": [
    { id: "p1", name: "강화터미널", description: "터미널 1번 플랫폼 앞", estimatedTimeToProperty: "약 20분" },
    { id: "p2", name: "강화읍 버스정류장", description: "강화읍 중심가 버스정류장", estimatedTimeToProperty: "약 15분" },
  ],
  "jeju": [
    { id: "p1", name: "제주공항 1번 게이트", description: "국내선 1번 게이트 앞 셔틀 정류장", estimatedTimeToProperty: "약 40분" },
    { id: "p2", name: "애월 한담해변 주차장", description: "한담해변 공영주차장 입구", estimatedTimeToProperty: "약 10분" },
  ],
};

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
    const description = "고즈넉한 풍경과 따뜻한 정이 기다리는 곳입니다. 일상의 스트레스를 날려버리세요.";

    const baseCoords = LOCATION_COORDINATES[location];
    const latOffset = ((idx * 7) % 100) / 10000;
    const lngOffset = ((idx * 13) % 100) / 10000;

    return {
      id,
      title: `${locationLabel} 감성 숙소 ${id}`,
      description,
      location,
      locationLabel,
      pricePerNight,
      rating: parseFloat(rating.toFixed(1)),
      image: "/house.png",
      maxGuests,
      images: ["/house.png", "/house.png", "/house.png", "/house.png", "/house.png"],
      amenities: ["WiFi", "주차장", "온돌 난방"],
      hostName: `호스트 ${id}`,
      hostImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
      hostBio: "시골의 정취를 전하는 호스트입니다.",
      about: description,
      reviews: [],
      coordinates: {
        lat: baseCoords.lat + latOffset,
        lng: baseCoords.lng + lngOffset,
      },
      nearbyLandmarks: LOCATION_LANDMARKS[location] ?? [],
      transportOptions: LOCATION_TRANSPORT[location] ?? [],
      pickupPoints: LOCATION_PICKUPS[location] ?? [],
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
    maxGuests: 4,
    images: ["/house.png", "/house.png", "/house.png", "/house.png", "/house.png"],
    amenities: ["WiFi", "주차장", "BBQ 그릴", "마당", "온돌 난방", "세탁기"],
    hostName: "김순자",
    hostImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=host",
    hostBio: "남해에서 30년째 살고 있는 순자입니다. 할머니 댁을 정성스럽게 가꿔왔어요.",
    about: "고즈넉한 돌담 사이로 불어오는 바람이 마음을 차분하게 해주는 곳입니다. 도시의 소음에서 벗어나 진정한 휴식을 즐기실 수 있도록 정성을 다해 준비했습니다.\n\n마당에서는 밤하늘의 별을 보며 불멍을 즐길 수 있고, 할머니께서 직접 가꾸신 텃밭의 채소도 맛보실 수 있습니다.",
    reviews: [
      {
        id: "r1",
        authorName: "민수",
        authorImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        rating: 5,
        comment: "정말 편안하게 쉬다 왔습니다. 할머니가 직접 만들어주신 유자차가 잊을 수 없어요.",
        date: "2026-01-15"
      },
      {
        id: "r2",
        authorName: "지은",
        authorImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        rating: 4,
        comment: "동네가 정말 조용하고 돌담이 예뻐요. 산책하기 너무 좋습니다.",
        date: "2026-01-20"
      }
    ],
    coordinates: { lat: 35.8562, lng: 129.2247 },
    nearbyLandmarks: ["불국사", "첨성대", "안압지 (동궁과 월지)", "경주 남산"],
    transportOptions: LOCATION_TRANSPORT["gyeongju"],
    pickupPoints: LOCATION_PICKUPS["gyeongju"],
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
    maxGuests: 2,
    images: ["/house.png", "/house.png", "/house.png", "/house.png"],
    amenities: ["WiFi", "주차장", "벽난로", "숲속 산책로", "커피 머신"],
    hostName: "이정우",
    hostImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=host",
    hostBio: "숲을 사랑하는 건축가입니다. 자연과 조화를 이루는 공간을 지향합니다.",
    about: "울창한 숲속에 위치한 이 오두막은 자연과의 깊은 교감을 위해 설계되었습니다. 나무 냄새와 새소리만 가득한 이곳에서 진정한 나만의 시간을 가져보세요.",
    reviews: [
      {
        id: "r3",
        authorName: "철수",
        authorImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
        rating: 5,
        comment: "완벽한 고립이었습니다. 핸드폰 내려놓고 책 읽기에 이보다 더 좋은 곳은 없을 거예요.",
        date: "2026-01-10"
      }
    ],
    coordinates: { lat: 37.4913, lng: 127.5534 },
    nearbyLandmarks: ["양평 두물머리", "남한산성", "양평 레일바이크", "세미원 수생식물원"],
    transportOptions: LOCATION_TRANSPORT["seoul-suburbs"],
    pickupPoints: LOCATION_PICKUPS["seoul-suburbs"],
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
    maxGuests: 6,
    images: ["/house.png", "/house.png", "/house.png", "/house.png", "/house.png"],
    amenities: ["WiFi", "에어컨", "테라스", "오션뷰", "낚시 도구 대여"],
    hostName: "박만석",
    hostImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=host",
    hostBio: "평생을 바다와 함께한 기장 토박이입니다.",
    about: "창문만 열면 들려오는 파도 소리가 매력적인 곳입니다. 옥상 테라스에서는 매일 아침 황홀한 일출을 보실 수 있습니다. 직접 잡은 신선한 해산물로 정성껏 대접하겠습니다.",
    reviews: [],
    coordinates: { lat: 35.2444, lng: 129.2222 },
    nearbyLandmarks: ["기장 죽성성당", "해동용궁사", "기장 시장", "일광해수욕장"],
    transportOptions: LOCATION_TRANSPORT["busan-suburbs"],
    pickupPoints: LOCATION_PICKUPS["busan-suburbs"],
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
    maxGuests: 4,
    images: ["/house.png", "/house.png", "/house.png", "/house.png", "/house.png"],
    amenities: ["WiFi", "전통 다도 세트", "마당", "해넘이 명소", "황토방"],
    hostName: "최윤희",
    hostImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=host",
    hostBio: "전통 무용을 전공하고 한옥의 아름다움을 알리고 싶어 이곳을 열었습니다.",
    about: "서해 바다로 떨어지는 붉은 노을이 가장 아름다운 한옥입니다. 전통 다도로 마음의 평안을 얻고, 뜨끈한 황토방에서 깊은 잠을 청해 보세요.",
    reviews: [],
    coordinates: { lat: 37.4563, lng: 126.7052 },
    nearbyLandmarks: ["강화 고인돌", "마니산", "전등사", "강화도 평화전망대"],
    transportOptions: LOCATION_TRANSPORT["incheon"],
    pickupPoints: LOCATION_PICKUPS["incheon"],
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
    maxGuests: 2,
    images: ["/house.png", "/house.png", "/house.png", "/house.png"],
    amenities: ["WiFi", "해먹", "귤밭 체험", "야외 스파", "빔프로젝터"],
    hostName: "강수연",
    hostImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=host",
    hostBio: "제주도 이주 5년 차, 시골 생활의 즐거움을 나누고 싶은 호스트입니다.",
    about: "애월의 조용한 마을에 위치한 작은 돌담집입니다. 계절마다 다른 매력을 뽐내는 귤밭 사이에서 제주 시골의 넉넉함을 느껴보세요.",
    reviews: [],
    coordinates: { lat: 33.4531, lng: 126.5706 },
    nearbyLandmarks: ["한라산", "애월 해안도로", "협재 해수욕장", "오설록 티 뮤지엄"],
    transportOptions: LOCATION_TRANSPORT["jeju"],
    pickupPoints: LOCATION_PICKUPS["jeju"],
  },
  ...buildDeterministicListings(45, 6)
];

export async function getFeaturedListings(): Promise<Listing[]> {
  return Promise.resolve(mockListings);
}

export async function getListingById(id: string): Promise<Listing | null> {
  return Promise.resolve(mockListings.find((l) => l.id === id) ?? null);
}
