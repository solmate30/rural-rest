# 06. Search Results Page Implementation Guide
> Created: 2026-02-08 21:50
> Last Updated: 2026-02-08 21:50

본 문서는 Task 2.6 (Search Results Page) 구현을 위한 코드 수준 상세 가이드이다.

## 1. Overview

### 1.1. 구현 범위 (MVP)

| 항목 | 결정 |
|:---|:---|
| 데이터 소스 | Mock data (`app/data/listings.ts`) -- 홈과 동일 |
| 뷰 모드 | Grid List only -- Map View는 Task 2.9에서 지도 API 도입 시 추가 |
| 필터 | Location Badge + Price Slider -- 홈 Smart Search와 동일 |
| 페이지네이션 | Load More 버튼 (초기 12건, 추가 12건씩) |
| 정렬 | 기본 정렬만 (추후 확장 대비 구조는 마련) |

### 1.2. 사용자 흐름

```
[Home Page]                          [Search Results Page]
  Smart Search Bar                      /search?location=X&maxPrice=Y
  - Location Badge 선택        --->     - 동일 필터 UI (값 유지)
  - Price Slider 조절                   - Grid 목록 (페이지네이션)
  - "숙소 찾기" 버튼 클릭               - Empty State
                                        - "Details" -> /property/:id
```

## 2. 라우트 설정

### 2.1. 라우트 등록 (`app/routes.ts`)

```typescript
// 기존 라우트 목록에 추가
route("search", "routes/search.tsx"),
```

### 2.2. Home 페이지 연동 (`app/routes/home.tsx`)

"숙소 찾기" 버튼 클릭 시 현재 필터 상태를 URL 파라미터로 전달하여 `/search`로 이동한다.

```typescript
// 기존 Button을 useNavigate 또는 Link로 교체
import { useNavigate } from "react-router";

// Home 컴포넌트 내부
const navigate = useNavigate();

function handleSearch() {
  const params = new URLSearchParams();
  if (selectedLocation) {
    params.set("location", selectedLocation);
  }
  params.set("maxPrice", String(maxPrice));
  navigate(`/search?${params.toString()}`);
}

// JSX
<Button onClick={handleSearch} className="...">
  숙소 찾기
</Button>
```

## 3. Loader 구현

### 3.1. 데이터 흐름

```
URL Query Params --> Loader --> 필터링 --> 전체 결과 반환 --> 클라이언트 페이지네이션
```

MVP에서는 mock data 전체를 필터링하여 반환한다. 데이터 규모가 작으므로(50건) 서버 측 페이지네이션은 불필요하며, 클라이언트에서 Load More로 노출 범위만 제어한다.

### 3.2. Loader 코드

```typescript
import type { Route } from "./+types/search";
import { mockListings } from "~/data/listings";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const location = url.searchParams.get("location");
  const maxPrice = Number(url.searchParams.get("maxPrice")) || 500000;

  const filtered = mockListings.filter((listing) => {
    const matchesLocation = !location || listing.location === location;
    const matchesPrice = listing.pricePerNight <= maxPrice;
    return matchesLocation && matchesPrice;
  });

  return {
    listings: filtered,
    totalCount: filtered.length,
    filters: { location, maxPrice },
  };
}
```

**향후 DB 연동 시**: `mockListings.filter(...)` 부분을 Drizzle ORM 쿼리로 교체한다. Loader 반환 타입은 동일하게 유지하여 컴포넌트 수정을 최소화한다.

```typescript
// DB 연동 예시 (추후 적용)
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { and, eq, lte } from "drizzle-orm";

const filtered = await db
  .select()
  .from(listings)
  .where(
    and(
      location ? eq(listings.location, location) : undefined,
      lte(listings.pricePerNight, maxPrice)
    )
  );
```

## 4. 페이지 컴포넌트

### 4.1. 전체 구조

```
search.tsx
  ├── Header
  ├── Filter Bar (Location Badges + Price Slider)
  │     └── 필터 변경 시 URL params 업데이트 + loader 재호출
  ├── Results Summary ("N곳의 숙소를 찾았어요")
  ├── Listing Grid (4열 반응형)
  │     └── Listing Card (홈과 동일 카드 디자인)
  ├── Load More Button
  ├── Empty State (결과 없을 때)
  └── Footer
```

### 4.2. 컴포넌트 코드

```typescript
import { Header, Button, Card, Badge, Slider, Footer } from "~/components/ui-mockup";
import { useState, useMemo } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/search";

const ITEMS_PER_PAGE = 12;

const locations = [
  { name: "서울 근처", value: "seoul-suburbs" },
  { name: "부산 근처", value: "busan-suburbs" },
  { name: "경주 근처", value: "gyeongju" },
  { name: "인천 근처", value: "incheon" },
  { name: "제주도", value: "jeju" },
];

export default function SearchResults() {
  const { listings, totalCount, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // 필터 상태: URL params에서 초기화
  const [selectedLocation, setSelectedLocation] = useState<string | null>(
    filters.location
  );
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);

  // 페이지네이션 상태
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const visibleListings = useMemo(
    () => listings.slice(0, visibleCount),
    [listings, visibleCount]
  );
  const hasMore = visibleCount < listings.length;

  // 필터 변경 핸들러: URL params 업데이트 -> loader 재호출
  function applyFilters(location: string | null, price: number) {
    const params = new URLSearchParams();
    if (location) params.set("location", location);
    params.set("maxPrice", String(price));
    setSearchParams(params);
    setVisibleCount(ITEMS_PER_PAGE); // 페이지네이션 초기화
  }

  function handleLocationChange(value: string) {
    const newLocation = selectedLocation === value ? null : value;
    setSelectedLocation(newLocation);
    applyFilters(newLocation, maxPrice);
  }

  function handlePriceChange(value: number) {
    setMaxPrice(value);
    applyFilters(selectedLocation, value);
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="container mx-auto px-4 sm:px-8 py-8">
        {/* Filter Bar */}
        {/* Results Summary */}
        {/* Listing Grid */}
        {/* Load More */}
        {/* Empty State */}
      </main>
      <Footer />
    </div>
  );
}
```

### 4.3. Filter Bar

```tsx
{/* Filter Bar */}
<section className="mb-8 p-6 bg-white/95 backdrop-blur rounded-3xl shadow-lg border border-stone-100">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Location Badges */}
    <div className="space-y-3">
      <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">
        Where to?
      </label>
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <Badge
            key={loc.value}
            variant={selectedLocation === loc.value ? "default" : "outline"}
            className="py-1.5 px-4 text-[13px] border-stone-200 transition-all active:scale-95 cursor-pointer"
            onClick={() => handleLocationChange(loc.value)}
          >
            {loc.name}
          </Badge>
        ))}
      </div>
    </div>

    {/* Price Slider */}
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">
          Max Budget
        </label>
        <span className="text-sm font-bold text-primary">
          ₩{maxPrice.toLocaleString()} 미만
        </span>
      </div>
      <Slider
        min={50000}
        max={500000}
        value={maxPrice}
        onChange={handlePriceChange}
      />
      <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
        <span>₩5만</span>
        <span>₩50만+</span>
      </div>
    </div>
  </div>
</section>
```

### 4.4. Results Summary + Listing Grid

```tsx
{/* Results Summary */}
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold tracking-tight">
    {selectedLocation
      ? locations.find((l) => l.value === selectedLocation)?.name
      : "전체 지역"}
  </h1>
  <span className="text-sm text-stone-500 font-medium">
    {totalCount}곳의 숙소를 찾았어요
  </span>
</div>

{/* Listing Grid */}
{listings.length > 0 ? (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {visibleListings.map((listing) => (
        <Card
          key={listing.id}
          className="overflow-hidden group cursor-pointer border-none shadow-lg"
          onClick={() => navigate(`/property/${listing.id}`)}
        >
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={listing.image}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              alt={listing.title}
            />
          </div>
          <div className="p-6 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-primary tracking-widest uppercase">
                {listing.locationLabel}
              </span>
              <span className="text-sm font-medium">★ {listing.rating}</span>
            </div>
            <h3 className="text-xl font-bold mb-2">{listing.title}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
              {listing.description}
            </p>
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-lg font-bold">
                ₩{listing.pricePerNight.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / night
                </span>
              </span>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/property/${listing.id}`);
                }}
              >
                Details
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>

    {/* Load More */}
    {hasMore && (
      <div className="flex justify-center mt-12">
        <Button
          variant="outline"
          className="px-10 h-12 rounded-full"
          onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
        >
          더 보기 ({listings.length - visibleCount}곳 남음)
        </Button>
      </div>
    )}
  </>
) : (
  /* Empty State -- Section 4.5 참조 */
)}
```

### 4.5. Empty State

```tsx
<div className="py-24 text-center">
  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-stone-50 mb-6">
    <svg className="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
  <h3 className="text-xl font-bold text-stone-900 mb-2">
    조건에 맞는 숙소가 없어요
  </h3>
  <p className="text-stone-500 max-w-xs mx-auto">
    지역이나 예산을 바꿔 가며 당신만의 휴식처를 찾아보세요.
  </p>
  <Button
    variant="outline"
    className="mt-8"
    onClick={() => {
      setSelectedLocation(null);
      setMaxPrice(500000);
      applyFilters(null, 500000);
    }}
  >
    필터 초기화
  </Button>
</div>
```

## 5. 필터 동작 상세

### 5.1. URL 파라미터 스펙

| 파라미터 | 타입 | 기본값 | 설명 |
|:---|:---|:---|:---|
| `location` | string (optional) | null (전체) | 거점 값: `seoul-suburbs`, `busan-suburbs`, `gyeongju`, `incheon`, `jeju` |
| `maxPrice` | number | 500000 | 1박 최대 예산 (KRW) |

### 5.2. 필터 변경 시 동작

1. 사용자가 Badge 또는 Slider를 조작한다
2. `setSearchParams()`로 URL query params가 업데이트된다
3. React Router가 자동으로 loader를 재호출한다
4. 새 데이터로 목록이 갱신되고, `visibleCount`가 초기화된다

### 5.3. Home -> Search 연속성

홈에서 "숙소 찾기" 클릭 시 전달된 `location`/`maxPrice` 값이 Search 페이지의 필터 UI에 그대로 반영된다. 사용자는 선택을 이어서 조정할 수 있다.

## 6. 디자인 가이드

### 6.1. DESIGN.md 준수 사항

| 항목 | 값 |
|:---|:---|
| 배경색 | `bg-background` (Warm Beige `#fcfaf7`) |
| 텍스트 | `text-foreground` (Deep Wood `#4a3b2c`) |
| 카드 | `rounded-3xl`, `shadow-lg`, `border-none` |
| 필터바 | `rounded-3xl`, `bg-white/95 backdrop-blur`, `shadow-lg` |
| Badge (선택) | `variant="default"` (Primary Green) |
| Badge (미선택) | `variant="outline"`, `border-stone-200` |
| Load More 버튼 | `rounded-full`, `variant="outline"` |

### 6.2. 반응형 그리드

| 화면 | 열 수 | 비고 |
|:---|:---|:---|
| Mobile (< 768px) | 1열 | `grid-cols-1` |
| Tablet (768px+) | 2열 | `md:grid-cols-2` |
| Desktop (1024px+) | 3열 | `lg:grid-cols-3` |
| Wide (1280px+) | 4열 | `xl:grid-cols-4` |

## 7. 파일 구조 요약

```
rural-rest-v2/
  app/
    routes/
      search.tsx       # [신규] Search Results 라우트 (loader + component)
      home.tsx          # [수정] "숙소 찾기" 버튼에 navigate 연결
    routes.ts           # [수정] /search 라우트 등록
    data/
      listings.ts       # [기존] mockListings 재사용 (변경 없음)
```

## 8. 향후 확장 포인트

본 가이드는 MVP 구현에 집중한다. 아래 항목은 추후 별도 태스크로 진행한다.

| 항목 | 관련 태스크 | 변경 범위 |
|:---|:---|:---|
| Map View (List/Map 토글) | Task 2.9 | 카카오/네이버 맵 API 연동, MapView 컴포넌트 추가 |
| 정렬 (인기순/가격순/평점순) | Backlog | Loader에 `sortBy` 파라미터 추가, 정렬 드롭다운 UI |
| 날짜/인원 필터 | Backlog | Loader에 `checkIn`/`checkOut`/`guests` 파라미터 추가 |
| Room Type/Experience 필터 | Backlog | DB 스키마에 `roomType` 필드 추가 필요 |
| DB 연동 | Backlog | Loader의 mock 필터링을 Drizzle 쿼리로 교체 (Section 3.2 참조) |
| 서버 측 페이지네이션 | Backlog | 데이터 증가 시 `LIMIT`/`OFFSET` 또는 커서 기반 |

## 9. Related Documents
- **Prototype**: [Search & Explore Review](../02_Prototype/04_SEARCH_EXPLORE_REVIEW.md) - 검색 결과 화면 프로토타입 및 UI 피드백
- **Specs**: [API Specs](./02_API_SPECS.md) Section 3.2 - `/search` 라우트 엔드포인트 명세
- **Logic**: [Search Algorithm](../04_Logic/02_SEARCH_ALGORITHM.md) - 검색 필터링/정렬/페이지네이션 알고리즘 설계
- **Logic**: [Search & Filter Logic](../04_Logic/07_SEARCH_AND_FILTER_LOGIC.md) - Smart Search 인터페이스 사양 및 상태 관리
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) Section 3.A.2 - 사이트맵 내 Search Results 정의
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 토큰 및 컴포넌트 가이드라인
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 게스트 검색 시나리오
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) Section 3.1 - 검색 테스트 케이스 (TC-G-001~005)
- **Test**: [Footer & Search Review](../05_Test/03_FOOTER_AND_SEARCH_REVIEW.md) Section 3.2 - 미해결 이슈 (버튼 연결, 지역별 카운트)
