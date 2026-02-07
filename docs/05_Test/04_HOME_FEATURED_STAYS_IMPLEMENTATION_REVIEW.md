# Home Featured Stays 실시간 필터 구현 검토
> Created: 2026-02-08
> Last Updated: 2026-02-08

홈 Featured Stays 실시간 필터 구현이 문서(07_SEARCH_AND_FILTER_LOGIC Section 3.4, API_SPECS 3.1, UI_DESIGN 5.4)와 일치하는지 검토한 결과입니다.

---

## 1. 검토 범위

| 구분 | 파일 | 문서 |
|------|------|------|
| 필터 로직·UI | `rural-rest-v2/app/routes/home.tsx` | 07_SEARCH_AND_FILTER_LOGIC.md Section 3.4 |
| 목데이터 | `rural-rest-v2/app/data/listings.ts` | API_SPECS 3.1 (Listing 필드) |

---

## 2. 문서 대비 일치 사항

### 2.1. 상태 및 필터 규칙
- `selectedLocation`, `maxPrice`를 `useState`로 관리. 문서 3.1과 일치.
- `useMemo`로 `filteredListings` 계산, 의존성 `[selectedLocation, maxPrice]`. 문서 3.4 "useMemo 또는 동일 상태 기반"과 일치.
- **지역**: `!selectedLocation \|\| listing.location === selectedLocation`. 문서 "selectedLocation === null이면 미적용, 값 있으면 listing.location === selectedLocation"과 일치.
- **가격**: `listing.pricePerNight <= maxPrice`. 문서와 일치.
- **AND 결합**: `matchesLocation && matchesPrice`. 문서 "둘 다 적용"과 일치.

### 2.2. Real-time Feedback
- 스마트 검색 카드 하단: "현재 {지역명} {filteredListings.length}곳의 빈집이 기다리고 있어요". 지역 선택 시 지역명, 미선택 시 "전체 지역" 표시. 문서 "N곳의 빈집이 기다리고 있어요" 갱신과 일치.

### 2.3. Empty State
- 필터 결과 0건 시 전용 블록 렌더.
- 문구: "조건에 맞는 숙소가 없어요", "지역이나 예산을 바꿔 가며 당신만의 휴식처를 찾아보세요." 문서 권장 문구와 일치.
- "필터 초기화" 버튼으로 `selectedLocation = null`, `maxPrice = 500000` 복원. 문서에 없는 추가 UX로 적절함.

### 2.4. 목데이터
- `Listing` 인터페이스에 `id`, `location`, `pricePerNight`, `locationLabel`, `title`, `description`, `image`, `rating`, `maxGuests` 존재. 문서(API_SPECS 3.1)의 필수 필드 `id`, `location`, `pricePerNight` 충족.
- `mockListings`: 고정 5건 + 생성 45건 = **50건**. 문서 "기본 약 50건"과 일치.
- 생성 데이터의 `location` 값이 배지 값(`seoul-suburbs`, `busan-suburbs`, `gyeongju`, `incheon`, `jeju`)과 동일. 필터 정합성 유지.

### 2.5. UI·컴포넌트
- Badge, Slider, Card 사용. 5개 지역 배지 전체 노출(단일 선택, 재클릭 해제). 문서 2.1, 4와 일치.
- 가격 슬라이더 5만~50만, 기본 30만. 문서 2.2와 일치.
- 카드 클릭 시 `/property/${listing.id}` 이동. 적절함.

---

## 3. 보완 권장 사항

| 항목 | 현재 | 권장 |
|------|------|------|
| **데이터 소스** | `mockListings`를 클라이언트에서 직접 import | 추후 Landing Loader(`/`)에서 `featuredListings` 반환하도록 연동 시, 동일 필터 로직(useMemo) 유지. 문서 3.4 "Loader에서 반환한 목록"과의 정합성 유지. |
| **Featured Stays 헤더** | "N results" (영문) | 한국어 일관성을 위해 "N곳" 또는 "N개 숙소" 표기 검토. |
| **목데이터 일관성** | `Array.from({ length: 45 }).map()` 내부에서 `Math.random()` 사용으로 호출마다 가격·평점·지역이 바뀜 | 개발/데모용으로는 무방. 테스트 재현성이 필요하면 시드 고정 또는 고정 목데이터 50건으로 교체 검토. |

---

## 4. 종합

- **필터 로직·상태**: 문서 3.4와 일치.
- **N곳 문구·Empty State**: 문서 및 UI_DESIGN 5.4와 일치. 필터 초기화 버튼은 문서 초과이지만 UX 개선으로 적절.
- **목데이터**: 건수·필드·지역 값이 문서 및 API_SPECS와 부합. 추후 loader 연동과 목데이터 결정성만 보완하면 됨.

**결론**: 구현은 문서 명세를 만족하며, 위 보완 사항은 선택적으로 반영하면 됨.

---

## 5. 관련 문서

- **Logic**: [Search & Filter Logic](../04_Logic/07_SEARCH_AND_FILTER_LOGIC.md) - Section 3.4
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Section 3.1
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - Section 5.4
