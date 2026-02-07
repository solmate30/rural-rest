# Search and Filter Logic (Smart Search)
> Created: 2026-02-08 02:25
> Last Updated: 2026-02-08 02:25

본 문서는 Rural Rest 서비스의 핵심 기능인 **'스마트 검색 바(Smart Search Bar)'**의 작동 원리와 필터링 로직을 정의합니다. 사용자 시나리오(민수)의 "서울 근처 조용한 휴식처 찾기" 경험을 기술적으로 뒷받침합니다.

## 1. 개요 (Overview)
Rural Rest의 검색 시스템은 전통적인 키워드 검색 방식 대신, 사용자의 **거점 도시(Location Hub)**와 **예산(Price Range)**을 중심으로 한 직관적인 탐색 경험을 제공합니다.

## 2. 검색 인터페이스 (Search Interface)
첫 화면(Home)의 Hero 섹션 내에 배치된 스마트 검색 카드는 다음 두 가지 핵심 요소를 가집니다.

### 2.1. 거점 도시 퀵 메뉴 (Location Hubs)
사용자가 직접 타이핑하지 않고도 선호하는 지역을 즉시 선택할 수 있는 배지(Badge) 인터페이스입니다.
*   **주요 거점**: 
    *   서울 근처 (`seoul-suburbs`)
    *   부산 근처 (`busan-suburbs`)
    *   경주 근처 (`gyeongju`)
    *   인천 근처 (`incheon`)
*   **작동 방식**: 클릭 시 해당 지역을 활성화하며, 재클릭 시 선택을 취소합니다. (단일 선택 모델)

### 2.2. 예산 필터 (Price Range Slider)
숙박 가격대를 직관적으로 조절할 수 있는 슬라이더 인터페이스입니다.
*   **범위**: ₩50,000 ~ ₩500,000+
*   **기본값**: ₩300,000
*   **표시**: 슬라이더 조절 시 상단에 "₩N 미만" 형식으로 실시간 피드백을 제공합니다.

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

---

## 4. 디자인 시스템 가이드 (UI/UX)
*   **컴포넌트**: `Badge`, `Slider`, `Card` (모두 `ui-mockup.tsx`에 정의)
*   **심미성**: 
    *   **Glassmorphism**: `bg-white/95 backdrop-blur shadow-2xl` 적용.
    *   **Micro-interaction**: 버튼 및 배지 클릭 시 `active:scale-95` 스케일 피드백 제공.
    *   **Real-time Feedback**: "현재 N곳의 빈집이 기다리고 있어요" 문구를 통해 데이터 현황 가이드 제공.

---

## 5. 관련 문서 (Related Documents)
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 민수의 검색 시나리오
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - 검색 쿼리 파라미터 정의 (Section 3.2)
- **Prototype**: [Home Page Implementation](../../rural-rest-v2/app/routes/home.tsx) - 실제 구현 코드
- **Logic**: [Search Algorithm](./02_SEARCH_ALGORITHM.md) - 상세 검색 필터링 알고리즘
