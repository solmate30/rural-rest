# 00. Product Backlog & Implementation Status
> Created: 2026-02-07 17:34
> Last Updated: 2026-02-10 12:00

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
*   [~] **Task 2.9**: Integrate Professional Map API (Kakao/Naver) for Property Detail Pages. → **Mock 완료** (CSS 그라디언트 지도 + 교통 안내 UI). Kakao API 키 확보 시 실제 API 교체 예정. → [Property Detail Guide](../03_Specs/07_PROPERTY_DETAIL_IMPLEMENTATION_GUIDE.md) Section 4.7-4.8
*   [x] **Task 2.10**: Setup LangGraph & Gemini Integration (Environment & Orchestration). → 구현 완료 (LangGraph workflow, DB Schema 확장)
*   [x] **Task 2.11**: Implement AI Global Concierge Tools (Kakao, KTO API & DB Connectors). → 구현 완료 (Simulator 기반 상용 API 연동 및 실제 DB Connector 연결)
*   [x] **Task 2.7**: Implement Global Layout (Header/Footer). → [UI Design](../01_Foundation/05_UI_DESIGN.md)
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
*   [~] **Task 2.13**: Setup Shadcn/UI Components (Button, Card, Input, Dialog, ScrollArea, Avatar). → 기본 컴포넌트 설치 완료
*   [ ] Configure Tailwind Theme (Colors, Fonts).

## 3. Completed (History)
**(Archived to `docs/04_Logic/00_ARCHIVE/`)**
*   [x] **Phase 1: Foundation** → [PHASE_1_FOUNDATION.md](00_ARCHIVE/PHASE_1_FOUNDATION.md)
*   [x] **Phase 2: Prototype** → [PHASE_2_PROTOTYPE.md](00_ARCHIVE/PHASE_2_PROTOTYPE.md)
*   [x] **Phase 3: Specs** → [PHASE_3_SPECS.md](00_ARCHIVE/PHASE_3_SPECS.md)

## 4. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - MVP 기능 명세 및 호스트/게스트 사이트맵
- **Foundation**: [Roadmap](../01_Foundation/04_ROADMAP.md) - NOW/NEXT/LATER 실행 계획
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 대시보드 UI 및 구현 상태
- **Prototype**: [Host Property Editor Review](../02_Prototype/05_ADMIN_EDITOR_REVIEW.md) - 숙소 편집 UI (Listing Create/Update 연동 대상)
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Admin Dashboard Section 3.5 및 Booking/Listing API
- **Specs**: [Admin Management Spec](../03_Specs/04_ADMIN_MANAGEMENT_SPEC.md) - 호스트 관리 명세 및 구현 상태 (Section 1.1)
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `listings`, `bookings` 테이블 참조
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) - 핵심 시나리오 검증
