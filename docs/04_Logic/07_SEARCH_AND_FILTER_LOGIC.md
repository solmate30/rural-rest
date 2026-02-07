# Search and Filter Logic (Smart Search)
> Created: 2026-02-08 02:25
> Last Updated: 2026-02-08 12:00

본 문서는 Rural Rest 서비스의 핵심 기능인 **'스마트 검색 바(Smart Search Bar)'**의 작동 원리와 **홈 Featured Stays 실시간 필터링** 로직을 정의합니다. 사용자 시나리오(민수)의 "서울 근처 조용한 휴식처 찾기" 경험을 기술적으로 뒷받침합니다.

## 1. 개요 (Overview)
Rural Rest의 검색 시스템은 전통적인 키워드 검색 방식 대신, 사용자의 **거점 도시(Location Hub)**와 **예산(Price Range)**을 중심으로 한 직관적인 탐색 경험을 제공합니다.

## 2. 검색 인터페이스 (Search Interface)
첫 화면(Home)의 Hero 섹션 내에 배치된 스마트 검색 카드는 다음 두 가지 핵심 요소를 가집니다.

### 2.1. 거점 뱃지 (Location Badges)
홈 화면의 Hero 섹션에서 사용자가 가장 먼저 마주하는 지역 선택 인터페이스입니다.
*   **컴포넌트**: `Badge` (from ui-mockup)
*   **목록**: 서울 근처, 부산 근처, 경주 근처, 인천 근처, 제주도
*   **동작**: 뱃지 클릭 시 `selectedLocation` 상태를 업데이트하며, 선택된 뱃지는 Primary 컬러로 강조됩니다. 다시 클릭 시 선택이 해제됩니다.
*   **디자인 철학**: 복잡한 지도보다 명확한 텍스트 뱃지를 통해 빠른 의사결정을 유도하고, 감성적인 배경 이미지를 방해하지 않도록 합니다.

### 2.2. 예산 필터 (Price Range Slider)
숙박 가격대를 직관적으로 조절할 수 있는 슬라이더 인터페이스입니다.
*   **범위**: ₩50,000 ~ ₩500,000+
*   **기본값**: ₩300,000
*   **표시**: 슬라이더 조절 시 상단에 "₩N 미만" 형식으로 실시간 피드백을 제공합니다.

### 2.3. View Mode Consideration
*   **Home Page**: 브랜드 감성과 명확한 탐색을 위해 **뱃지(Badge) UI**를 고수합니다.
*   **Detail Page**: 정확한 지리 정보와 교통 연동을 위해 **상용 지도 API(Kakao/Naver Map)** 도입을 계획합니다.
*   **참조**: [Future Roadmap Memo](./09_FUTURE_ROADMAP_MEMO.md).

---

## 3. 구현 사양 (Technical Specifications)

### 3.1. 상태 관리 (Client-side State)
`Home` 라우트(`app/routes/home.tsx`)에서 React의 `useState`를 통해 검색 조건을 관리합니다.
```typescript
const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
const [maxPrice, setMaxPrice] = useState(300000);
```

### 3.2. URL Query String 연동 (Proposed)
'숙소 찾기' 버튼 클릭 시, 선택된 상태값은 URL 파라미터로 변환되어 검색 페이지(`/search` 또는 `/property`)로 전달됩니다.
*   **형식**: `/?location={value}&maxPrice={number}`
*   **예시**: `/?location=seoul-suburbs&maxPrice=250000`

### 3.3. 데이터 필터링 로직 (Server-side Preview)
추후 숙소 목록 조회 API에서 다음과 같은 SQL 조건문이 적용됩니다 (Drizzle ORM 기준).
```typescript
// SQL 로직 예시
where(
  and(
    selectedLocation ? eq(listings.location, selectedLocation) : undefined,
    lte(listings.pricePerNight, maxPrice)
  )
)
```

### 3.4. 홈 Featured Stays 실시간 필터링 (Client-side)
홈 화면의 **Featured Stays** 섹션은 스마트 검색 바의 선택 상태에 따라 **같은 페이지에서 즉시** 필터링됩니다. 별도 검색 결과 페이지로 이동하지 않습니다.

*   **데이터 소스**: Landing Page Loader(`/`)에서 반환한 목록(기본 약 50건). 각 항목은 `location`(거점 값), `pricePerNight`(1박 가격) 필드를 가짐.
*   **필터 규칙**:
    1.  **지역**: `selectedLocation === null`이면 지역 필터 미적용(전체). 값이 있으면 `listing.location === selectedLocation`인 카드만 표시.
    2.  **가격**: `listing.pricePerNight <= maxPrice`인 카드만 표시.
    3.  **둘 다 적용**: 위 두 조건을 AND로 결합한 결과만 표시.
*   **표시 개수**: 필터 적용 후 남은 카드 수가 N개이면, 스마트 검색 카드 하단 문구는 **"현재 N곳의 빈집이 기다리고 있어요"**로 갱신.
*   **Empty State**: 필터 결과가 0건일 때는 "조건에 맞는 숙소가 없어요. 지역이나 예산을 바꿔 보세요." 등 안내 문구 표시.
*   **구현 위치**: `Home` 라우트에서 loader로 받은 목록을 `useMemo` 또는 동일 상태 기반으로 `selectedLocation`, `maxPrice`에 따라 필터링한 뒤 카드 목록으로 렌더.

---

## 4. 디자인 시스템 가이드 (UI/UX)
*   **컴포넌트**: `RuralMap` (SVG Interactive), `Slider`, `Card`
*   **심미성**: 
    *   **Map Visualization**: 추상화된 한국 지도 SVG를 사용하여 브랜드 정체성 강화.
    *   **Glassmorphism**: 검색 카드 전체에 `bg-white/95 backdrop-blur shadow-2xl` 적용.
    *   **Micro-interaction**: 지도 포인트 Hover 시 `scale-125` 및 툴팁 제공, 클릭 시 `Primary` 색상으로 채우기 애니메이션.
    *   **Real-time Feedback**: "현재 N곳의 빈집이 기다리고 있어요" 문구는 **필터 적용 후 결과 개수(N)**로 갱신 (Section 3.4 참조).

---

## 5. 관련 문서 (Related Documents)
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 민수의 검색 시나리오
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - Home Featured Stays 실시간 필터 (Section 5.4)
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Landing Page Loader 및 검색 쿼리 파라미터 (Section 3.1, 3.2)
- **Prototype**: [Home Page Implementation](../../rural-rest-v2/app/routes/home.tsx) - 실제 구현 코드
- **Logic**: [Search Algorithm](./02_SEARCH_ALGORITHM.md) - 상세 검색 필터링 알고리즘
- **Logic**: [Future Roadmap Memo](./09_FUTURE_ROADMAP_MEMO.md) - 아이디어 기록장
