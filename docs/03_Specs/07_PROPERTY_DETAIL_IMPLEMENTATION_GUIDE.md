# 07. Property Detail Page Implementation Guide
> Created: 2026-02-08 22:10
> Last Updated: 2026-02-08 22:10

본 문서는 Property Detail Page 및 Listing Details Loader 구현을 위한 코드 수준 상세 가이드이다.

## 1. Overview

### 1.1. 구현 범위 (MVP)

| 항목 | 결정 |
|:---|:---|
| 데이터 소스 | Mock data 확장 (`app/data/listings.ts`) |
| 섹션 | Gallery Grid + About + Amenities + Host Info + Reviews(목 데이터) + Booking Card(Sticky) |
| Gallery | Modal 구현 (Masonry 레이아웃, "모든 사진 보기" 버튼) |
| Booking Card | `/book/:id`로 네비게이션 (로그인 체크 없이 이동) |
| 지도 | 미포함 -- Task 2.9 (카카오/네이버 맵 API)에서 추가 |

### 1.2. 사용자 흐름

```
[Search Results]                     [Property Detail]                 [Booking]
  Listing Card                         /property/:id                    /book/:id
  - "Details" 클릭       --->    - Gallery Grid (+ Modal)     --->   - 예약 플로우
                                 - About This Home
                                 - Amenities
                                 - Host Info
                                 - Reviews
                                 - Booking Card (Sticky)
                                   "Reserve Now" 클릭
```

## 2. Mock Data 확장

### 2.1. 인터페이스 확장 (`app/data/listings.ts`)

기존 `Listing` 인터페이스를 확장하여 상세 페이지에 필요한 필드를 추가한다.

```typescript
export interface Listing {
  id: string;
  title: string;
  description: string;
  location: string;
  locationLabel: string;
  pricePerNight: number;
  rating: number;
  image: string;        // 대표 이미지 (기존: 목록용)
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

export interface Review {
  id: string;
  authorName: string;
  authorImage: string;
  rating: number;
  comment: string;
  date: string;         // ISO date string
}
```

### 2.2. 수동 5건에 리치 데이터 부여

기존 수동 5건(`id: "1"~"5"`)에 상세 필드를 추가한다. 나머지 자동 생성 45건은 기본값으로 채운다.

```typescript
// 수동 5건 예시 (id: "1")
{
  id: "1",
  title: "성주 할머니댁 돌담집",
  description: "할머니의 정취가 느껴지는 고즈넉한 돌담집입니다.",
  location: "gyeongju",
  locationLabel: "경주 근처",
  pricePerNight: 120000,
  rating: 4.9,
  image: "/house.png",
  maxGuests: 4,
  // 확장 필드
  images: ["/house.png", "/house.png", "/house.png", "/house.png", "/house.png"],
  amenities: ["WiFi", "주차장", "BBQ 그릴", "마당", "온돌 난방", "세탁기"],
  hostName: "김순자",
  hostImage: "/host-avatar.png",
  hostBio: "남해에서 30년째 살고 있는 순자입니다. 할머니 댁을 정성스럽게 가꿔왔어요.",
  about: "고즈넉한 돌담 사이로 불어오는 바람...(상세 텍스트)",
  reviews: [
    {
      id: "r1",
      authorName: "민수",
      authorImage: "/user-avatar.png",
      rating: 5,
      comment: "정말 편안하게 쉬다 왔습니다. 할머니가 직접 만들어주신 유자차가 잊을 수 없어요.",
      date: "2026-01-15"
    },
    // ...2~3건 더
  ]
}
```

### 2.3. 자동 생성 목록 기본값

`buildDeterministicListings` 함수에 기본 확장 필드를 추가한다.

```typescript
// 기본값
images: ["/house.png", "/house.png", "/house.png"],
amenities: ["WiFi", "주차장", "온돌 난방"],
hostName: `호스트 ${id}`,
hostImage: "/host-avatar.png",
hostBio: "시골의 정취를 전하는 호스트입니다.",
about: description, // description 재사용
reviews: [],
```

### 2.4. ID 기반 조회 함수

```typescript
export async function getListingById(id: string): Promise<Listing | null> {
  return Promise.resolve(mockListings.find((l) => l.id === id) ?? null);
}
```

## 3. Loader 구현

### 3.1. 라우트 파라미터

`/property/:id` 라우트는 이미 `routes.ts`에 등록되어 있다 (line 6).

### 3.2. Loader 코드 (`app/routes/property.tsx`)

```typescript
import type { Route } from "./+types/property";
import { getListingById } from "~/data/listings";

export async function loader({ params }: Route.LoaderArgs) {
  const listing = await getListingById(params.id);

  if (!listing) {
    throw new Response("Not Found", { status: 404 });
  }

  return { listing };
}
```

**향후 DB 연동 시**: `getListingById`를 Drizzle 쿼리로 교체한다.

```typescript
// DB 연동 예시 (추후)
const listing = await db.query.listings.findFirst({
  where: eq(listings.id, params.id),
});
const reviews = await db.query.reviews.findMany({
  where: eq(reviews.listingId, params.id),
});
const host = await db.query.user.findFirst({
  where: eq(user.id, listing.hostId),
});
```

## 4. 페이지 컴포넌트

### 4.1. 전체 구조

```
property.tsx
  ├── Header
  ├── Gallery Grid (3+1 레이아웃, "+N View all" 클릭 시 Modal)
  ├── Content (2열 레이아웃)
  │     ├── Left (lg:col-span-2)
  │     │     ├── Title + Location Badge
  │     │     ├── About This Home
  │     │     ├── Amenities Grid
  │     │     ├── Host Info Card
  │     │     └── Reviews Section
  │     └── Right (lg:col-span-1)
  │           └── Booking Card (Sticky)
  ├── Gallery Modal (전체 화면 오버레이)
  └── Footer
```

### 4.2. Gallery Grid

현재 프로토타입의 3+1 레이아웃을 유지하되, 동적 이미지 배열을 사용한다.

```tsx
const [showGallery, setShowGallery] = useState(false);

{/* Gallery Grid */}
<div className="grid grid-cols-4 gap-4 h-[400px]">
  <div className="col-span-3 rounded-2xl overflow-hidden shadow-lg">
    <img
      src={listing.images[0] || listing.image}
      className="w-full h-full object-cover cursor-pointer"
      alt={listing.title}
      onClick={() => setShowGallery(true)}
    />
  </div>
  <div className="grid grid-rows-2 gap-4">
    <div className="rounded-2xl overflow-hidden shadow-md">
      <img
        src={listing.images[1] || listing.image}
        className="w-full h-full object-cover cursor-pointer"
        alt={`${listing.title} 2`}
        onClick={() => setShowGallery(true)}
      />
    </div>
    <button
      className="rounded-2xl overflow-hidden shadow-md bg-stone-100 flex items-center justify-center font-bold text-muted-foreground hover:bg-stone-200 transition-colors"
      onClick={() => setShowGallery(true)}
    >
      +{listing.images.length - 2} View all
    </button>
  </div>
</div>
```

### 4.3. Gallery Modal

전체 화면 오버레이로 모든 이미지를 Masonry 스타일로 표시한다.

```tsx
{/* Gallery Modal */}
{showGallery && (
  <div className="fixed inset-0 z-50 bg-black/90 overflow-y-auto">
    <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-black/50 backdrop-blur">
      <h2 className="text-white text-lg font-bold">
        {listing.title} - All Photos ({listing.images.length})
      </h2>
      <Button
        variant="ghost"
        className="text-white hover:bg-white/20"
        onClick={() => setShowGallery(false)}
      >
        Close
      </Button>
    </div>
    <div className="max-w-5xl mx-auto px-4 py-8 columns-2 md:columns-3 gap-4 space-y-4">
      {listing.images.map((img, i) => (
        <img
          key={i}
          src={img}
          className="w-full rounded-xl break-inside-avoid"
          alt={`${listing.title} ${i + 1}`}
        />
      ))}
    </div>
  </div>
)}
```

### 4.4. About This Home

```tsx
<section className="space-y-4">
  <h2 className="text-2xl font-bold text-foreground">About This Home</h2>
  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
    {listing.about || listing.description}
  </p>
</section>
```

### 4.5. Amenities Grid

아이콘 없이 텍스트 뱃지로 표시한다 (MVP). 향후 아이콘 매핑 추가 가능.

```tsx
<section className="space-y-4">
  <h2 className="text-2xl font-bold text-foreground">Amenities</h2>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {listing.amenities.map((amenity) => (
      <div
        key={amenity}
        className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 text-sm font-medium"
      >
        <span className="h-2 w-2 rounded-full bg-primary" />
        {amenity}
      </div>
    ))}
  </div>
</section>
```

### 4.6. Host Info

```tsx
<section className="space-y-4">
  <h2 className="text-2xl font-bold text-foreground">Your Host</h2>
  <div className="flex items-start gap-4 p-6 rounded-2xl bg-stone-50">
    <img
      src={listing.hostImage}
      className="h-16 w-16 rounded-full object-cover"
      alt={listing.hostName}
    />
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold">{listing.hostName}</h3>
        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
          Superhost
        </span>
      </div>
      <p className="text-muted-foreground text-sm">{listing.hostBio}</p>
    </div>
  </div>
</section>
```

### 4.7. Reviews Section

```tsx
<section className="space-y-4">
  <div className="flex items-center gap-2">
    <h2 className="text-2xl font-bold text-foreground">Reviews</h2>
    <span className="text-sm text-muted-foreground">
      ({listing.reviews.length})
    </span>
  </div>
  {listing.reviews.length > 0 ? (
    <div className="space-y-4">
      {listing.reviews.map((review) => (
        <div key={review.id} className="p-4 rounded-xl bg-stone-50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={review.authorImage}
                className="h-10 w-10 rounded-full object-cover"
                alt={review.authorName}
              />
              <div>
                <span className="font-bold text-sm">{review.authorName}</span>
                <div className="text-xs text-muted-foreground">{review.date}</div>
              </div>
            </div>
            <span className="text-sm font-medium">
              {"★".repeat(review.rating)}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{review.comment}</p>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-muted-foreground text-sm py-4">
      아직 리뷰가 없습니다. 첫 번째 게스트가 되어보세요.
    </p>
  )}
</section>
```

### 4.8. Booking Card (Sticky)

프로토타입의 Booking Card를 동적 데이터로 교체한다.

```tsx
const navigate = useNavigate();
const nights = 3; // MVP 고정값. 향후 날짜 선택으로 교체

<Card className="p-8 sticky top-24 shadow-xl border-none">
  <div className="flex items-baseline justify-between mb-6">
    <span className="text-2xl font-bold">
      ₩{listing.pricePerNight.toLocaleString()}
    </span>
    <span className="text-muted-foreground">/ night</span>
  </div>

  <div className="space-y-4 mb-8">
    <div className="grid grid-cols-2 gap-0 border rounded-xl overflow-hidden">
      <div className="p-3 border-r border-b">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">
          Check-in
        </label>
        <div className="text-sm">Select date</div>
      </div>
      <div className="p-3 border-b">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">
          Check-out
        </label>
        <div className="text-sm">Select date</div>
      </div>
      <div className="p-3 col-span-2">
        <label className="text-[10px] uppercase font-bold text-muted-foreground">
          Guests
        </label>
        <div className="text-sm">
          Max {listing.maxGuests} guests
        </div>
      </div>
    </div>

    <Button
      className="w-full h-12 text-lg"
      onClick={() => navigate(`/book/${listing.id}`)}
    >
      Reserve Now
    </Button>
    <p className="text-center text-xs text-muted-foreground">
      No charge until host approval
    </p>
  </div>

  <div className="space-y-3 pt-6 border-t font-medium text-sm">
    <div className="flex justify-between">
      <span>₩{listing.pricePerNight.toLocaleString()} x {nights} nights</span>
      <span>₩{(listing.pricePerNight * nights).toLocaleString()}</span>
    </div>
    <div className="flex justify-between">
      <span>Transport Concierge</span>
      <span className="text-primary">Included</span>
    </div>
    <div className="flex justify-between border-t pt-3 text-lg font-bold">
      <span>Total</span>
      <span>₩{(listing.pricePerNight * nights).toLocaleString()}</span>
    </div>
  </div>
</Card>
```

## 5. 디자인 가이드

### 5.1. DESIGN.md 준수 사항

| 항목 | 값 |
|:---|:---|
| 배경색 | `bg-background` (Warm Beige `#fcfaf7`) |
| 텍스트 | `text-foreground` (Deep Wood `#4a3b2c`) |
| Gallery 이미지 | `rounded-2xl`, `shadow-lg` / `shadow-md` |
| Card (Booking) | `shadow-xl`, `border-none`, `sticky top-24` |
| Amenity 아이템 | `rounded-xl`, `bg-stone-50` |
| Host Card | `rounded-2xl`, `bg-stone-50` |
| Review 아이템 | `rounded-xl`, `bg-stone-50` |
| Modal 배경 | `bg-black/90`, `backdrop-blur` |
| Badge (Heritage Stay) | `bg-primary/10 text-primary rounded-full` |

### 5.2. 반응형 레이아웃

| 화면 | 레이아웃 |
|:---|:---|
| Mobile (< 1024px) | 단일 열 -- Gallery 위, Booking Card 아래 |
| Desktop (1024px+) | 3열 그리드 -- 좌측 2열 (콘텐츠) + 우측 1열 (Booking Card sticky) |

Gallery Grid:
| 화면 | 레이아웃 |
|:---|:---|
| Mobile (< 768px) | 단일 이미지 + "View all" 버튼 (2행 불필요) |
| Desktop (768px+) | 3+1 그리드 (현재 프로토타입 구조) |

## 6. 파일 구조 요약

```
web/
  app/
    routes/
      property.tsx     # [수정] loader 추가 + 동적 데이터 컴포넌트로 교체
    data/
      listings.ts      # [수정] Listing/Review 인터페이스 확장 + getListingById 추가
```

## 7. 향후 확장 포인트

| 항목 | 관련 태스크 | 변경 범위 |
|:---|:---|:---|
| 날짜 선택 | Booking Flow | Booking Card에 DatePicker 추가, nights 동적 계산 |
| 인원 선택 | Booking Flow | Guests 드롭다운, maxGuests 검증 |
| 지도 섹션 | Task 2.9 | Kakao/Naver Map API, 위치 핀, 교통 정보 |
| Activities 섹션 | Backlog | activities 테이블 연동, 추가 체험 목록 |
| Village Story | Backlog | 빈집 재생 스토리 콘텐츠 |
| DB 연동 | Backlog | Loader의 mock 조회를 Drizzle 쿼리로 교체 (Section 3.2 참조) |
| 리뷰 작성 | Backlog | 로그인 사용자의 리뷰 등록 action |

## 8. Related Documents
- **Prototype**: [Property Detail Review](../02_Prototype/01_DETAIL_PAGE_REVIEW.md) - 상세 페이지 프로토타입 및 UI 피드백
- **Specs**: [API Specs](./02_API_SPECS.md) Section 3.3 - `/rooms/:id` 라우트 명세 (`Listing + Host + Reviews` 반환)
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - `listings`, `reviews`, `activities` 테이블 구조
- **Specs**: [Cloudinary Implementation Guide](./05_CLOUDINARY_IMPLEMENTATION_GUIDE.md) - 이미지 URL 저장/관리
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) Section 3.A.3 - Property Detail 사이트맵
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) Step 2 - Village Story 몰입 시나리오
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 토큰 및 컴포넌트 가이드라인
- **Logic**: [Future Roadmap Memo](../04_Logic/09_FUTURE_ROADMAP_MEMO.md) Section 2 - 카카오맵 연동 계획
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 상태 전환 (Reserve -> Pending)
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) - Property Detail 관련 테스트 케이스
