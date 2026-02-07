# 04. Search & Explore Page Review
> Created: 2026-02-07 20:58
> Last Updated: 2026-02-07 20:58

## 1. Prototype Overview
게스트가 랜딩 페이지에서 검색을 수행한 후 마주하게 되는 검색 결과 및 지도 탐색 화면에 대한 리뷰입니다. 사용자가 자신의 취향에 맞는 '빈집' 숙소를 필터링하고 위치 정보를 확인하는 핵심 여정입니다.

*   **Screen Name**: Search & Explore (Map View)
*   **Design Goal**: "Warm Heritage Minimalism"을 유지하면서 정보 탐색의 편의성 제공.

## 2. Key User Flows (Demonstrated)
1.  **View Toggle (List vs Map)**:
    *   우측 상단 토글 버튼을 통해 격자형(Grid) 목록 보기와 지도(Map) 보기를 전환.
    *   지도는 'Warm Beige' 테마의 커스텀 맵 타일 사용 (건조한 느낌 지양).
2.  **Smart Filtering**:
    *   **Room Type**: 도미토리(Dormitory) / 개인실(Private) 필터.
    *   **Experience Category**: 불멍, 바다, 산림욕 등 주변 테마별 필터.
    *   **Price Range**: 슬라이더를 통한 원화(KRW) 기준 가격 범위 설정.
3.  **Interactive Map Markers**:
    *   지도 위의 가격 마커 클릭 시 해당 숙소의 간이 카드(Mini Card) 팝업.
    *   카드 클릭 시 상세 페이지(`01_DETAIL_PAGE`)로 이동.

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Visual Consistency**: `DESIGN.md`에 정의된 Primary Green 색상의 마커와 Warm Beige 배경의 조화.
*   **Categorization**: 시골 여행의 특징을 살린 '체험형 필터'가 직관적임.

### 3.2. Issues & To-Do (Fix before Logic)
*   [ ] **Empty Results**: 검색 결과가 없을 때 추천 숙소나 '다른 마을 둘러보기' 버튼 필요.
*   [ ] **Quick Save**: 결과 목록에서 '좋아요(위시리스트)' 기능을 즉시 수행할 수 있는 하트 아이콘 추가.
*   [ ] **Distance Info**: 마을 입구(정류장)로부터의 도보/셔틀 소요 시간 표시 필요.

## 4. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 3.A.2 검색 결과 명세 참조
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 지도 마커 및 카드 컴포넌트 디자인 가이드
- **Prototype**: [Landing Page Review](./00_LANDING_PAGE_REVIEW.md) - 이전 단계 (검색 바 진입점)
- **Prototype**: [Property Detail Review](./01_DETAIL_PAGE_REVIEW.md) - 다음 단계 (결과 클릭 시 이동)
- **Logic**: [Search Algorithm](../04_Logic/02_SEARCH_ALGORITHM.md) - 거리 순, 체험 가중치 기반 검색 로직
