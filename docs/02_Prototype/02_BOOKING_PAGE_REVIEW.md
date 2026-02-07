# 02. Booking & Payment Page Review (V2)
> Created: 2026-02-07 17:01
> Last Updated: 2026-02-07 19:00

## 1. Prototype Link/Screenshot
*   **Project Name**: Rural Rest V2
*   **Screen Name**: Confirm and Pay Rural Rest
*   **Style**: Shadcn/UI Aesthetic (Clean Forms)

## 2. Key User Flows (Demonstrated)
1.  **Transparency First**:
    *   **Trip Details**: Clean card showing Dates (Oct 12-14) and Guests (1 Guest) with accessible "Edit" buttons.
2.  **Upsell Integration (Shadcn Style)**:
    *   **Add-on Card**: "Bul-meong Kit (+$20)" and "BBQ Set (+$30)" use standard Shadcn checkboxes.
    *   **Placement**: Positioned *before* the total calculation to encourage selection.
3.  **Clear Pricing**:
    *   **Line Items**: Room Rate, Service Fee, Add-ons clearly listed.
    *   **Total Highlighting**: Bold text for the final amount.
4.  **Trust Signals**:
    *   **Payment**: PayPal + Credit Card Radio Group.
    *   **Security**: "Your payment is secure" with a lock icon near the CTA.

## 3. Feedback & Improvements
### 3.1. Strengths (Keep)
*   **Readability**: The Inter font and clean borders (`border-slate-200`) make the numbers easy to read.
*   **Form Structure**: Separation of Trip Details, Add-ons, and Payment into distinct sections reduces cognitive load.
*   **CTA**: The Warm Brown "Confirm and Pay" button is prominent and inviting.

### 3.2. Issues & To-Do (Fix before Logic)
*   [ ] **Currency**: Ensure the currency symbol ($ vs ₩) matches the user's locale.
*   [ ] **Cancel Policy**: A link to the cancellation policy is still missing near the payment button.
*   [ ] **Guest Validation**: Need to ensure the "Edit" guest flow handles room capacity limits.

## 4. Next Step
*   Design the **Admin Dashboard (Host View)** to complete the V2 prototype set.

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 예약 및 결제 플로우 사이트맵 (Section 3.A.4)
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 시스템 및 폼 컴포넌트 가이드라인
- **Prototype**: [Property Detail Review](./01_DETAIL_PAGE_REVIEW.md) - 이전 단계 프로토타입
- **Prototype**: [Admin Dashboard Review](./03_ADMIN_DASHBOARD_REVIEW.md) - 다음 단계 프로토타입
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `bookings` 및 `activities` 테이블 구조
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Booking Process API 엔드포인트 (Section 3.4)
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
