# UI Design System & Guidelines
> Created: 2026-02-07 16:22
> Last Updated: 2026-02-08 00:20

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

## 7. Related Documents
- **Foundation**: [Product Specs](./03_PRODUCT_SPECS.md) - 사이트맵 및 사용자 플로우
- **Foundation**: [Admin Strategy](./06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 UX 원칙
- **Foundation**: [Happy Path Scenarios](./07_HAPPY_PATH_SCENARIOS.md) - 디자인이 구현되는 사용자 여정 및 시나리오
- **Prototype**: [Landing Page Review](../02_Prototype/00_LANDING_PAGE_REVIEW.md) - 랜딩 페이지 디자인 적용 사례
- **Prototype**: [Property Detail Review](../02_Prototype/01_DETAIL_PAGE_REVIEW.md) - 프로퍼티 상세 페이지 디자인 적용 사례
- **Prototype**: [Booking Page Review](../02_Prototype/02_BOOKING_PAGE_REVIEW.md) - 예약 페이지 디자인 적용 사례
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 대시보드 디자인 적용 사례
