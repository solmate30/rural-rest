# Footer 및 서칭 기능 검토 보고서
> Created: 2026-02-08
> Last Updated: 2026-02-08

본 문서는 **Footer**와 **스마트 검색(Smart Search)** 구현이 관련 문서(Foundation, Specs, Logic)와 일치하는지 검토한 결과입니다.

---

## 1. 검토 범위

| 구분 | 구현 위치 | 참조 문서 |
|------|-----------|-----------|
| Footer | `web/app/components/ui-mockup.tsx` (Footer) | `01_Concept_Design/05_UI_DESIGN.md` Section 6.2 |
| Smart Search | `web/app/routes/home.tsx` | `04_Logic_Progress/07_SEARCH_AND_FILTER_LOGIC.md`, `03_Technical_Specs/02_API_SPECS.md` Section 3.2 |
| Backlog | - | `04_Logic_Progress/00_BACKLOG.md` |

---

## 2. Footer 검토 결과

### 2.1. 문서와의 일치 사항
- **배경**: `bg-stone-50`, `border-t` 사용. 문서(6.2)의 "Soft Stone / warm off-white"와 일치.
- **4단 구조**: Brand, Discovery(Search), Hosting, Support 구성. 문서 명세와 동일.
- **Brand 컬럼**: 로고 + 슬로건 "비어있던 집, 다시 숨을 쉬다" 문구 반영.
- **Hosting 컬럼**: Host your Home, Why Host?, Hosting Policy, Community Stories 제공.
- **Support 컬럼**: Help Center, Safety Info, Cancellation Options, Contact Us 제공.
- **Bottom Bar**: Privacy, Terms, Sitemap, © 2026 Rural Rest Inc., Instagram/YouTube 아이콘 포함.

### 2.2. 문서와의 불일치 및 권장 수정
| 항목 | 문서 (05_UI_DESIGN.md Section 6.2) | 구현 (ui-mockup) | 권장 |
|------|------------------------|------------------|------|
| 2번째 컬럼 제목 | **Discovery** (Find a Stay, Popular Regions, Seasonal Picks) | **Search** (Find a Stay, Near Seoul, Near Busan, Gyeongju Stays) | 문서와 구현 중 하나로 통일 권장. 문서는 "Discovery", 구현은 "Search"이므로, UI Design을 "Discovery (Search)" 또는 구현을 "Discovery"로 맞추면 일관됨. |
| Discovery 내용 | Seasonal Picks | 없음 | "Seasonal Picks" 링크는 추후 페이지가 있으면 추가 가능. 현재는 미구현으로 문서에 "(추후 추가)" 표기 권장. |
| Hosting | "Host Resources" | "Hosting Policy" | 문서의 "Host Resources"와 구현의 "Hosting Policy"를 동일 용어로 통일 권장. |
| 저작권 문구 | "© 2026 Rural Rest Inc. **All rights reserved.**" | "© 2026 Rural Rest Inc." | 선택 사항. 필요 시 구현에 "All rights reserved." 추가. |

---

## 3. 서칭(Smart Search) 검토 결과

### 3.1. 문서와의 일치 사항
- **위치**: Hero 섹션 내 스마트 검색 카드. `07_SEARCH_AND_FILTER_LOGIC.md` Section 2와 일치.
- **거점 도시**: Badge 형태, 단일 선택, 재클릭 시 해제. 문서 2.1과 동일.
- **예산 슬라이더**: ₩50,000 ~ ₩500,000, 기본 ₩300,000, "₩N 미만" 표시. 문서 2.2와 일치.
- **상태 관리**: `selectedLocation`, `maxPrice`를 `useState`로 관리. 문서 3.1 코드 예시와 일치.
- **컴포넌트**: Badge, Slider, Card 사용. 문서 4와 일치.
- **디자인**: `bg-white/95 backdrop-blur shadow-2xl`, `active:scale-95` 등. 문서 4 심미성과 일치.
- **BACKLOG**: Task 2.5 (Smart Search UI) 완료 표시 적절. Task 2.6 (Search Results Page) 미구현 상태와 라우트 부재(`/search` 없음) 일치.

### 3.2. 문서와의 불일치 및 권장 수정
| 항목 | 문서 | 구현 | 권장 |
|------|------|------|------|
| 거점 목록 개수 | 2.1에 서울/부산/경주/인천 4개만 명시 | `locations` 배열에 제주도 포함 5개, 화면에는 `slice(0,4)`로 4개만 표시 | 문서에 "제주도 등 확장 가능" 또는 구현과 동일하게 5개 중 4개 표시 명시. 또는 `slice(0,4)` 제거 후 5개 모두 노출 검토. |
| '숙소 찾기' 버튼 동작 | 3.2 "Proposed": URL 파라미터로 `/search` 또는 `/property` 전달 | 버튼 클릭 시 네비게이션/쿼리 전달 없음 | 문서에 "현재 버튼은 미연동, Search Results Page(Task 2.6) 구현 시 연동 예정" 명시 권장. |
| 검색 결과 라우트 | API_SPECS 3.2에 `/search` 정의 | `routes.ts`에 `/search` 라우 없음 | Task 2.6 완료 전까지는 현 상태 유지. API 스펙은 "검색 결과 페이지 구현 시 적용"으로 문서에 명시해 두면 충돌 없음. |

---

## 4. 문서 구조 점검

- **05_UI_DESIGN.md**: Section 5 다음을 6(Global Layout), 7(Related Documents)로 번호 정리 완료.
- **07_SEARCH_AND_FILTER_LOGIC.md** 관련 문서 링크: `../../web/app/routes/home.tsx` 경로는 `docs/04_Logic_Progress/` 기준으로 올바름.
- **00_BACKLOG.md**: Task 2.5, 2.7 완료 반영 적절. Last Updated가 2026-02-07 23:50으로 되어 있어, Footer/검색 반영 후라면 날짜 갱신 권장.

---

## 5. 종합 결론

| 구분 | 상태 | 비고 |
|------|------|------|
| Footer | **전반적으로 문서와 일치** | 컬럼명(Discovery vs Search), Host Resources vs Hosting Policy, Seasonal Picks 유무 등 소소한 통일 권장. |
| Smart Search | **전반적으로 문서와 일치** | URL 연동·검색 결과 페이지는 "Proposed"/Task 2.6으로 문서와 구현이 정합성 있음. 거점 5개 중 4개 표시만 문서에 명시하면 됨. |
| 문서 간 참조 | **일관됨** | BACKLOG, API_SPECS, 07_SEARCH_AND_FILTER_LOGIC, UI_DESIGN 간 링크 및 역할 구분 적절. |

**요약**: Footer와 서칭 기능은 관련 문서와 큰 틀에서 잘 맞춰져 있습니다. 위의 소소한 불일치만 문서 또는 구현 중 한쪽에 반영하면 두 맥락(구현·문서)이 더 잘 정리됩니다.
