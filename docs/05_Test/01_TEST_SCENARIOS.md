# Test Scenarios & User Journey Tests
> Created: 2026-02-07 18:00
> Last Updated: 2026-02-08 00:20

## 1. Overview
이 문서는 Rural Rest 플랫폼의 주요 사용자 시나리오에 대한 테스트 케이스를 정의합니다. End-to-End 사용자 여정을 중심으로 작성되었으며, 각 Phase별 핵심 기능의 정상 작동 여부를 검증합니다.

## 2. Authentication & Session Tests

### 2.1. Login & Sign Up Flow
**시나리오**: 사용자가 로그인 및 회원가입을 수행하고 적절한 피드백을 받습니다.

**테스트 케이스**:
- [ ] **TC-A-001**: 이메일/비밀번호 로그인 성공 시 Toast로 "로그인되었습니다" 메시지 표시
- [ ] **TC-A-002**: 이메일/비밀번호 로그인 실패 시 Toast로 "이메일 또는 비밀번호가 올바르지 않습니다" 메시지 표시
- [ ] **TC-A-003**: 회원가입 성공 시 Toast로 "회원가입 완료" 메시지 표시
- [ ] **TC-A-004**: 회원가입 실패 시 (이메일 중복 등) Toast로 적절한 에러 메시지 표시
- [ ] **TC-A-005**: Google 소셜 로그인 성공 시 Toast로 "로그인되었습니다" 메시지 표시
- [ ] **TC-A-006**: Kakao 소셜 로그인 성공 시 Toast로 "로그인되었습니다" 메시지 표시
- [ ] **TC-A-007**: 소셜 로그인 실패 시 Toast로 "소셜 로그인에 실패했습니다" 메시지 표시
- [ ] **TC-A-008**: 로그아웃 성공 시 Toast로 "로그아웃되었습니다" 메시지 표시
- [ ] **TC-A-009**: 로그인 성공 Toast는 3-5초 후 자동으로 사라짐
- [ ] **TC-A-010**: 로그인 실패 Toast는 사용자가 수동으로 닫을 때까지 유지됨

**검증 포인트**:
- Toast 메시지가 적절한 위치에 표시됨 (우측 상단 또는 하단)
- Toast 메시지가 한글로 표시됨
- 성공/실패에 따른 Toast 색상 구분 (Success: default, Error: destructive)

## 3. Guest User Journey Tests

### 3.1. Search & Discovery Flow
**시나리오**: 게스트가 랜딩 페이지에서 숙소를 검색하고 상세 정보를 확인합니다.

**테스트 케이스**:
- [ ] **TC-G-001**: 랜딩 페이지 로드 시 Hero 섹션과 Featured Listings가 정상 표시됨
- [ ] **TC-G-002**: 검색 바에서 위치, 날짜, 인원수 입력 후 검색 버튼 클릭 시 결과 페이지로 이동
- [ ] **TC-G-003**: 검색 결과 페이지에서 필터 적용 (가격 범위, 룸 타입) 시 결과가 즉시 업데이트됨
- [ ] **TC-G-004**: 검색 결과가 없을 때 "No results found" 메시지와 대안 제안 표시
- [ ] **TC-G-005**: 프로퍼티 카드 클릭 시 상세 페이지로 정상 이동

**검증 포인트**:
- 모든 페이지 진입 가능 (No 404/White Screen)
- Empty State UI 깨짐 없음
- 로딩 상태 적절히 표시됨

### 3.2. Property Detail & Booking Flow
**시나리오**: 게스트가 숙소 상세 정보를 확인하고 예약을 진행합니다.

**테스트 케이스**:
- [ ] **TC-G-006**: 프로퍼티 상세 페이지에서 이미지 갤러리 모달 정상 작동
- [ ] **TC-G-007**: 날짜 선택 시 예약 불가능한 날짜는 비활성화됨
- [ ] **TC-G-008**: 인원수 선택 시 `max_guests` 제한 초과 시 에러 메시지 표시
- [ ] **TC-G-009**: Add-on 활동 선택 (Bul-meong Kit 등) 시 총 가격이 실시간 업데이트됨
- [ ] **TC-G-010**: 로그인하지 않은 상태에서 예약 시도 시 로그인 페이지로 리다이렉트
- [ ] **TC-G-011**: 예약 생성 후 "My Trips" 페이지에서 예약 내역 확인 가능

**검증 포인트**:
- 폼 유효성 검사 정상 작동 (Zod 스키마)
- 에러 발생 시 사용자에게 적절한 피드백 제공
- 결제 프로세스 (Stripe/PayPal) 정상 작동

### 3.3. Communication Flow
**시나리오**: 게스트가 호스트와 자동 번역 채팅을 통해 소통합니다.

**테스트 케이스**:
- [ ] **TC-G-012**: Auto-Translation Chat에서 한국어 입력 시 영어로 번역되어 호스트에게 전달
- [ ] **TC-G-013**: 호스트 응답이 게스트 언어로 자동 번역되어 표시됨
- [ ] **TC-G-014**: 채팅 히스토리가 예약별로 올바르게 그룹화됨

## 4. Host User Journey Tests

### 3.1. Dashboard & Management Flow
**시나리오**: 호스트가 대시보드에서 예약을 관리하고 활동을 생성합니다.

**테스트 케이스**:
- [ ] **TC-H-001**: 호스트 대시보드 로드 시 Revenue, Occupancy, Check-in, Pending 메트릭 정상 표시
- [ ] **TC-H-002**: Pending 예약 목록에서 승인/거절 버튼 클릭 시 상태 변경됨
- [ ] **TC-H-003**: 예약 승인 시 결제 프로세스 자동 트리거됨
- [ ] **TC-H-004**: Activity Manager에서 새 활동 생성 시 목록에 추가됨
- [ ] **TC-H-005**: 활동 참가자 수가 `max_participants` 제한을 초과하지 않음

**검증 포인트**:
- 권한 검사 로직 정상 작동 (Guest는 호스트 대시보드 접근 불가)
- 데이터 실시간 업데이트 (WebSocket 또는 Polling)

### 3.2. Property Management Flow
**시나리오**: 호스트가 자신의 숙소 정보를 관리합니다.

**테스트 케이스**:
- [ ] **TC-H-006**: 프로퍼티 정보 수정 시 변경사항이 즉시 반영됨
- [ ] **TC-H-007**: 이미지 업로드 시 Cloudinary Signed Upload 정상 작동
- [ ] **TC-H-008**: 가격 캘린더에서 날짜별 가격 설정 가능
- [ ] **TC-H-009**: 프로퍼티 비활성화 시 검색 결과에서 제외됨

## 4. Integration Tests

### 4.1. Payment Integration
**시나리오**: 결제 프로세스가 정상적으로 작동합니다.

**테스트 케이스**:
- [ ] **TC-P-001**: Stripe 결제 성공 시 예약 상태가 `confirmed`로 변경됨
- [ ] **TC-P-002**: 결제 실패 시 예약 상태는 `pending` 유지, 게스트에게 재시도 알림
- [ ] **TC-P-003**: 취소 정책에 따라 환불 금액이 올바르게 계산됨 (24시간 전 무료 취소)

### 4.3. Transport & Logistics
**시나리오**: 교통 서비스 예약 및 정보 전달이 정상적으로 작동합니다.

**테스트 케이스**:
- [ ] **TC-L-001**: 예약 과정에서 셔틀 서비스 선택 시 요청 내역이 `transport_requests` 테이블에 정상 저장됨
- [ ] **TC-L-002**: 도보 이동 거리 및 셔틀 소요 시간 정보가 상세 페이지에 정확히 노출됨
- [ ] **TC-L-003**: 호스트 대시보드의 'Upcoming Arrivals' 목록에 셔틀 요청 시간과 인원이 표시됨

### 4.2. Database Integration
**시나리오**: 데이터베이스 작업이 정상적으로 수행됩니다.

**테스트 케이스**:
- [ ] **TC-D-001**: 예약 생성 시 Race Condition 방지 (동시 예약 시도)
- [ ] **TC-D-002**: 날짜 범위 검색 시 중복 예약 방지 로직 정상 작동
- [ ] **TC-D-003**: 리뷰 작성 시 `booking.status === 'completed'` 조건 검증

## 5. Error Handling Tests

### 5.1. Validation Errors
**시나리오**: 잘못된 입력에 대해 적절한 에러 메시지가 표시됩니다.

**테스트 케이스**:
- [ ] **TC-E-001**: 날짜 범위가 잘못된 경우 (checkOut < checkIn) Zod 검증 에러 표시
- [ ] **TC-E-002**: 필수 필드 누락 시 인라인 에러 메시지 표시
- [ ] **TC-E-003**: 이메일 형식이 잘못된 경우 유효성 검사 에러 표시

### 6.2. System Errors
**시나리오**: 시스템 오류 발생 시 사용자에게 적절한 피드백이 제공됩니다.

**테스트 케이스**:
- [ ] **TC-E-004**: 401 Unauthorized 시 로그인 페이지로 리다이렉트
- [ ] **TC-E-005**: 페이지 레벨 404 (존재하지 않는 라우트) 시 ErrorBoundary에서 "404 - 페이지를 찾을 수 없습니다" 에러 페이지 표시
- [ ] **TC-E-005-2**: API 리소스 404 (존재하지 않는 property ID 등) 시 Toast로 "요청한 리소스를 찾을 수 없습니다" 메시지 표시
- [ ] **TC-E-006**: 500 Server Error 시 Toast로 "서버 오류가 발생했습니다" 메시지 표시
- [ ] **TC-E-007**: API 에러 응답 시 Toast 컴포넌트가 적절한 위치에 표시됨 (우측 상단 또는 하단)
- [ ] **TC-E-008**: 에러 Toast는 사용자가 수동으로 닫을 때까지 유지됨
- [ ] **TC-E-009**: 성공 Toast는 3-5초 후 자동으로 사라짐
- [ ] **TC-E-010**: Toast 메시지는 한글로 표시되며 사용자가 이해하기 쉬운 문구 사용

## 7. Performance Tests

### 6.1. Load Tests
**시나리오**: 다수의 동시 사용자 요청을 처리할 수 있습니다.

**테스트 케이스**:
- [ ] **TC-PF-001**: 검색 결과 페이지 로드 시간 < 2초 (50개 결과 기준)
- [ ] **TC-PF-002**: 동시 예약 시도 100건 처리 시 Race Condition 없음
- [ ] **TC-PF-003**: 이미지 로딩 시 Cloudinary 최적화 적용 (WebP, 자동 리사이즈)

## 7. Browser Compatibility Tests

**테스트 케이스**:
- [ ] **TC-B-001**: Chrome 최신 버전에서 모든 기능 정상 작동
- [ ] **TC-B-002**: Safari 최신 버전에서 모든 기능 정상 작동
- [ ] **TC-B-003**: Firefox 최신 버전에서 모든 기능 정상 작동
- [ ] **TC-B-004**: 모바일 Safari (iOS)에서 반응형 레이아웃 정상 작동
- [ ] **TC-B-005**: 모바일 Chrome (Android)에서 반응형 레이아웃 정상 작동

## 8. Test Execution Checklist

### Phase 1: Foundation & Prototype
- [ ] 모든 문서 작성 완료 확인
- [ ] 프로토타입 리뷰 완료 확인

### Phase 2: Specs & Logic
- [ ] 데이터베이스 스키마 구현 완료 확인
- [ ] API 엔드포인트 구현 완료 확인
- [ ] 비즈니스 로직 구현 완료 확인

### Phase 3: Integration & QA
- [ ] 모든 테스트 케이스 실행
- [ ] 콘솔 에러 로그 확인 (심각한 에러 부재)
- [ ] 실제 브라우저 환경에서 End-to-End 테스트 수행

## 9. Test Results Tracking

**테스트 실행 기록**:
- 실행 일시: [YYYY-MM-DD HH:mm]
- 테스트 환경: [Local/Staging/Production]
- 통과율: [X%]
- 발견된 이슈: [링크 또는 참조]

## 11. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 사용자 플로우 및 사이트맵 (테스트 시나리오 기반)
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 본 테스트 케이스의 기준이 되는 핵심 사용자 여정
- **Prototype**: [Landing Page Review](../02_Prototype/00_LANDING_PAGE_REVIEW.md) - 랜딩 페이지 테스트 대상
- **Prototype**: [Property Detail Review](../02_Prototype/01_DETAIL_PAGE_REVIEW.md) - 프로퍼티 상세 페이지 테스트 대상
- **Prototype**: [Booking Page Review](../02_Prototype/02_BOOKING_PAGE_REVIEW.md) - 예약 페이지 테스트 대상
- **Prototype**: [Admin Dashboard Review](../02_Prototype/03_ADMIN_DASHBOARD_REVIEW.md) - 호스트 대시보드 테스트 대상
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - 데이터베이스 통합 테스트 참조
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - API 엔드포인트 테스트 참조
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직 테스트 참조
- **Logic**: [Search Algorithm](../04_Logic/02_SEARCH_ALGORITHM.md) - 검색 알고리즘 테스트 참조
- **Logic**: [Translation Engine](../04_Logic/04_TRANSLATION_ENGINE.md) - 자동 번역 채팅 테스트 참조
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 서비스 예약 테스트 참조
- **Logic**: [Auth & Session](../04_Logic/06_AUTH_AND_SESSION_LOGIC.md) - 로그인/로그아웃 플로우 및 Toast 메시지 정의 (Section 4.4), 권한 검증 테스트 참조 (TC-G-010, TC-E-004)
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 에러 핸들링 테스트 참조 (Section 5.1)
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - Toast 컴포넌트 디자인 가이드라인 (Section 5.3)
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - 에러 핸들링 전략 및 Toast 사용 가이드 (Section 4)
- **Test**: [QA Checklist](./02_QA_CHECKLIST.md) - 릴리스 기준 및 체크리스트
