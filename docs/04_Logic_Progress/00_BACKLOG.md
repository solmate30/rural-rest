# 00. Product Backlog & Implementation Status
> Created: 2026-02-07 17:34
> Last Updated: 2026-02-18 12:00

This document tracks the entire development progress. Tasks are moved from **Backlog** to **Current Sprint** and finally to **Completed** (archived).

## 1. Current Sprint (High Priority)
**(Focus: MVP Database & API Setup)**
*   [x] **Task 2.1**: Setup Tech Stack (React Router v7, Drizzle, Turso). → 코드 구현 완료 (package.json, drizzle.config.ts, db/index.server.ts)
*   [x] **Task 2.2**: Implement Database Schema (Tables: Users, Listings, Bookings). → 코드 구현 완료 (db/schema.ts: 8개 테이블)
*   [x] **Task 2.3**: Configure Cloudinary & Storage Utilities. → 코드 구현 완료 (cloudinary.server.ts, use-cloudinary-upload.ts, api.sign-cloudinary.ts)
*   [x] **Task 2.4**: Implement Auth Logic (Better Auth integration, Social Login UI, requireUser utility). → [Auth & Session Logic](./06_AUTH_AND_SESSION_LOGIC.md)

## 2. Backlog (Upcoming)
### Frontend Implementation
*   [x] **Task 2.5**: Implement Smart Search UI (Location Badges, Price Slider). → [Search & Filter Logic](./07_SEARCH_AND_FILTER_LOGIC.md)
*   [ ] **Task 2.8**: [REMOVED] Upgrade Location Selection to Interactive SVG Rural Map.
*   [x] **Task 2.9**: Integrate Professional Map API for Property Detail Pages. → **Google Maps** 적용 완료 (`PropertyMap.tsx`, `VITE_GOOGLE_MAPS_API_KEY`). 교통 안내 UI는 Mock 유지. → [Property Detail Guide](../03_Technical_Specs/07_PROPERTY_DETAIL_IMPLEMENTATION_GUIDE.md) Section 4.7-4.8
*   [x] **Task 2.10**: Setup LangGraph & Gemini Integration (Environment & Orchestration). → 구현 완료 (LangGraph workflow, DB Schema 확장)
*   [x] **Task 2.11**: Implement AI Global Concierge Tools (Kakao, KTO API & DB Connectors). → 구현 완료 (Simulator 기반 상용 API 연동 및 실제 DB Connector 연결)
*   [x] **Task 2.7**: Implement Global Layout (Header/Footer). → [UI Design](../01_Concept_Design/05_UI_DESIGN.md)
*   [x] **Task 2.6**: Implement Search Results Page (Filters, Map View). → 코드 구현 완료 (search.tsx, home.tsx 연동)
*   [x] Implement Property Detail Page (Gallery Modal, Info Cards). → 코드 구현 완료 (property.tsx 동적 데이터 연동)
*   [x] Implement Booking Flow (Date Selection, Guest Count, Payment Fake). → 코드 구현 완료 (book.tsx 전면 재작성: loader/action, 동적 폼, 실시간 가격 계산, Confirmation UI)

### Backend Logic
*   [x] Create API: `loader` for Listing Details. → 코드 구현 완료 (property.tsx loader)
*   [x] Create API: `action` for Booking Creation. → 코드 구현 완료 (book.tsx action: Mock 기반 성공 응답, 폼 검증 4종)
*   [x] **Task 2.12**: Implement AI Global Concierge Chat UI. → 구현 완료 (Floating Chat UI, Global Layout 연동)
*   [x] Implement Admin Dashboard Data Fetching (Revenue/Occupancy). → 코드 구현 완료 (`admin-dashboard.server.ts`, `admin.dashboard.tsx` loader 연동)
*   [ ] **Listing Create/Update to DB**: Admin Edit 페이지에서 폼 제출 시 `listings` 테이블에 insert/update. (현재 admin.edit.tsx는 UI만 있으며 action·loader 미구현)

### Design System
*   [x] **Task 2.13**: Setup Shadcn/UI Components (Button, Card, Input, Dialog, ScrollArea, Avatar). → Button, Card, Input, Dialog, ScrollArea, Avatar, Toast 설치 완료 (`app/components/ui/`)
*   [x] Configure Tailwind Theme (Colors, Fonts). → `app.css` :root를 Warm Heritage(05_UI_DESIGN)에 맞춤 (Primary #8D6E63, Secondary #D7CCC8, Accent #FFAB91, Background #FAF9F6). `tailwind.config.js` fontFamily Noto Sans KR 반영, `root.tsx` 폰트 링크 추가

### Roadmap NOW (04_ROADMAP)
*   [ ] **PayPal/Stripe 결제 연동**: 예약 결제를 Mock에서 실제 글로벌 결제로 전환
*   [ ] **Auto-Translation Chat**: 외국인 게스트용 자동 번역 채팅 (언어 장벽 제거)
*   [ ] **Transport Request (수동)**: Last Mile 교통 요청 기능, 초기에는 관리자 수동 처리

### Admin / Editor 보강
*   [ ] **Admin Edit: 실시간 검증 및 미저장 경고**: 가격·최대 인원 등 Zod 실시간 검증, 이탈 시 미저장 경고 모달. → [05_ADMIN_EDITOR_REVIEW](../02_UI_Screens/05_ADMIN_EDITOR_REVIEW.md) §3.2

### RWA (10_RWA_IMPLEMENTATION_LOG)
*   [ ] **RWA Phase 2 UI 마무리**: `/invest/:id` 리모델링 이력·월 평균 예약률·Token 상세·수익 분배 차트·Est. Annual Return; `/my-investments` Summary·보유 카드·배당 이력·Explorer·CSV; Host `/admin/tokenize` 신청 폼·심사 상태; 수익률 음수/위험 안내 스타일·차트 라이브러리
*   [ ] **RWA Phase 3 Mock**: `rwa_tokens`·`rwa_investments` 스키마 및 마이그레이션, Mock 시딩, Purchase 트랜잭션 Mock UI
*   [ ] **RWA Phase 4 배당**: `rwa_dividends` 스키마, 호스트 순이익 기반 배당 로직 반영, Claim 버튼·지갑 플로우
*   [ ] **RWA Phase 5 Entry Hooks**: 일반 숙소 상세에서 RWA 투자 배너/버튼, 예약 후 투자 전환 흐름

### DAO (08_DAO_IMPLEMENTATION_SPEC)
*   [ ] **DAO 착수 전 체크리스트**: RWA/Council Token Mint(Devnet), Squads Multisig, 환경변수 5종 확정
*   [ ] **DAO 1단계 구현**: Realms Realm 생성, `/invest/:id/governance` 투표 UI·플로우

## 3. Completed (History)
**(Archived to `docs/04_Logic_Progress/00_ARCHIVE/`)**
*   [x] **Phase 1: Foundation** → [PHASE_1_FOUNDATION.md](00_ARCHIVE/PHASE_1_FOUNDATION.md)
*   [x] **Phase 2: Prototype** → [PHASE_2_PROTOTYPE.md](00_ARCHIVE/PHASE_2_PROTOTYPE.md)
*   [x] **Phase 3: Specs** → [PHASE_3_SPECS.md](00_ARCHIVE/PHASE_3_SPECS.md)

## 4. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 명세 및 호스트/게스트 사이트맵
- **Foundation**: [Roadmap](../01_Concept_Design/04_ROADMAP.md) - NOW/NEXT/LATER 실행 계획
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - 대시보드 UI 및 구현 상태
- **Prototype**: [Host Property Editor Review](../02_UI_Screens/05_ADMIN_EDITOR_REVIEW.md) - 숙소 편집 UI (Listing Create/Update 연동 대상)
- **Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - Admin Dashboard Section 3.5 및 Booking/Listing API
- **Specs**: [Admin Management Spec](../03_Technical_Specs/04_ADMIN_MANAGEMENT_SPEC.md) - 호스트 관리 명세 및 구현 상태 (Section 1.1)
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - `listings`, `bookings` 테이블 참조
- **Test**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 핵심 시나리오 검증
- **RWA**: [RWA Implementation Log](./10_RWA_IMPLEMENTATION_LOG.md), [RWA Issuance Spec](../03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md), [RWA Issuance Plan](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md)
- **DAO**: [DAO Implementation Spec](../03_Technical_Specs/08_DAO_IMPLEMENTATION_SPEC.md), [DAO Governance Plan](../01_Concept_Design/14_DAO_GOVERNANCE_PLAN.md)
