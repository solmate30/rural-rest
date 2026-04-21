# Booking State Machine Design
> Created: 2026-02-07 18:00
> Last Updated: 2026-02-09 22:00

## 1. Context
예약(Booking) 상태 관리는 Rural Rest 플랫폼의 핵심 비즈니스 로직입니다. 게스트가 예약을 생성한 후부터 체크아웃 완료까지의 전체 생명주기를 관리하며, 호스트의 승인/거절, 취소 정책, 결제 상태 등을 추적합니다.

**관련 UI**: Property Detail Page → Booking Flow → My Trips Page → Admin Dashboard

## 1.1. MVP 구현 상태 (2026-02-09)

Booking Flow MVP가 `web/app/routes/book.tsx`에 구현되었다. 현재는 Mock 데이터 기반이며 DB insert 없이 action이 성공 응답을 반환한다.

**구현된 상태 전이:**
```
Guest -> POST /book/:id -> action 검증 통과 -> { success: true, booking: { status: "pending" } }
```

**구현된 검증 로직 (action):**
1. `requireUser(request)` -- 비인증 사용자 `/auth` 리다이렉트
2. 필수 필드 검사 (checkIn, checkOut, guests)
3. 날짜 순서 검사 (checkIn < checkOut)
4. 과거 날짜 방지 (checkIn >= today)
5. 최대 인원 검사 (guests <= listing.maxGuests)

**Mock-to-Real 전환 시 필요한 작업:**
- action 내부에서 `db.insert(bookings).values(...)` 호출 추가
- 가용성 검사 (checkAvailability) 추가
- 호스트 알림 로직 추가
- 성공 시 redirect to `/trips/:id` 또는 별도 Confirmation 페이지로 전환

## 2. Business Rules
- [ ] **Rule 1**: 게스트는 예약 생성 시 즉시 `pending` 상태로 시작 (호스트 승인 필요)
- [ ] **Rule 2**: 호스트는 24시간 이내 승인/거절 결정 필요 (미응답 시 자동 거절)
- [ ] **Rule 3**: 확정 예약 취소 환불 정책 — 체크인 7일 이상 전 100%, 3~7일 전 50%, 3일 미만 0%. 0% 환불 시 `status = completed`(운영자·투자자 수익 귀속). 상세: `docs/04_Logic_Progress/15_REFUND_AND_TREASURY_POLICY.md`
- [ ] **Rule 4**: 결제는 호스트 승인 후에만 처리 (Pending → Confirmed 전환 시)
- [ ] **Rule 5**: 체크아웃 후 7일 이내 리뷰 작성 가능 (Completed 상태에서만)

## 3. State Machine Diagram

```
[Initial] → pending → confirmed → completed
              ↓          ↓
           cancelled  cancelled
```

### State Definitions

| State | Description | Who Can Trigger | Next Possible States |
|-------|-------------|----------------|---------------------|
| `pending` | 예약 요청 생성됨, 호스트 승인 대기 | Guest (생성) | `confirmed`, `cancelled` |
| `confirmed` | 호스트 승인 완료, 결제 처리됨 | Host (승인) | `completed`, `cancelled` |
| `cancelled` | 예약 취소됨 (게스트 또는 호스트) | Guest/Host | (Terminal) |
| `completed` | 체크아웃 완료, 예약 종료 | System (자동) | (Terminal) |

## 4. 핵심 플로우 및 구현 위치

| 플로우 | 구현 파일 | 요약 |
|--------|-----------|------|
| 예약 생성 | `web/app/routes/book.tsx` | Zod 검증 → 가용성 체크 → `pending` 생성 → 호스트 알림 |
| 호스트 승인 | `web/app/routes/api.booking.approve.ts` | 소유권 검증 → 결제 처리 → `confirmed` 전환 → 게스트 알림 |
| 확정 예약 취소 | `web/app/routes/api.booking.cancel-confirmed.ts` | 체크인까지 남은 시간으로 환불율 결정 (7/3/0) → USDC 에스크로 또는 PayPal 환불 → `cancelled` (0% 환불은 `completed`) |
| 자동 완료 | `web/app/routes/api.cron.escrow-release.ts` | 매일 12:00 KST, 체크아웃 경과한 `confirmed`를 `completed` + 에스크로 릴리스 |

자금 분배 상세: `docs/04_Logic_Progress/15_REFUND_AND_TREASURY_POLICY.md`

## 5. Edge Cases & Error Handling

### 5.1. Error Scenarios & User Feedback
모든 에러 상황은 Toast 컴포넌트를 통해 사용자에게 명확한 피드백을 제공합니다.

- **Race Condition**: 동시 예약 시도 시 마지막 체크에서 재검증
    *   **에러 처리**: Toast로 "다른 사용자가 먼저 예약했습니다. 다른 날짜를 선택해주세요" 메시지 표시
- **Payment Failure**: 결제 실패 시 `pending` 상태 유지, 게스트에게 재시도 알림
    *   **에러 처리**: Toast로 "결제에 실패했습니다. 결제 정보를 확인하고 다시 시도해주세요" 메시지 표시
    *   **액션**: 재시도 버튼 제공
- **Host No Response**: 24시간 미응답 시 자동 거절 및 게스트 알림
    *   **에러 처리**: Toast로 "호스트가 24시간 내 응답하지 않아 예약이 자동으로 취소되었습니다" 메시지 표시
- **Double Booking**: Availability check를 DB 트랜잭션 내에서 수행
    *   **에러 처리**: Toast로 "선택하신 날짜는 이미 예약되었습니다. 다른 날짜를 선택해주세요" 메시지 표시
- **Validation Error**: 날짜, 인원수 등 입력값 유효성 검사 실패
    *   **에러 처리**: 폼 필드 인라인 에러 메시지 + Toast로 "입력 정보를 확인해주세요" 메시지 표시

## 6. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 예약 플로우 사이트맵 (Section 3.A.4)
- **Foundation**: [Happy Path Scenarios](../01_Concept_Design/07_HAPPY_PATH_SCENARIOS.md) - 게스트 시나리오 Step 4, 호스트 시나리오 Step 2 (예약 승인)
- **Prototype**: [Booking Page Review](../02_UI_Screens/02_BOOKING_PAGE_REVIEW.md) - 예약 페이지 UI 프로토타입
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트 승인/거절 UI 프로토타입
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - `bookings` 테이블 구조 및 상태 필드
- **Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - Booking Process API 엔드포인트 (Section 3.4) 및 에러 핸들링 전략 (Section 4)
- **Foundation**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - Toast 컴포넌트 디자인 가이드라인 (Section 5.3)
- **Logic**: [Auth & Session](./06_AUTH_AND_SESSION_LOGIC.md) - 예약 생성 시 인증 검증 로직 (Unauthorized 처리)
- **Test**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 예약 관련 테스트 케이스 (Section 2.2, 3.1) 및 에러 핸들링 테스트 (Section 4)
