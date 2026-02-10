# UI Design System & Guidelines
> Created: 2026-02-07 16:22
> Last Updated: 2026-02-11 12:00

## 1. Design Philosophy
**Keywords**: Warm, Earthy, Vintage, Authentic, Lively Community.
The interface blends **rustic warmth** with **modern clarity**. It evokes the feeling of returning to a grandmother's home (Halmeoni-jip) but with the convenience of a modern app.
*   **Balance**: 50% Calm & Static (Empty House Aesthetics) + 50% Dynamic & Human (Social Activities).

## 2. Color Palette (Earth Tones)
### 2.1. Brand Colors
*   **Primary (Warm Brown)**: `#8D6E63` (Representative of soil, wood, and clay walls). Used for Primary Buttons, Highlighted Text.
*   **Secondary (Soft Clay/Beige)**: `#D7CCC8` (Soft background accents, cards). Used for Section Backgrounds, Hovers.
*   **Accent (Terracotta Orange)**: `#FFAB91` (Energy, Sunset, Warmth). Used for "Book Now", Notifications, Activity Tags.

### 2.2. Neutrals
*   **Text (Charcoal Gray)**: `#3E2723` (Deep brown-black for softer reading than pure black).
*   **Background (Off-White)**: `#FAF9F6` (Creamy paper texture feeling).

## 3. Typography
*   **Headings (Handwriting Style)**:
    *   **Font**: *'Nanum Pen Script'* or *'Gaegu'* (Google Fonts).
    *   **Usage**: Emotional titles (e.g., "Tonight's Stories", "Meet the Host"). Adds personal, handwritten diary feel.
*   **Body (Clean Sans-serif)**:
    *   **Font**: *'Noto Sans KR'* or *'Pretendard'*.
    *   **Usage**: Descriptions, Booking details, Reviews. Ensures readability and trust.

## 4. Imagery Style
*   **Dual Atmosphere**:
    *   **Static (House)**: Wide, cinematic shots of the empty house, nature, quiet morning light. Focus on texture (wood grain, stone walls).
    *   **Dynamic (People)**: Candid shots of guests laughing around a Bul-meong fire, sharing Samgyeopsal, making Kimchi. Focus on facial expressions and shared moments.

## 5. Components
### 5.1. Buttons
*   **Style**: Slightly rounded corners (`rounded-lg`), not full pills.
*   **Effect**: Gentle shadow (`shadow-md`) on hover to mimic tactile pressing.
*   **Primary**: Filled with `#8D6E63`, Text White.
*   **Secondary**: Border `#8D6E63`, Text `#8D6E63`, Background Transparent.

### 5.2. Cards (Property/Activity)
*   **Structure**: Clean photo on top, handwritten title below.
*   **Background**: White card on `#FAF9F6` background.
*   **Shadow**: Soft, diffused shadow (`shadow-sm`) to lift content slightly.

### 5.3. Toast Notifications (User Feedback)
*   **Library**: shadcn/ui Toast component (`@radix-ui/react-toast` 기반)
*   **Purpose**: 사용자 액션에 대한 즉각적인 피드백 제공 (성공, 에러, 정보, 경고)
*   **Design Guidelines**:
    *   **Position**: 화면 우측 상단 또는 하단 (모바일: 하단 중앙)
    *   **Duration**: 기본 3-5초 (에러 메시지는 수동 닫기까지 유지)
    *   **Animation**: 부드러운 슬라이드 인/아웃 효과
    *   **Color Coding**:
        *   **Success**: Primary Green (`#4CAF50`) - 예약 성공, 저장 완료 등
        *   **Error**: Destructive Red (`#EF5350`) - API 에러, 유효성 검사 실패 등
        *   **Warning**: Accent Orange (`#FFAB91`) - 주의가 필요한 상황
        *   **Info**: Neutral Gray (`#757575`) - 정보성 메시지
*   **Usage Scenarios**:
    *   **인증 관련**: 로그인 성공/실패, 회원가입 성공/실패, 로그아웃 성공, 소셜 로그인 에러
    *   **API 에러 응답**: 400, 401, 403, 404, 500 등 HTTP 에러 상태 코드
    *   **폼 유효성 검사 실패**: 입력값 검증 에러 (서버 측 검증 실패 시)
    *   **비즈니스 로직 에러**: 결제 실패, 예약 불가, 권한 부족 등
    *   **성공 메시지**: 예약 완료, 설정 저장, 데이터 업데이트 완료 등
    *   **네트워크 오류 알림**: 연결 실패, 타임아웃 등
*   **Accessibility**: ARIA labels 및 키보드 닫기 지원 필수

### 5.4. Home Featured Stays (실시간 필터 목록)
*   **위치**: 랜딩 페이지 Hero 아래, Featured Stays 섹션.
*   **동작**: 스마트 검색 바(거점 지도, 예산 슬라이더) 선택에 따라 **같은 페이지에서** 카드 목록이 즉시 필터링됨. 기본 약 50개 표시, 지역 선택 또는 가격 하향 시 조건에 맞는 카드만 남아 개수가 줄어듦.
*   **피드백**: "현재 N곳의 빈집이 기다리고 있어요" 문구는 필터 결과 개수(N)로 갱신.
*   **Empty State**: 조건에 맞는 숙소가 0건일 때 "조건에 맞는 숙소가 없어요. 지역이나 예산을 바꿔 보세요." 등 안내 문구 표시.
*   **참조**: [Search & Filter Logic](../04_Logic_&_Progress/07_SEARCH_AND_FILTER_LOGIC.md) Section 3.4.

### 5.5. Interactive Rural Map (거점 선택 지도)
*   **Concept**: 단순 배지 목록 대신, 한국 지도의 실루엣 위에 주요 거점을 포인트로 표시하여 시각적 탐색 경험 제공.
*   **Visual Style**:
    *   **SVG 기반**: 가벼운 벡터 지도로 로딩 최적화.
    *   **Colors**: 지도 배경은 `#F5F5F0`(Soft Neutral), 선택되지 않은 포인트는 `#D7CCC8`, 선택된 포인트는 `Primary (#8D6E63)`.
    *   **Hand-drawn Feel**: 딱딱한 실사 지도가 아닌, Rural Rest의 톤에 맞춘 부드러운 라인의 일러스트형 SVG 활용.
*   **Interactions**:
    *   **Hover**: 포인트 위에 마우스 오버 시 지역명 툴팁(Tooltip) 노출 및 포인트 크기 확대 (`scale-125`).
    *   **Click**: 포인트 클릭 시 해당 지역 활성화. 이미 선택된 지역 클릭 시 전체 지역으로 초기화.
    *   **Responsiveness**: 모바일에서는 지도가 너무 작아질 수 있으므로, 탭 가능한 충분한 크기의 포인트 아이콘 또는 하단 배지 목록 병행 검토.

## 6. Global Layout (Header & Footer)
Standard design for shared layouts across all pages.

### 6.1. Header (Navigation)
*   **Logo**: "R" Icon (Primary Green) + "Rural Rest" text.
*   **Nav Links**: "Find a Stay", "Host your Home".
*   **Auth State**:
    *   **Guest**: "Login" Button (Outline).
    *   **User**: Avatar (with 2px white border + ring) + Name + "Logout" Button.
*   **Blur Effect**: `backdrop-blur` applied for premium visibility.

### 6.2. Footer (Information & Trust)
The Footer provides essential credibility and navigation at the bottom of every page.
*   **Background**: Soft Stone (`bg-stone-50`) or warm off-white.
*   **Structure (4 Columns)**:
    1.  **Brand**: Logo + Emotional Slogan ("비어있던 집, 다시 숨을 쉬다").
    2.  **Discovery**: Find a Stay, Popular Regions (Seoul, Busan, Gyeongju), Seasonal Picks.
    3.  **Hosting**: Why Host, Host Resources, Community Stories.
    4.  **Support**: Help Center, Safety Information, Cancellation Options.
*   **Bottom Bar**:
    *   **Legal**: Privacy Policy, Terms, Sitemap.
    *   **Social**: Instagram, YouTube icons.
    *   **Copy**: "© 2026 Rural Rest Inc. All rights reserved."

### 6.3. AI Concierge Entry Point (Ask AI)
*   **목적**: 게스트가 AI 컨시어지(교통·정책·한국 여행 정보)에 진입하는 UI.
*   **권장 위치**: 헤더 우측(로그인/아바타 근처) 고정 아이콘 또는 플로팅 버튼. 모바일에서는 하단 네비게이션 또는 플로팅 액션.
*   **노출 페이지**: 전역(모든 게스트 페이지) 또는 Property Detail·Booking 등 컨텍스트가 있는 페이지부터 단계적 노출. (구현 시 결정)
*   **참조**: [AI Concierge Spec](../03_Technical_Specs/04_AI_CONCIERGE_SPEC.md), [AI Concierge Logic](../04_Logic_&_Progress/08_AI_CONCIERGE_LOGIC.md).

### 6.4. 디자인 토큰 구현 상태 (Theme Implementation)
*   **CSS 변수**: `app/app.css`의 `:root`에 Section 2 팔레트 반영 (Primary #8D6E63, Secondary #D7CCC8, Accent #FFAB91, Background #FAF9F6, Foreground #3E2723).
*   **폰트**: Section 3 Body 폰트 적용. `tailwind.config.js`의 `fontFamily.sans`에 Noto Sans KR·Pretendard, `root.tsx` links에서 Google Fonts Noto Sans KR 로드.
*   **컴포넌트**: Shadcn/UI (Button, Card, Input, Dialog, ScrollArea, Avatar, Toast) 설치 완료. `app/components/ui/` 참조. [Backlog](../04_Logic_&_Progress/00_BACKLOG.md) Section 2 Design System.

## 7. Related Documents
- **Foundation**: [Product Specs](./03_PRODUCT_SPECS.md) - 사이트맵 및 사용자 플로우
- **Foundation**: [Admin Strategy](./06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 UX 원칙
- **Foundation**: [Happy Path Scenarios](./07_HAPPY_PATH_SCENARIOS.md) - 디자인이 구현되는 사용자 여정 및 시나리오
- **Prototype**: [Landing Page Review](../02_UI_Screens/00_LANDING_PAGE_REVIEW.md) - 랜딩 페이지 디자인 적용 사례
- **Prototype**: [Property Detail Review](../02_UI_Screens/01_DETAIL_PAGE_REVIEW.md) - 프로퍼티 상세 페이지 디자인 적용 사례
- **Prototype**: [Booking Page Review](../02_UI_Screens/02_BOOKING_PAGE_REVIEW.md) - 예약 페이지 디자인 적용 사례
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - 대시보드 디자인 적용 사례
- **Specs**: [AI Concierge Spec](../03_Technical_Specs/04_AI_CONCIERGE_SPEC.md) - AI 진입점 연계 (Section 6.3)
- **Logic**: [Backlog](../04_Logic_&_Progress/00_BACKLOG.md) - 디자인 시스템 구현 상태 (Task 2.13, Tailwind Theme, Section 2)
- **Logic**: [AI Concierge Logic](../04_Logic_&_Progress/08_AI_CONCIERGE_LOGIC.md) - 에이전트 워크플로우
