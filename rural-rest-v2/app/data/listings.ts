
export interface Review {
  id: string;
  authorName: string;
  authorImage: string;
  rating: number;
  comment: string;
  date: string;         // ISO date string
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
    const description = "고즈넉한 풍경과 따뜻한 정이 기다리는 곳입니다. 일상의 스트레스를 날려버리세요.";

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
      reviews: []
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
    ]
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
    ]
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
    reviews: []
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
    reviews: []
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
    reviews: []
  },
  ...buildDeterministicListings(45, 6)
];

export async function getFeaturedListings(): Promise<Listing[]> {
  return Promise.resolve(mockListings);
}

export async function getListingById(id: string): Promise<Listing | null> {
  return Promise.resolve(mockListings.find((l) => l.id === id) ?? null);
}
