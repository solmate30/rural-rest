# 03. Admin Dashboard Review (Host View V2)
> Created: 2026-02-07 17:04
> Last Updated: 2026-02-07 19:00

## 1. Prototype Link/Screenshot
*   **Project Name**: Rural Rest V2
*   **Screen Name**: Host Admin Dashboard
*   **Style**: Shadcn/UI Aesthetic (Data-First)

## 2. Key User Flows (Demonstrated)
1.  **Metric Central**:
    *   **2x2 Grid**: Rapid health check.
        *   **Revenue**: Financial health ($4,250).
        *   **Occupancy**: Operational efficiency (82%).
        *   **Check-in**: Today's immediate task (3 Guests).
        *   **Pending**: Action required (2 Requests).
2.  **Booking Management**:
    *   **Recent List**: Clean rows with Name, Room, Date.
    *   **Status Badges**: Green (Confirmed) vs Yellow (Pending) for quick scanning.
3.  **Activity Ops**:
    *   **Event Card**: Highlights "Samgyeopsal Party" status (6/10 Joined).
    *   **Edit Action**: Outline button allows quick modification of capacity/price.

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Professionalism**: The Shadcn style (Inter, white bg, thin borders) looks like legitimate business software.
*   **Information Density**: Packs a lot of data without feeling cluttered, thanks to the grid system.
*   **Actionable**: The "Pending" badge and "Edit" buttons drive immediate action.

### 3.2. Issues & To-Do (Fix before Logic)
*   [ ] **Notification**: A bell icon is crucial for real-time updates (new booking, message).
*   [ ] **Quick Add**: Needs a FAB or "+" button for manual bookings (walk-ins).
*   [ ] **Filter**: The Recent Bookings list needs filters (All | Pending | Check-in).

## 4. Next Step
*   **Prototype Phase Complete.**
*   Proceed to **Specs Phase (03_Specs)** to define **Database Schema** and **API Endpoints**.

## 5. Related Documents
- **Foundation**: [Admin Strategy](../01_Foundation/06_ADMIN_STRATEGY.md) - 호스트 운영 전략 및 기능 우선순위
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 호스트 대시보드 사이트맵 (Section 3.B)
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 시스템 및 데이터 시각화 가이드라인
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 호스트 시나리오 (예약 승인, 자동 번역 소통)
- **Prototype**: [Booking Page Review](./02_BOOKING_PAGE_REVIEW.md) - 이전 단계 프로토타입
- **Specs**: [Admin Management Spec](../03_Specs/04_ADMIN_MANAGEMENT_SPEC.md) - 상세 기능 명세
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `bookings`, `listings`, `activities` 테이블 구조
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Admin Dashboard API 엔드포인트 (Section 3.5)
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 승인/거절 로직
