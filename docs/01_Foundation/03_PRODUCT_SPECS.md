# Project Overview & Feature Specs
> Created: 2026-02-07 16:21
> Last Updated: 2026-02-07 21:00

## 1. Project Concept
**Rural Rest** is a platform connecting global travelers with authentic Korean rural experiences through renovated empty houses (빈집). It emphasizes **community, authenticity, and sustainability**.
The primary accommodation type is **Modernized Dormitory (70%)** for social interaction, combined with **Private Rooms (30%)** for comfort.

## 2. Strategic Features (Based on User Needs)

### 2.1. Accommodation (The Stay)
*   **Renovation Style**: "Vintage & Warm" (빈집, 고택, 농가주택의 외부 원형 보존 + 내부 단열/위생 현대화).
*   **Room Types**:
    *   **Dormitory (70%)**: Shared bunk beds, communal lounge access, affordable pricing for long stays.
    *   **Private Room (30%)**: En-suite bathroom (if possible), quiet space for digital nomads.
*   **Long-stay Discount**: Automatic discount applied for 7+ days or 30+ days booking.

### 2.2. Value-Add Services (Solving Pain Points)
*   **Auto-Translation Chat**: Seamless communication between foreign guests and local hosts. (MVP Must-Have)
*   **AI Global Concierge (Gemini 2.5 Flash)**: 
    *   **Scope**: Provides transport guidance (shuttle/taxi), web-wide application help (bookings, policies), and general South Korea travel information.
    *   **Technology**: Built with **LangGraph** for stateful, complex reasoning and **Gemini 2.5 Flash** for high-speed, multimodal intelligence.
    *   **Goal**: Act as a "Local Buddy" (시골 친구) that knows everything about the stay and the surrounding region. (Strategic Essential)
*   **Local Guide Curation**: Detailed guides on hidden local spots, walking trails, and village stories.

### 2.3. Community & Experience (The Vibe)
*   **"Local Connect" Program**:
    *   **Offline Activities**: Bul-meong (Fire gazing), Samgyeopsal (Pork belly) Party, Kimchi making with locals.
    *   **Goal**: Provide "Unexpected Hospitality" (뜻밖의 환대) in an unfamiliar place.
*   **Guest Lounge**: Digital bulletin board for guests to self-organize meetups or carpools.

### 2.4. Global Payment & Booking
*   **Multi-Currency Support**: Display prices in KRW, USD, EUR based on user location.
*   **Payment Gateways**:
    *   **International**: PayPal, Stripe (Visa/Mastercard).
    *   **Domestic**: Naver Pay, Kakao Pay (for local guests).
*   **Instant Booking**: Real-time availability check and immediate confirmation.

## 3. Site Map (User Flow)

### (A) Guest Side
1.  **Landing Page**: Hero Section (Emotional Video), Quick Search (Location/Date/Guests), "Featured Experience" Slider.
2.  **Search Results**: Filter by Room Type (Dorm/Private), Activity Type (Food/Nature), Price Range. Map View integration.
3.  **Property Detail**:
    *   High-quality photos of the *vintage exterior* vs *modern interior*.
    *   **"Experience This Stay"**: List of available activities (e.g., Fri: Samgyeopsal Party).
    *   **Transport Info**: Clear "How to get there" section with shuttle options.
    *   Host Profile & "House Story" (History of the empty house).
4.  **Booking & Payment**:
    *   Step 1: Select Room & Dates.
    *   Step 2: Add-on Activities (Bul-meong kit).
    *   Step 3: Transport Option (Add Shuttle Request).
    *   Step 4: Guest Info & Payment (PayPal/Card).
5.  **My Trip**: Reservation details, **Auto-Translated Chat** with Host, Activity Schedule.

### (B) Host (Admin) Side
1.  **Dashboard**: Today's Check-in/out, Revenue Chart, Upcoming Activity Participants.
2.  **Property Management**: Room inventory, Pricing calendar, Upload photos.
3.  **Activity Manager**: Create/Edit local events (Set max participants, price).
4.  **Reservation Management**: Approve/Reject requests, Handle cancellations.

**상세 전략 및 운영 원칙**: [Admin Strategy](./06_ADMIN_STRATEGY.md) 참조

## 4. Related Documents
- **Foundation**: [Vision & Core Values](./01_VISION_CORE.md) - 프로젝트 비전 및 타겟 오디언스
- **Foundation**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 핵심 기능 배경
- **Foundation**: [Happy Path Scenarios](./07_HAPPY_PATH_SCENARIOS.md) - 핵심 사용자 여정 및 시나리오
- **Foundation**: [Roadmap](./04_ROADMAP.md) - 기능 우선순위 및 단계별 계획
- **Foundation**: [UI Design](./05_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트 가이드라인
- **Foundation**: [Admin Strategy](./06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 관리 기능 우선순위
- **Prototype**: [Landing Page Review](../02_Prototype/00_LANDING_PAGE_REVIEW.md) - 랜딩 페이지 프로토타입
- **Prototype**: [Search & Explore Review](../02_Prototype/04_SEARCH_EXPLORE_REVIEW.md) - 검색 및 지도 탐색 프로토타입
- **Prototype**: [Property Detail Review](../02_Prototype/01_DETAIL_PAGE_REVIEW.md) - 프로퍼티 상세 페이지 프로토타입
- **Prototype**: [Booking Page Review](../02_Prototype/02_BOOKING_PAGE_REVIEW.md) - 예약 및 결제 페이지 프로토타입
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트 대시보드 프로토타입
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - 데이터 모델 설계
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - API 엔드포인트 명세 ([Auth & Session](../04_Logic/06_AUTH_AND_SESSION_LOGIC.md) 관련)
- **Logic**: [Translation Engine](../04_Logic/04_TRANSLATION_ENGINE.md) - 번역 API 연동 로직
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 예약 서비스 로직
- **Logic**: [Auth & Session](../04_Logic/06_AUTH_AND_SESSION_LOGIC.md) - Better Auth 기반 인증 및 역할 관리
- **Specs**: [AI Concierge Spec](../03_Specs/04_AI_CONCIERGE_SPEC.md) - AI 컨시어지 기술 스택 및 도구 명세 (Section 2.2 연계)
- **Logic**: [AI Concierge Logic](../04_Logic/08_AI_CONCIERGE_LOGIC.md) - LangGraph 워크플로우 설계
- **Test**: [AI Concierge Test Plan](../05_Test/03_AI_CONCIERGE_TEST_PLAN.md) - AI 컨시어지 시나리오 검증
