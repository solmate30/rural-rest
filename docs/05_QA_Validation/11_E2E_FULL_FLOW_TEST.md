# E2E Full Flow Test
> Created: 2026-04-16 00:00
> Last Updated: 2026-04-21 20:00

전체 플로우를 처음부터 끝까지 검증하는 E2E 테스트 시나리오.  
**로컬 노드(localnet) 기준**으로 작성됨. devnet 전환 방법은 맨 아래 참고.

---

## 0. 로컬 환경 셋업 (최초 1회 + validator 리셋 후마다)

### 0-1. Solana Test Validator 시작

```bash
solana-test-validator --reset
```

### 0-2. Anchor 프로그램 빌드 & 배포

```bash
cd ~/solana/rural-rest/anchor
anchor build -- --features rural-rest-rwa/skip-oracle
anchor deploy --provider.cluster localnet
cp target/idl/rural_rest_rwa.json ../web/app/anchor-idl/
```

> `--features` 없이 빌드하면 `create_booking_escrow` 호출 시 `InvalidPythPrice` 에러

### 0-3. 온체인 초기화 (Mint + RwaConfig + DaoConfig)

```bash
cd ~/solana/rural-rest/web
npx tsx scripts/setup-localnet.ts
```

### 0-4. 테스트 DB 및 매물 데이터 준비

```bash
cd ~/solana/rural-rest/web
npx tsx scripts/seed-test-listing.ts
```

### 0-5. 개발 서버 실행

```bash
cd ~/solana/rural-rest/web
npm run dev
```

### 0-6. 환경 변수 확인

| 변수 | localnet 값 |
|------|-------------|
| `VITE_SOLANA_RPC` | `http://127.0.0.1:8899` |
| `VITE_SOLANA_NETWORK` | `localnet` |
| `VITE_USDC_MINT` | setup-localnet.ts 실행 후 자동 업데이트 |
| `PAYPAL_MODE` | `sandbox` |

---

## 1. 어드민 플로우

### TC-ADMIN-01: 매물 등록 ✅
**계정**: admin  
**경로**: `/admin/listing/new`

- [x] 6단계 폼 완성 후 제출
- [x] `/admin` 대시보드에서 매물 표시 확인

### TC-ADMIN-02: RWA 토큰화 ✅
**경로**: `/admin` → 매물 클릭 → "토큰 발행"

- [x] 평가액, 최소 모집률, 마감일 입력 → "토큰 발행" 클릭 → 서명
- [x] 상태 "펀딩 중" 전환 확인
- [x] `/admin/settlements` 에서 해당 매물 표시 확인

### TC-ADMIN-03: 운영자 등록 + Council Token 발급
**경로**: `/admin/operators` → `/admin/council-token`

- [x] 운영자 계정 생성 (지갑 주소 입력)
- [x] `/admin/council-token` → 해당 운영자 선택 → "발급" → 서명
- [x] 온체인 Council Token 잔액 확인

---

## 2. 투자자 플로우

### TC-INVEST-01: RWA 토큰 구매 ✅
**계정**: 게스트 (Privy 로그인)  
**경로**: `/invest` → 매물 선택 → `/invest/[id]`

전제: TC-ADMIN-02 완료, 투자자 지갑 USDC 충전 (`/dev/faucet`)

- [x] USDC 잔액 표시 확인
- [x] 수량 입력 → "투자하기" → 서명
- [x] `/my/portfolio` 에서 투자 내역 확인

---

## 3. 예약 플로우

### TC-BOOK-01: 예약 생성 — PayPal 카드 결제
**계정**: 게스트  
**경로**: `/property/[id]` → 날짜 선택 → "결제하기"

- [x] 날짜 선택 → PayPal sandbox 결제 완료 → `/book/success` 리다이렉트
- [ ] `/my/bookings` 에서 "승인 대기" 표시 확인

### TC-BOOK-02: 예약 생성 — USDC 에스크로 결제
**계정**: 게스트  
**경로**: `/property/[id]` → 날짜 선택 → "USDC로 결제"

전제: 게스트 지갑 USDC 충전

- [ ] KRW→USDC 환산 금액 표시 확인 (localnet: 1350 KRW/USDC)
- [ ] 트랜잭션 서명 → 에스크로 생성 확인
- [ ] `/my/bookings` 에서 "승인 대기" 표시 확인

### TC-BOOK-03: 예약 승인 (어드민)
**경로**: `/admin/bookings` → 승인 대기 탭

- [ ] "승인" 클릭 → `status = "confirmed"` 확인
- [ ] 게스트 `/my/bookings` 에서 "확정" 상태 확인

### TC-BOOK-04: 예약 거절
**경로**: `/admin/bookings` → 승인 대기 탭

- [ ] "거절" 클릭 → `status = "cancelled"` 확인
- [ ] PayPal 예약의 경우: authorization void 확인

### TC-BOOK-05: 메시지 (자동 번역)

| 역할 | 경로 |
|------|------|
| 게스트 | `/my/bookings` → 확정 예약 → 메시지 아이콘 |
| 어드민 | `/admin/bookings` → 확정 탭 → 채팅 아이콘 |

전제: `DEEPL_API_KEY` 설정 필요

- [x] 게스트 영어 메시지 → 호스트 측 한국어 표시 확인
- [x] 호스트 한국어 메시지 → 게스트 측 영어 표시 확인
- [x] "원문 보기" 토글 확인

### TC-BOOK-06: 체크아웃 후 에스크로 해제 (USDC 예약)
**경로**: `/admin/bookings` → 완료 가능 예약

전제: TC-BOOK-02 예약의 체크아웃 시각 경과 (로컬: DB에서 날짜 수동 변경)

- [ ] "정산 완료" 버튼 활성화 확인 (체크아웃 이후에만)
- [ ] 클릭 → `listing_vault` 90% + treasury 10% 분배 확인
- [ ] `status = "completed"` 확인

### TC-BOOK-07: 확정 예약 취소 + 환불 ✅
**경로**: `/my/bookings` → 확정 예약 → "예약 취소"

- [x] 체크인 7일+ 전 취소 → `status = "cancelled"`, 100% 환불
- [x] 체크인 3~7일 전 취소 → `status = "cancelled"`, 50% 환불
- [x] 체크인 3일 미만 전 취소 → `status = "completed"`, 0% 환불
- [ ] USDC 에스크로 예약: 온체인 부분 환불 확인


---

## 4. 정산 플로우

### TC-SETTLE-01: 월 정산 ✅
**경로**: `/admin/settlements` → 매물 선택 → 월 선택 → "월 정산 실행"

전제: `completed` 상태 예약 존재, 매물 Active 상태

- [x] 예약 매출 집계 표시 확인
- [x] 운영비 입력 → "월 정산 실행" → 서명 1회 → 완료
- [x] 정산 완료 후 화면 자동 갱신 확인
- [x] 투자자 `/my/portfolio` → "클레임" 버튼 활성화 확인
- [x] "클레임" 클릭 → 서명 → 지갑 USDC 잔액 증가 확인

---

## 5. DAO 거버넌스 플로우

### TC-DAO-01: 제안 생성
**계정**: Council Token 보유 운영자  
**경로**: `/dao` → "새 제안 작성"

전제: TC-ADMIN-03 완료

- [x] 제안 제목 + 설명 + 투표 기간 입력 → "제출" → 서명
- [x] `/dao` 목록에서 "투표 중" 상태 확인

### TC-DAO-02: 투표
**계정**: RWA 토큰 보유 투자자  
**경로**: `/dao/[proposalId]` → "찬성 / 반대 / 기권"

전제: TC-INVEST-01 완료

- [x] 투표 클릭 → 서명 → 집계 반영 확인

### TC-DAO-03: 제안 확정
**경로**: 투표 기간 만료 후 `/dao/[proposalId]` → "확정"

전제: 투표 기간 만료 (로컬: `setup-localnet.ts`에서 `VOTING_PERIOD` 단축)

- [ ] 정족수(10%) 미달 → "부결" 확인
- [ ] 정족수 충족 + 찬성 ≥ 60% → "가결" 확인

---

## 6. 반응형 확인

- [ ] 모바일(375px): 햄버거 메뉴 → 드로어 열림/닫힘
- [ ] 태블릿(768px): 사이드바 표시, 컬럼 숨김 동작
- [ ] 데스크탑(1280px): 전체 레이아웃 정상

---

## 7. devnet 전환 방법

```bash
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC=https://api.devnet.solana.com
VITE_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

---

## 알려진 제한 사항

| 항목 | 내용 |
|------|------|
| 메시지 실시간 수신 | 폴링 없음 — 새로고침 필요 |
| 예약 알림 | 미구현 (Phase 1 예정) |
| KYC | 시뮬레이션만 (Phase 2) |
| 디지털 키 | 미구현 (Phase 2) |
| TC-BOOK-06/07 로컬 | 날짜 수동 조작 필요 |
| DAO 투표 기간 로컬 | `setup-localnet.ts`에서 `VOTING_PERIOD` 단축 필요 |
