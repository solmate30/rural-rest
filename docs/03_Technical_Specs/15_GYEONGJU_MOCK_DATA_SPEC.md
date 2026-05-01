# 23. 경주 파일럿 Mock 데이터 명세서

> Created: 2026-03-16 19:00
> Last Updated: 2026-03-16 19:00

본 문서는 **개발자가 `web/app/data/listings.ts` 파일을 작성할 때 사용하는 최종 확정 명세서**입니다.

**목적:** 경주 파일럿 5채의 Mock 데이터를 코드로 변환하기 위한 명확한 수치와 구조 제공

**리서치 근거:** [13_GYEONGJU_PILOT_DATA_RESEARCH.md](../01_Concept_Design/13_GYEONGJU_PILOT_DATA_RESEARCH.md) 참조

---

## 1. Listing 인터페이스 확장 필드

### 1.1. 기본 필드 (현재 존재, 18개)

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | string | 고유 ID | "gyeongju-3000" |
| `title` | string | 숙소명 | "황오동 청송재" |
| `description` | string | 짧은 설명 (1줄) | "뉴트로 감성 한옥스테이, 황리단길 도보 8분" |
| `location` | string | 지역 코드 | "gyeongju" |
| `locationLabel` | string | 지역 한글명 | "경주 근처" |
| `pricePerNight` | number | 1박 가격 (KRW) | 70000 |
| `rating` | number | 평점 (운영 전 임시) | 4.8 |
| `maxGuests` | number | 최대 수용 인원 | 4 |
| `image` | string | 대표 이미지 | "/images/gyeongju-3000-main.jpg" |
| `images` | string[] | 갤러리 이미지 | ["/images/...", ...] |
| `amenities` | string[] | 편의시설 | ["Wi-Fi", "에어컨", ...] |
| `hostName` | string | 호스트명 | "Rural Rest 경주팀" |
| `hostImage` | string | 호스트 이미지 | "/images/host-gyeongju.jpg" |
| `hostBio` | string | 호스트 소개 | "경주 빈집 재생 프로젝트..." |
| `about` | string | 상세 설명 (긴 텍스트) | "1960년대 한옥을 리모델링한..." |
| `reviews` | Review[] | 리뷰 목록 (운영 전 빈 배열) | [] |
| `coordinates` | Coordinates | GPS 좌표 | { lat: 35.8320, lng: 129.2150 } |
| `nearbyLandmarks` | string[] | 주변 명소 (거리 포함) | ["황리단길 (도보 8분)", ...] |
| `transportOptions` | TransportOption[] | 대중교통 정보 | [{ mode: "train", ...}, ...] |
| `pickupPoints` | PickupPoint[] | 픽업 지점 | [{ id: "p1", name: "신경주역", ...}] |

---

## 2. 경주 5채 최종 확정 데이터 표

### 2.1. 기본 정보 & 가격

| localhost ID | listings ID | 숙소명 | 컨셉 | 가격 (KRW) | maxGuests | 타겟 |
|-------------|------------|--------|------|-----------|-----------|------|
| localhost://3000 | gyeongju-3000 | 황오동 청송재 | 레트로 게스트하우스 | 70,000 | 4 | MZ 커플, 배낭족 |
| localhost://3001 | gyeongju-3001 | 성건동 충재댁 | 리모델링 단독주택 | 90,000 | 4 | 외국인, 시니어 |
| localhost://3002 | gyeongju-3002 | 동천동 신라숲 | 저가 도미토리 | 25,000/1인 | 4 | 배낭족, 청년 |
| localhost://3003 | gyeongju-3003 | 건천읍 월성 | 농촌 체험 | 55,000 | 4 | 워케이션, 등산객 |
| localhost://3004 | gyeongju-3004 | 안강읍 석굴재 | 농촌 힐링 | 65,000 | 6 | 가족, 시니어 |

### 2.2. 위치 정보 (GPS 좌표 - 지도 UI 테스트 가능하도록 간격 조정)

| listings ID | 주소 | GPS 좌표 (수정) | 주요 명소 거리 |
|------------|------|---------------|-------------|
| gyeongju-3000 | 황오동 일대 | 35.8320, 129.2150 | 황리단길 도보 8분 |
| gyeongju-3001 | 성건동 일대 | 35.8360, 129.2270 | 첨성대 도보 5분 |
| gyeongju-3002 | 동천동 일대 | 35.8550, 129.2100 | 경주역 도보 10분 |
| gyeongju-3003 | 건천읍 일대 | 35.9250, 129.1980 | 경주 남산 차량 20분 |
| gyeongju-3004 | 안강읍 일대 | 35.9500, 129.1850 | 불국사 차량 20분 |

**GPS 좌표 주의사항:**
- 행정구역 중심점 기반이지만, 지도 UI 테스트 가능하도록 간격 조정
- 실제 빈집 확보 시 정확한 좌표로 업데이트 필요
- 출처: Google Maps 검색 (2026-03-16 확인)

### 2.3. 편의시설 & 체험

| listings ID | 주요 설비 | 특별 체험 |
|------------|----------|----------|
| gyeongju-3000 | Wi-Fi, 에어컨, 온돌 난방, 개별 화장실, 간이 주방, 주차 1대 | 황남빵 만들기 (15,000원) |
| gyeongju-3001 | Wi-Fi, 에어컨, 온돌 난방, 공용 화장실, 주차 1대 | 전통 다도 (20,000원), 한복 대여 무료 |
| gyeongju-3002 | Wi-Fi, 에어컨, 공용 샤워실, 공용 주방, 세탁기, 주차 3대 | 자전거 무료 대여, 야간 불멍 파티 |
| gyeongju-3003 | Wi-Fi, 에어컨, 온돌 난방, 개별 화장실, 주방, 작업 책상, 주차 2대 | 텃밭 수확 체험, 전통 장 담그기 |
| gyeongju-3004 | Wi-Fi, 에어컨, 온돌 난방, 개별 화장실, 주방, 바베큐 그릴, 주차 3대 | 계절별 농작물 수확, 시골 밥상 조식 |

---

## 3. TypeScript 코드 예시 (복사 가능)

### 3.1. 인터페이스 (변경 없음)

경주 파일럿 5채는 기존 `Listing` 인터페이스를 그대로 사용합니다. RWA 관련 필드는 추후 토큰화 단계에서 별도로 추가할 예정입니다.

```typescript
// web/app/data/listings.ts

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
  images: string[];
  amenities: string[];
  hostName: string;
  hostImage: string;
  hostBio: string;
  about: string;
  reviews: Review[];
  coordinates: Coordinates;
  nearbyLandmarks: string[];
  transportOptions: TransportOption[];
  pickupPoints: PickupPoint[];
}
```

### 3.2. 경주 5채 데이터 배열

```typescript
const GYEONGJU_PILOT_LISTINGS: Listing[] = [
  // gyeongju-3000: 황오동 청송재
  {
    id: "gyeongju-3000",
    title: "황오동 청송재",
    description: "뉴트로 감성 한옥스테이, 황리단길 도보 8분",
    location: "gyeongju",
    locationLabel: "경주 근처",
    pricePerNight: 70000,
    rating: 4.8,
    maxGuests: 4,
    image: "/images/gyeongju-3000-main.jpg",
    images: [
      "/images/gyeongju-3000-1.jpg",
      "/images/gyeongju-3000-2.jpg",
      "/images/gyeongju-3000-3.jpg"
    ],
    amenities: [
      "Wi-Fi",
      "에어컨",
      "온돌 난방",
      "개별 화장실",
      "간이 주방",
      "주차 1대"
    ],
    hostName: "Rural Rest 경주팀",
    hostImage: "/images/host-gyeongju.jpg",
    hostBio: "경주 빈집 재생 프로젝트로 마을과 함께 운영합니다. 전통과 현대가 공존하는 공간을 만들어갑니다.",
    about: "1960년대 한옥을 리모델링한 뉴트로 감성 숙소입니다. 황리단길까지 도보 8분 거리로 편리하며, 마당에서 황남빵 티타임을 즐기실 수 있습니다. 옥상 테라스에서 경주 구도심의 야경을 감상하세요.\n\n이 한옥은 경주시 폐가정비사업 철거 예정지 인근에 있던 상속 포기 방치 한옥을 Rural Rest가 재생한 공간입니다.",
    reviews: [],
    coordinates: { lat: 35.8320, lng: 129.2150 },
    nearbyLandmarks: [
      "황리단길 카페거리 (도보 8분, 600m)",
      "첨성대 (도보 12분, 900m)",
      "황남빵 본점 (도보 10분, 750m)",
      "대릉원(천마총) (도보 15분, 1.1km)"
    ],
    transportOptions: [
      {
        mode: "train",
        label: "KTX",
        routeName: "서울역 → 신경주역",
        estimatedTime: "약 2시간",
        estimatedCost: "₩49,500",
        description: "KTX로 신경주역까지 직행 이동이 가능합니다."
      },
      {
        mode: "bus",
        label: "시외버스",
        routeName: "서울 고속터미널 → 경주터미널",
        estimatedTime: "약 3시간 30분",
        estimatedCost: "₩25,000",
        description: "고속터미널에서 경주행 버스가 1시간 간격으로 운행합니다."
      },
      {
        mode: "shuttle",
        label: "셔틀 서비스",
        routeName: "신경주역 → 숙소",
        estimatedTime: "약 25분",
        estimatedCost: "무료",
        description: "사전 예약 시 신경주역에서 무료 셔틀을 이용하실 수 있습니다."
      }
    ],
    pickupPoints: [
      {
        id: "p1",
        name: "신경주역 동편 출구",
        description: "역 동편 택시 승강장 옆",
        estimatedTimeToProperty: "약 25분"
      },
      {
        id: "p2",
        name: "경주터미널",
        description: "터미널 정문 앞 셔틀 정류장",
        estimatedTimeToProperty: "약 20분"
      }
    ]
  },
  
  // gyeongju-3001: 성건동 충재댁
  {
    id: "gyeongju-3001",
    title: "성건동 충재댁",
    description: "100년 전통 한옥 체험, 첨성대 도보 5분",
    location: "gyeongju",
    locationLabel: "경주 근처",
    pricePerNight: 90000,
    rating: 4.9,
    maxGuests: 4,
    image: "/images/gyeongju-3001-main.jpg",
    images: [
      "/images/gyeongju-3001-1.jpg",
      "/images/gyeongju-3001-2.jpg",
      "/images/gyeongju-3001-3.jpg"
    ],
    amenities: [
      "Wi-Fi",
      "에어컨",
      "온돌 난방",
      "공용 화장실",
      "주차 1대"
    ],
    hostName: "Rural Rest 경주팀",
    hostImage: "/images/host-gyeongju.jpg",
    hostBio: "경주 빈집 재생 프로젝트로 마을과 함께 운영합니다. 전통과 현대가 공존하는 공간을 만들어갑니다.",
    about: "100년 된 종택을 리모델링한 전통 한옥 숙소입니다. 전통 다도 체험과 한복 대여가 포함되어 있으며, 아침에는 건강한 죽 조식을 제공합니다. 첨성대까지 도보 5분 거리로 경주의 역사를 가까이서 느낄 수 있습니다.",
    reviews: [],
    coordinates: { lat: 35.8360, lng: 129.2270 },
    nearbyLandmarks: [
      "첨성대 (도보 5분, 400m)",
      "대릉원(천마총) (도보 8분, 600m)",
      "경주 중앙시장 (도보 10분, 800m)",
      "황리단길 (도보 12분, 900m)"
    ],
    transportOptions: [
      {
        mode: "train",
        label: "KTX",
        routeName: "서울역 → 신경주역",
        estimatedTime: "약 2시간",
        estimatedCost: "₩49,500",
        description: "KTX로 신경주역까지 직행 이동이 가능합니다."
      },
      {
        mode: "bus",
        label: "시외버스",
        routeName: "서울 고속터미널 → 경주터미널",
        estimatedTime: "약 3시간 30분",
        estimatedCost: "₩25,000",
        description: "고속터미널에서 경주행 버스가 1시간 간격으로 운행합니다."
      },
      {
        mode: "shuttle",
        label: "셔틀 서비스",
        routeName: "신경주역 → 숙소",
        estimatedTime: "약 25분",
        estimatedCost: "무료",
        description: "사전 예약 시 신경주역에서 무료 셔틀을 이용하실 수 있습니다."
      }
    ],
    pickupPoints: [
      {
        id: "p1",
        name: "신경주역 동편 출구",
        description: "역 동편 택시 승강장 옆",
        estimatedTimeToProperty: "약 25분"
      },
      {
        id: "p2",
        name: "경주터미널",
        description: "터미널 정문 앞 셔틀 정류장",
        estimatedTimeToProperty: "약 20분"
      }
    ]
  },
  
  // gyeongju-3002: 동천동 신라숲 (도미토리)
  {
    id: "gyeongju-3002",
    title: "동천동 신라숲",
    description: "저가 도미토리, 경주역 도보 10분",
    location: "gyeongju",
    locationLabel: "경주 근처",
    pricePerNight: 25000,
    rating: 4.7,
    maxGuests: 4,
    image: "/images/gyeongju-3002-main.jpg",
    images: [
      "/images/gyeongju-3002-1.jpg",
      "/images/gyeongju-3002-2.jpg",
      "/images/gyeongju-3002-3.jpg"
    ],
    amenities: [
      "Wi-Fi",
      "에어컨",
      "공용 샤워실",
      "공용 주방",
      "세탁기",
      "주차 3대"
    ],
    hostName: "Rural Rest 경주팀",
    hostImage: "/images/host-gyeongju.jpg",
    hostBio: "경주 빈집 재생 프로젝트로 마을과 함께 운영합니다. 전통과 현대가 공존하는 공간을 만들어갑니다.",
    about: "배낭족과 청년 여행자를 위한 저가 도미토리입니다. 공용 주방과 불멍존, 자전거 무료 대여 등 편의시설이 갖춰져 있으며, 경주역까지 도보 10분 거리로 교통이 편리합니다. 워케이션을 위한 공용 작업 공간도 마련되어 있습니다.",
    reviews: [],
    coordinates: { lat: 35.8550, lng: 129.2100 },
    nearbyLandmarks: [
      "경주역 (도보 10분, 800m)",
      "보문호 (차량 15분, 7km)",
      "경주월드 (차량 20분, 10km)"
    ],
    transportOptions: [
      {
        mode: "train",
        label: "KTX",
        routeName: "서울역 → 신경주역",
        estimatedTime: "약 2시간",
        estimatedCost: "₩49,500",
        description: "KTX로 신경주역까지 직행 이동이 가능합니다."
      },
      {
        mode: "bus",
        label: "시외버스",
        routeName: "서울 고속터미널 → 경주터미널",
        estimatedTime: "약 3시간 30분",
        estimatedCost: "₩25,000",
        description: "고속터미널에서 경주행 버스가 1시간 간격으로 운행합니다."
      },
      {
        mode: "shuttle",
        label: "셔틀 서비스",
        routeName: "경주역 → 숙소",
        estimatedTime: "약 10분",
        estimatedCost: "무료",
        description: "사전 예약 시 경주역에서 무료 셔틀을 이용하실 수 있습니다."
      }
    ],
    pickupPoints: [
      {
        id: "p1",
        name: "경주역 광장",
        description: "경주역 정문 앞 광장",
        estimatedTimeToProperty: "약 10분"
      },
      {
        id: "p2",
        name: "경주터미널",
        description: "터미널 정문 앞 셔틀 정류장",
        estimatedTimeToProperty: "약 15분"
      }
    ]
  },
  
  // gyeongju-3003: 건천읍 월성
  {
    id: "gyeongju-3003",
    title: "건천읍 월성",
    description: "농촌 체험 한옥, 디지털 디톡스",
    location: "gyeongju",
    locationLabel: "경주 근처",
    pricePerNight: 55000,
    rating: 4.8,
    maxGuests: 4,
    image: "/images/gyeongju-3003-main.jpg",
    images: [
      "/images/gyeongju-3003-1.jpg",
      "/images/gyeongju-3003-2.jpg",
      "/images/gyeongju-3003-3.jpg"
    ],
    amenities: [
      "Wi-Fi",
      "에어컨",
      "온돌 난방",
      "개별 화장실",
      "주방",
      "작업 책상",
      "주차 2대"
    ],
    hostName: "Rural Rest 경주팀",
    hostImage: "/images/host-gyeongju.jpg",
    hostBio: "경주 빈집 재생 프로젝트로 마을과 함께 운영합니다. 전통과 현대가 공존하는 공간을 만들어갑니다.",
    about: "농가주택을 리모델링한 농촌 체험 숙소입니다. 작은 텃밭 체험과 워케이션 전용 책상이 마련되어 있어 디지털 노마드에게 적합합니다. 조용한 환경에서 디지털 디톡스를 즐기세요.",
    reviews: [],
    coordinates: { lat: 35.9250, lng: 129.1980 },
    nearbyLandmarks: [
      "경주 남산 (차량 20분, 12km)",
      "불국사 (차량 25분, 15km)"
    ],
    transportOptions: [
      {
        mode: "train",
        label: "KTX",
        routeName: "서울역 → 신경주역",
        estimatedTime: "약 2시간",
        estimatedCost: "₩49,500",
        description: "KTX로 신경주역까지 직행 이동이 가능합니다."
      },
      {
        mode: "bus",
        label: "시외버스",
        routeName: "경주역 → 건천읍",
        estimatedTime: "약 40분",
        estimatedCost: "₩5,000",
        description: "경주역에서 100번 버스로 건천읍까지 이동합니다."
      },
      {
        mode: "shuttle",
        label: "셔틀 서비스",
        routeName: "경주역 → 숙소",
        estimatedTime: "약 35분",
        estimatedCost: "무료",
        description: "사전 예약 시 경주역에서 무료 셔틀을 이용하실 수 있습니다. 렌터카 권장."
      }
    ],
    pickupPoints: [
      {
        id: "p1",
        name: "경주역 광장",
        description: "경주역 정문 앞 광장",
        estimatedTimeToProperty: "약 35분"
      }
    ]
  },
  
  // gyeongju-3004: 안강읍 석굴재
  {
    id: "gyeongju-3004",
    title: "안강읍 석굴재",
    description: "농촌 힐링 숙소, 가족 여행 최적",
    location: "gyeongju",
    locationLabel: "경주 근처",
    pricePerNight: 65000,
    rating: 4.9,
    maxGuests: 6,
    image: "/images/gyeongju-3004-main.jpg",
    images: [
      "/images/gyeongju-3004-1.jpg",
      "/images/gyeongju-3004-2.jpg",
      "/images/gyeongju-3004-3.jpg"
    ],
    amenities: [
      "Wi-Fi",
      "에어컨",
      "온돌 난방",
      "개별 화장실",
      "주방",
      "바베큐 그릴",
      "주차 3대"
    ],
    hostName: "Rural Rest 경주팀",
    hostImage: "/images/host-gyeongju.jpg",
    hostBio: "경주 빈집 재생 프로젝트로 마을과 함께 운영합니다. 전통과 현대가 공존하는 공간을 만들어갑니다.",
    about: "가족 여행객과 시니어를 위한 농촌 힐링 숙소입니다. 계절별 농작물 수확 체험과 시골 밥상 조식, 마당 바베큐를 즐길 수 있습니다. 불국사와 석굴암까지 차량으로 20~30분 거리입니다.",
    reviews: [],
    coordinates: { lat: 35.9500, lng: 129.1850 },
    nearbyLandmarks: [
      "불국사 (차량 20분, 10km)",
      "석굴암 (차량 30분, 18km)"
    ],
    transportOptions: [
      {
        mode: "train",
        label: "KTX",
        routeName: "서울역 → 신경주역",
        estimatedTime: "약 2시간",
        estimatedCost: "₩49,500",
        description: "KTX로 신경주역까지 직행 이동이 가능합니다."
      },
      {
        mode: "bus",
        label: "시외버스",
        routeName: "경주역 → 안강읍",
        estimatedTime: "약 50분",
        estimatedCost: "₩6,000",
        description: "경주역에서 203번 버스로 안강읍까지 이동합니다."
      },
      {
        mode: "shuttle",
        label: "셔틀 서비스",
        routeName: "경주역 → 숙소",
        estimatedTime: "약 45분",
        estimatedCost: "무료",
        description: "사전 예약 시 경주역에서 무료 셔틀을 이용하실 수 있습니다. 렌터카 권장."
      }
    ],
    pickupPoints: [
      {
        id: "p1",
        name: "경주역 광장",
        description: "경주역 정문 앞 광장",
        estimatedTimeToProperty: "약 45분"
      }
    ]
  }
];

export const listings: Listing[] = GYEONGJU_PILOT_LISTINGS;
```

---

## 4. 이미지 전략

### 4.1. 현재 상황
- 실제 이미지 없음 (빈집 현장 답사 전)

### 4.2. 옵션

| 옵션 | 설명 | 장점 | 단점 | 추천 |
|------|------|------|------|------|
| **A. Placeholder 이미지** | 회색 박스 또는 기본 이미지 | 빠른 구현 | UI 테스트 제한적 | ✅ 단기 |
| **B. AI 생성 (Midjourney)** | 경주 한옥 컨셉 AI 생성 | 현실적, 즉시 사용 | 비용, 저작권 | ✅ 중기 |
| **C. 실제 촬영** | 빈집 확보 후 촬영 | 최고 품질 | 시간 소요 (2026년 6월 이후) | ✅ 장기 |

### 4.3. 추천 전략
1. **Phase 1 (현재)**: Placeholder 이미지 사용 (`/images/placeholder-hanok.jpg`)
2. **Phase 2 (2026년 4월)**: AI 생성 이미지 (5채 × 3장 = 15장)
3. **Phase 3 (2026년 7월)**: 실제 촬영 이미지로 교체

---

## 5. 리서치 근거 (상세 내용은 21번 문서 참조)

### 5.1. 가격 근거
- **13_GYEONGJU_PILOT_DATA_RESEARCH.md Section 3**: 경주 한옥 숙박 시세 조사
- 황리단길 한옥: 70,000~90,000원
- 도미토리: 25,000원 (배낭족 타겟)
- 농촌 지역: 55,000~65,000원 (농촌 할인)

### 5.2. 빈집 리서치 근거
- **13_GYEONGJU_PILOT_DATA_RESEARCH.md Section 4**: 폐가정비사업 실제 기록
- 황오동 (2023년), 성건동/동천동/건천읍 (2024년), 안강읍 (2023~2024년)

---

## 6. 다음 단계 (코드 구현 시)

### 6.1. listings.ts 수정
- [ ] `GYEONGJU_PILOT_LISTINGS` 배열 작성 (5채)
- [ ] 기존 `buildDeterministicListings()` 제거
- [ ] `export const listings = GYEONGJU_PILOT_LISTINGS;`

### 6.2. 이미지 준비
- [ ] Placeholder 이미지 추가 (`/public/images/placeholder-hanok.jpg`)
- [ ] 호스트 이미지 추가 (`/public/images/host-gyeongju.jpg`)

### 6.3. DB Schema 업데이트 (선택)
- [ ] 필요 시 `listings` 테이블 스키마 확인

---

## 7. Related Documents

- [13_GYEONGJU_PILOT_DATA_RESEARCH.md](../01_Concept_Design/13_GYEONGJU_PILOT_DATA_RESEARCH.md) - 시장 조사 및 리서치 근거
- `web/app/data/listings.ts` - 실제 코드 파일

