# 00. Product Backlog & Implementation Status
> Created: 2026-02-07 17:34
> Last Updated: 2026-04-21 00:00

This document tracks the entire development progress. Tasks are moved from **Backlog** to **Current Sprint** and finally to **Completed** (archived).

## 0. 핵심 플로우 구현 현황

> 서비스 핵심 5단계 기준. 상세 내용: [23_BUSINESS_AND_SERVICE_OVERVIEW.md](../01_Concept_Design/23_BUSINESS_AND_SERVICE_OVERVIEW.md)

| 단계 | 내용 | 상태 | 주요 파일 |
|------|------|------|----------|
| 1. 숙소 등록 | 어드민 UI에서 신규 숙소 등록 | ✅ 완료 | `admin.listing.new.tsx` |
| 1. RWA 발행 | 온체인 SPL 토큰 mint 생성 | ✅ 완료 | `InitializePropertyButton` |
| 2. 토큰 구매 | 투자자 USDC → 에스크로, 토큰 수령 | ✅ 완료 | `/invest/:id`, `PurchaseCard` |
| 3A. 자금 해제 | funded → active 전환 | ✅ 완료 | `ReleaseFundsButton` |
| 3B. 환불 | 펀딩 실패 시 USDC 반환 | ✅ 완료 | `RefundButton` |
| 4. 예약/결제 | 날짜 선택, 카드/USDC 결제 | ✅ 완료 | `/book/:id` |
| 4. 체크인 | QR 디지털 키 | 🔲 Phase 2 | `03_DIGITAL_KEY_SYSTEM.md` |
| 5. 월 정산 | 3자 자동 분배 + 투자자 claim | ✅ 완료 | `/admin/settlements/:id` |

### 유저 여정별 미구현 항목

| 여정 | 미구현 항목 | 우선순위 |
|------|------------|---------|
| 여행자 | 예약 승인 알림 (이메일/푸시) | Phase 1 |
| 여행자 | 디지털 키(QR) 체크인 | Phase 2 |
| 투자자 | KYC 실제 신원 확인 (현재 시뮬레이션) | Phase 2 |
| 마을운영자 | 디지털 키 발송 연동 | Phase 2 |
| 어드민 | 숙소 등록 시 Google Geocoding API로 lat/lng 자동 저장 (현재 null → 지도 기본 좌표 표시) | Phase 1 |
| 어드민 | `api.admin.monthly-settlement.ts` 실제 `settle_listing_monthly` CPI 호출 + `settlements` 레코드 저장 | Phase 1 |
| 인프라 | devnet 배포 시 CRANK_SECRET_KEY 등 서버 키 관리 전략 수립 (mainnet 전 Squads multisig 전환 포함) | devnet 배포 전 |

---

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
*   [x] **Listing Create to DB**: `/admin/listing/new` — Daum 주소 검색, region 자동추출, DB INSERT, `/host/edit/:id` redirect. (`admin.listing.new.tsx`)
*   [x] **Listing Update to DB**: Admin Edit 페이지에서 폼 제출 시 `listings` 테이블에 update. (`admin.edit.tsx` loader + action + DB update 완료)

### Design System
*   [x] **Task 2.13**: Setup Shadcn/UI Components (Button, Card, Input, Dialog, ScrollArea, Avatar). → Button, Card, Input, Dialog, ScrollArea, Avatar, Toast 설치 완료 (`app/components/ui/`)
*   [x] Configure Tailwind Theme (Colors, Fonts). → `app.css` :root를 Warm Heritage(05_UI_DESIGN)에 맞춤 (Primary #8D6E63, Secondary #D7CCC8, Accent #FFAB91, Background #FAF9F6). `tailwind.config.js` fontFamily Noto Sans KR 반영, `root.tsx` 폰트 링크 추가

### Roadmap NOW (04_ROADMAP)
*   [x] **PayPal 결제 연동**: PayPal 인증 → 어드민 capture 구조 완료 (`api.paypal.create-order.ts`, `api.paypal.capture-auth.ts`, `book.tsx`)
*   [x] **Auto-Translation Chat**: 외국인 게스트용 자동 번역 채팅 (언어 장벽 제거) → Gemini 2.0 Flash 번역, `BookingChatPanel` 컴포넌트, `api/chat/messages` API 완료
*   [ ] **Transport Request (수동)**: Last Mile 교통 요청 기능, 초기에는 관리자 수동 처리

### Admin / Editor 보강
*   [x] **Admin Edit: 실시간 검증 및 미저장 경고**: 가격·최대 인원 등 Zod 실시간 검증, 이탈 시 미저장 경고 모달. → [05_ADMIN_EDITOR_REVIEW](../02_UI_Screens/05_ADMIN_EDITOR_REVIEW.md) §3.2

### RWA

#### 완료 (2026-03-24)
*   [x] **DB 스키마 확장**: `rwa_tokens` (estimated_apy_bps 포함), `rwa_investments`, `rwa_dividends`, `operator_settlements` 테이블 추가
*   [x] **listings 확장**: `operator_id` (마을 운영자 FK), `region` 컬럼 추가
*   [x] **user.role 확장**: `operator` 역할 추가 (guest/host/operator/admin)
*   [x] **SPV 구조 확정**: 1 빈집 = 1 SPV(host) = 1 Token Mint / 마을 운영자(operator) 분리 / 영업이익 40-30-30 온체인 배분
*   [x] **경주 파일럿 seed**: `web/scripts/seed.ts` — SPV 5개, 운영자 5명, listings 5채, rwa_tokens 5개 (실데이터 기반)
*   [x] **drizzle-kit push** (local.db 반영)

#### 완료 (2026-03-30)
*   [x] **Anchor 프로그램 9개 instruction 구현**: initialize_property, open_position, purchase_tokens, release_funds, cancel_position, refund, activate_property, distribute_monthly_revenue, claim_dividend
*   [x] **Anchor localnet 테스트 완료**: 34개 테스트 케이스 + E2E 스크립트 12개
*   [x] **`/admin/tokenize`**: 호스트 토큰화 신청 폼 (InitializePropertyButton 연동)
*   [x] **투자 매수/취소/환불 UI**: PurchaseCard, CancelPositionButton, RefundButton
*   [x] **배당 분배/수령 UI**: MonthlySettlementButton (온체인), ClaimButton
*   [x] **3자 정산 아키텍처**: 지자체 40% + 운영자 30% + 투자자 30%

#### 완료 (2026-04-09) — 예약 플로우 버그 수정
*   [x] **USDC 예약 거절 시 에스크로 환불**: `api.booking.reject.ts` — `cancelBookingEscrow` CPI 추가 (기존: DB만 cancelled, 에스크로 자금 방치)
*   [x] **USDC 결제 완료 후 redirect**: `book.tsx` — `txState="done"` 인라인 화면 제거, `/book/success` redirect로 통일
*   [x] **게스트 pending 취소**: `api.booking.guest-cancel.ts` 신규 + `my-bookings.tsx` "신청 취소" 버튼 추가
*   [x] **취소 상태 환불 안내**: `my-bookings.tsx` — cancelled 예약에 "카드 환불 완료" / "USDC 에스크로 환불 완료" 표시
*   [x] **카드 예약 completed 전환**: `api.booking.release-escrow.ts` — 카드 결제도 처리 (기존: USDC 전용, 카드 예약은 confirmed에서 stuck)
*   [x] **정산 완료 버튼**: `host.bookings.tsx` confirmed 탭 — 체크아웃 지난 예약에 "정산 완료" 버튼 추가

#### 완료 (2026-04-09)
*   [x] **`/invest` loader DB 전환**: listings JOIN rwa_tokens 쿼리 완료
*   [x] **`/invest/:id` loader DB 전환**: 개별 토큰 상세 + 투자 현황 쿼리 완료
*   [x] **`/my-investments` loader DB 전환**: 유저별 rwa_investments + rwa_dividends 쿼리 완료
*   [x] **어드민 운영자 관리**: 목록·생성·이름수정·삭제 (`admin.operators.tsx`)
*   [x] **어드민 정산 현황 목록**: 토큰화 매물별 정산 현황 페이지 (`admin.settlements.tsx`)

#### 완료 (2026-04-17) — Treasury / 에스크로 정산 / 환불 정책
*   [x] **setup-devnet.ts `setTreasury()` 누락 수정 (P0)**: `rwa_config.treasury` 미설정으로 에스크로 릴리스 불가 버그 수정
*   [x] **Admin Treasury UI** (`/admin/treasury`): Treasury pubkey, 누적 수수료, 내역 테이블
*   [x] **Anchor `cancelBookingEscrowPartial` instruction**: 50% 부분환불 온체인 분배 (guest_bps, error 6025 InvalidRefundBps)
*   [x] **확정 예약 취소 환불 정책**: 7일↑ 100% / 3~7일 50% / 3일↓ 0% (`api.booking.cancel-confirmed.ts`)
*   [x] **USDC 에스크로 취소**: cancelBookingEscrow(100%) / cancelBookingEscrowPartial(50%) / releaseBookingEscrow(0%)
*   [x] **카드(PayPal) 부분환불**: `paypalCaptureId` DB 저장 + `refundPayPalCapture()` 전액/부분 환불 API
*   [x] **게스트 / 호스트 확정 예약 취소 버튼 UI**: `my.bookings.tsx`, `host.bookings.tsx`
*   [x] **`escrow-release.server.ts` 공통 함수**: 수동 API + Cron 공유
*   [x] **Vercel Cron Jobs**: 매일 12:00 KST 에스크로 자동 릴리스 + RWA 활성화 (`vercel.json`)
*   [x] **Vitest 환불 정책 테스트**: 16개 경계값 포함 100% 통과
*   [x] **Anchor 시나리오 F 테스트**: create / cancel(100%) / cancelPartial(50%) / 에러케이스 추가

#### 다음 단계
*   [ ] **Anchor 테스트 F-1~F-6 통과 확인**: `rm -rf test-ledger && anchor test -- --features rural-rest-rwa/skip-oracle`
*   [ ] **Anchor Devnet 배포**: devnet E2E 테스트 (발행→구매→수익→배당)
*   [ ] **Vercel 배포 후 Cron Job 등록 확인**: Vercel 대시보드 → Settings → Cron Jobs
*   [x] **RWA Entry Hooks**: 숙소 상세 "이 집의 한 조각 소유하기" 배너/버튼 → `/invest/:id` 연결 완료

#### Phase 1 — Treasury 구조 전환 (정책: `15_REFUND_AND_TREASURY_POLICY.md`)

**완료 (2026-04-21)**
*   [x] **`cancel-confirmed.ts` 0% 환불 status 버그**: `refundBps===0`일 때 `completed`로 저장
*   [x] **Anchor `ListingVault` PDA + `settle_listing_monthly`**: 90% → listing_vault 전송, 월정산 시 40/30/30 분배. IDL 재생성
*   [x] **`release_booking_escrow` 체크아웃 시점 버그**: `check_in` → `check_out` 비교로 수정
*   [x] **`cancel_booking_escrow_partial` listing_vault 전환**: 호스트 직접 수령 → `listing_vault_ata`로 교체 (40/30/30 분배 포함)
*   [x] **`escrow-release.server.ts` listing_vault 전환**: `hostUsdc` → `listingVault` + `listingVaultAta`
*   [x] **`cancel-confirmed.ts` listing_vault 전환**: 50% 부분취소 호스트 몫도 `listing_vault_ata`로 교체
*   [x] **DB 마이그레이션**: `listings.govWalletAddress`, `settlements` 테이블 신규 (`drizzle-kit push` 완료)
*   [x] **Anchor 테스트 G 시나리오**: `settle_listing_monthly` 5개 케이스 (정상/AlreadySettled/InsufficientVault/Unauthorized/InvalidBpsSum)
*   [x] **시나리오 스크립트 06-booking.ts**: listing_vault 전환 + `initializeListingVault` 추가

**남은 작업 (Phase 1 완료 조건)**
*   [ ] **Anchor 빌드·테스트 통과**: `anchor build && anchor test -- --features skip-oracle`
*   [ ] **`api.admin.monthly-settlement.ts` 실 CPI 호출**: 현재 계산만 존재 → 실제 `settle_listing_monthly` 호출 + `settlements` 레코드 저장
*   [ ] **환불 3단계 E2E**: 100%/50%/0% USDC 경로 검증 (`06-booking.ts` 재실행)
*   [ ] **월정산 E2E**: `settlements` 레코드 생성 + 투자자 `claim_dividend` 수령 금액 일치 확인

---

## Phase 2 — devnet 이후 (MVP 이후 확장)

| 항목 | 설명 |
|------|------|
| 디지털 키(QR) 체크인 | 스마트락 연동, 마을운영자 발송 UI |
| KYC 실제 신원 확인 | 현재 시뮬레이션 → 실제 인증 서비스 연동 |
| Squads Multisig | Authority → M-of-N multisig 전환 (mainnet 전) |
| Transport Request | 라스트 마일 교통 수동 요청 기능 |
| 예약 승인 알림 | 이메일/푸시 알림 (게스트 체크인 알림 포함) |
| Helius Webhook | Blinks 투자 DB 자동 기록 (현재 수동 동기화) |
| 지자체 KRW 정산 | USDC → KRW 출금 프로세스 (거래소 연동 or 수동) |

---

### DAO (커스텀 Anchor -- Realms 대체, 08_DAO_IMPLEMENTATION_SPEC)
*   [x] **Anchor DAO 프로그램**: `rural-rest-dao` 5개 instruction 구현 완료 (Program ID: `3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX`)
*   [x] **Council Token**: Token-2022 NonTransferable Mint 생성 완료 (`FEDWxrjgozxhXFN8N8fy4XhrAJEbdQQb9xRJpNwYbtKq`), Admin 발급 UI 추가 (header 버튼 → Sheet)
*   [ ] **Squads Multisig**: M-of-N 생성 + Council Mint Authority 이전 (mainnet 전환 시)
*   [x] **Devnet 배포**: DAO 프로그램 + `initialize_dao` + RwaConfig 초기화 완료 (DaoConfig PDA: `C7ovfgZkJLbDAn5bs4gQtVT2dENosmfi58DmFvufBWiH`)
*   [x] **웹 UI**: `/governance/:id` 투표 UI 완료 (제안 목록/투표/생성)
*   [x] **Governance Blinks**: `/api/actions/governance/:proposalId` 구현 완료 — Phantom/Dialect에서 직접 투표 가능. 투자자 보유 포지션을 서버사이드 조회해 `remaining_accounts`로 전달, KYC 게이트 포함

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
- **RWA**: [RWA Issuance Spec](../03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md), [RWA Issuance Plan](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md)
- **DAO**: [DAO Implementation Spec](../03_Technical_Specs/08_DAO_IMPLEMENTATION_SPEC.md), [DAO Governance Plan](../01_Concept_Design/14_DAO_GOVERNANCE_PLAN.md)
