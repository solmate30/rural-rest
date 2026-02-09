# 02. Booking & Payment Page Review (V2)
> Created: 2026-02-07 17:01
> Last Updated: 2026-02-09 22:00

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

## 4. MVP Implementation Status (2026-02-09)

V2 프로토타입의 예약 페이지가 동적 데이터 기반 MVP로 구현 완료되었다.

**구현 파일**: `web/app/routes/book.tsx` (57줄 정적 목업 -> 324줄 동적 페이지)

### 4.1. 구현된 기능

| 기능 | 프로토타입 (V2) | MVP 구현 |
|:---|:---|:---|
| 날짜 선택 | 하드코딩 ("May 12-15") | `type="date"` 동적 입력 (min 제약 포함) |
| 인원 선택 | 하드코딩 ("2 guests") | `<select>` (1 ~ maxGuests 동적 생성) |
| 가격 계산 | 하드코딩 ("360,000") | 실시간 계산 (nights x pricePerNight) |
| 숙소 정보 | 하드코딩 ("Grandma's Stone House") | loader에서 Mock 데이터 동적 조회 |
| 인증 | 없음 | `requireUser(request)` -- 비로그인 시 `/auth` 리다이렉트 |
| 폼 제출 | 없음 (정적 버튼) | `<Form method="post">` + action 검증 |
| 성공 확인 | 없음 | 같은 페이지 내 Confirmation UI 전환 |
| Transport Concierge | 없음 | 무료 셔틀 배너 + 픽업 포인트 목록 |

### 4.2. 검증 로직 (Action)

서버 사이드 폼 검증 4종이 구현됨:
1. 필수 필드 누락 검사
2. 체크아웃이 체크인 이후인지 검사
3. 과거 날짜 선택 방지
4. 최대 인원 초과 검사

### 4.3. 프로토타입 대비 미구현 항목

*   [ ] **Add-on Cards**: Bul-meong Kit, BBQ Set 등 부가서비스 선택 UI (향후 구현)
*   [ ] **Payment Method**: PayPal/Credit Card 선택 UI (Mock 단계에서 불필요)
*   [ ] **Cancel Policy Link**: 취소 정책 링크 (정책 문서 확정 후 추가)
*   [x] **Currency**: KRW(원) 통화 적용 완료
*   [x] **Guest Validation**: maxGuests 기반 인원 제한 구현 완료

### 4.4. DB 교체 용이성

| Mock 요소 | 실제 DB 교체 시 | 교체 범위 |
|:---|:---|:---|
| `getListingById` (Mock) | `db.query.listings.findFirst()` | loader 내부 1줄 |
| action return (Mock 응답) | `db.insert(bookings).values(...)` | action 내부 교체 |
| `crypto.randomUUID()` | DB auto-generated UUID | 동일 |
| `actionData.booking` | redirect to `/trips/:id` | 성공 후 처리 교체 |

## 5. Next Step
*   Add-on 부가서비스 UI 추가 (Activity 연동)
*   결제 수단 선택 UI (Stripe/PayPal 통합 시)
*   취소 정책 안내 링크 추가

## 6. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 예약 및 결제 플로우 사이트맵 (Section 3.A.4)
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 시스템 및 폼 컴포넌트 가이드라인
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 게스트 시나리오 Step 3 (원스톱 예약 및 Add-ons)
- **Prototype**: [Property Detail Review](./01_DETAIL_PAGE_REVIEW.md) - 이전 단계 프로토타입
- **Prototype**: [Admin Dashboard Review](./03_ADMIN_DASHBOARD_REVIEW.md) - 다음 단계 프로토타입
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `bookings` 및 `activities` 테이블 구조
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - Booking Process API 엔드포인트 (Section 3.4)
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 셔틀 서비스 예약 로직 (Step 3: Transport Option)
