# E2E Full Flow Test
> Created: 2026-04-16 00:00
> Last Updated: 2026-04-21 00:00

전체 플로우를 처음부터 끝까지 검증하는 E2E 테스트 시나리오.  
**로컬 노드(localnet) 기준**으로 작성됨. devnet 전환 방법은 맨 아래 참고.

---

## 0. 로컬 환경 셋업 (최초 1회 + validator 리셋 후마다)

### 0-1. Solana Test Validator 시작

```bash
# 터미널 1 — validator 상시 실행
solana-test-validator --reset
```

> `--reset`: 이전 ledger 완전 삭제 후 시작. 매 e2e 전 권장.

### 0-2. Anchor 프로그램 빌드 & 배포

```bash
# 터미널 2
cd ~/solana/rural-rest/anchor
anchor build
anchor deploy --provider.cluster localnet
```

빌드 후 IDL 복사:
```bash
cp target/idl/rural_rest_rwa.json ../web/app/anchor-idl/
cp target/idl/rural_rest_dao.json ../web/app/anchor-idl/
```

### 0-3. 온체인 초기화 (Mint + RwaConfig + DaoConfig)

```bash
cd ~/solana/rural-rest/web
npx tsx scripts/setup-localnet.ts
```

실행 결과 예시:
```
[ 1/3 ] Fake USDC Mint... → .env VITE_USDC_MINT 업데이트 완료
[ 2/3 ] RwaConfig 초기화... → tx: 3x...
[ 3/3 ] Council Mint + DAO 초기화... → tx: 5y...
Localnet 초기화 완료
```

> 실패 시: `solana airdrop 10 <admin-pubkey> --url http://127.0.0.1:8899` 후 재실행

### 0-4. 테스트 DB 및 매물 데이터 준비

```bash
# 기존 DB 초기화 (선택 — 완전히 처음부터 시작하려면)
rm web/local.db

# 테스트 매물 시드
cd ~/solana/rural-rest/web
npx tsx scripts/seed-test-listing.ts
```

매물 확인:
```bash
sqlite3 local.db "SELECT id, node_number, title FROM listings LIMIT 3;"
```

### 0-5. 개발 서버 실행

```bash
cd ~/solana/rural-rest/web
npm run dev
# → http://localhost:5173
```

> `.env` 기준 `VITE_SOLANA_RPC=http://127.0.0.1:8899` (localnet 자동 사용)

### 0-6. 환경 변수 확인

`.env` / `.env.local` 에서 아래 항목 필수 확인:

| 변수 | 설명 | localnet 값 |
|------|------|-------------|
| `VITE_SOLANA_RPC` | RPC 엔드포인트 | `http://127.0.0.1:8899` |
| `VITE_SOLANA_NETWORK` | 네트워크 | `localnet` |
| `VITE_USDC_MINT` | setup-localnet.ts가 자동 업데이트 | 실행 후 확인 |
| `VITE_COUNCIL_MINT` | setup-localnet.ts가 자동 업데이트 | 실행 후 확인 |
| `CRANK_SECRET_KEY` | crank 자동 정산용 | bs58 인코딩 keypair |
| `PAYPAL_MODE` | 결제 모드 | `sandbox` |

---

## 1. 어드민 플로우

### TC-ADMIN-01: 매물 등록 ✅
**계정**: `solmate.dev@gmail.com` (admin)  
**경로**: `/admin/listing/new`

- [x] 6단계 폼 완성 후 제출
- [x] DB에서 listings 생성 확인
  ```bash
  sqlite3 local.db "SELECT id, node_number, title FROM listings ORDER BY created_at DESC LIMIT 1;"
  ```
- [x] `/admin` 대시보드에서 매물 표시 확인

### TC-ADMIN-02: RWA 토큰화 ✅
**경로**: `/admin` → 매물 클릭 → 토큰 발행 설정 입력 → "토큰 발행" 버튼

- [x] 평가액, 최소 모집률, 마감일 입력 후 "토큰 발행" 버튼 클릭
- [x] 서명 팝업 확인 → 승인
- [x] 토큰 발행 완료 후 상태가 "펀딩 중"으로 변경되는 것 확인
- [x] DB에 토큰 정보 저장 확인
  ```bash
  sqlite3 local.db "SELECT t.listing_id, t.symbol, t.token_mint, t.status FROM rwa_tokens t ORDER BY t.created_at DESC LIMIT 1;"
  ```
- [x] `/admin/settlements` 에서 해당 매물 표시 확인

### TC-ADMIN-03: 운영자 등록 + Council Token 발급
**경로**: `/admin/operators` → `+ 계정 생성`

- [x] 운영자 계정 생성 (지갑 주소 입력)
- [x] `/admin/council-token` → 해당 운영자 선택 → "발급" 클릭
- [x] 트랜잭션 서명
- [x] 온체인에서 Council Token 잔액 확인
  ```bash
  spl-token accounts --owner <운영자-지갑-주소> --url http://127.0.0.1:8899
  ```

---

## 2. 투자자 플로우

### TC-INVEST-01: RWA 토큰 구매 ✅
**계정**: 게스트 계정 (Privy 로그인)  
**경로**: `/invest` → 매물 선택 → `/invest/[id]`

전제: TC-ADMIN-02 완료 (매물 토큰화 상태), 투자자 지갑에 fake USDC 충전

USDC 충전 (로컬):
```bash
# /dev/faucet 페이지에서 지갑 주소 입력 후 충전
http://localhost:5173/dev/faucet
```

- [x] USDC 잔액 표시 확인
- [x] 수량 입력 → "투자하기" 클릭 → 서명
- [x] 온체인에서 보유 토큰 수량 증가 확인
  ```bash
  npx tsx scripts/check-rwa-status.ts
  ```
- [x] `/my/portfolio` 에서 투자 내역 확인

---

## 3. 예약 플로우

### TC-BOOK-01: 예약 생성 — PayPal 카드 결제
**계정**: 게스트 계정  
**경로**: `/property/[id]` → 날짜 선택 → "결제하기"

- [ ] 날짜 선택 (오늘 이후)
- [ ] PayPal sandbox 결제 완료 → `/book/success` 리다이렉트
- [ ] DB에서 `status = "pending"` 확인
  ```bash
  sqlite3 local.db "SELECT id, status, check_in, check_out FROM bookings ORDER BY created_at DESC LIMIT 1;"
  ```
- [ ] `/my/bookings` 에서 "승인 대기" 표시 확인

### TC-BOOK-02: 예약 생성 — USDC 에스크로 결제 (Solana)
**계정**: 게스트 계정  
**경로**: `/property/[id]` → 날짜 선택 → "USDC로 결제"

전제: 게스트 지갑에 fake USDC 충전

- [ ] "USDC로 결제" 버튼 클릭
- [ ] KRW→USDC 환산 금액 표시 확인 (skip-oracle: 1350 KRW/USDC)
- [ ] 트랜잭션 서명
- [ ] 온체인 에스크로 계좌 생성 확인
  ```bash
  solana account <escrow-pda> --url http://127.0.0.1:8899
  ```
- [ ] DB에서 `status = "pending"`, `paypal_authorization_id IS NULL` 확인
- [ ] `/my/bookings` 에서 "승인 대기" 표시 확인

### TC-BOOK-03: 예약 승인 (어드민)
**계정**: admin  
**경로**: `/admin/bookings` → 승인 대기 탭

- [ ] TC-BOOK-01 또는 TC-BOOK-02 예약 확인
- [ ] "승인" 버튼 클릭
- [ ] DB에서 `status = "confirmed"` 확인
- [ ] 게스트 `/my/bookings` 에서 "확정" 상태 확인

### TC-BOOK-04: 예약 거절
**경로**: `/admin/bookings` → 승인 대기 탭

- [ ] "거절" 버튼 클릭
- [ ] DB에서 `status = "cancelled"` 확인
- [ ] PayPal 예약의 경우: authorization void 처리 확인 (PayPal sandbox dashboard)

### TC-BOOK-05: 메시지 (자동 번역)

| 역할 | 경로 |
|------|------|
| 게스트 | `/my/bookings` → 확정 예약 → 메시지 아이콘 → `/my/messages/:bookingId` |
| 호스트/어드민 | `/admin/bookings` → 확정 탭 → 채팅 아이콘 → `/admin/messages/:bookingId` |

전제: `DEEPL_API_KEY` 설정 (`DEEPL_API_KEY` 없으면 번역 없이 원문 그대로 표시됨)

- [ ] 게스트: 영어 메시지 전송 → 호스트 측에서 한국어로 표시 확인
- [ ] 호스트: 한국어 메시지 전송 → 게스트 측에서 영어로 표시 확인
- [ ] "원문 보기" 토글로 원문 확인
- [ ] `DEEPL_API_KEY` 미설정 시: 번역 없이 정상 동작 (에러 없음) 확인

### TC-BOOK-06: 체크아웃 후 에스크로 해제 (USDC 예약)
**경로**: `/admin/bookings` → 완료 가능 예약

전제: TC-BOOK-02 USDC 에스크로 예약이 체크아웃 시각 경과  
로컬에서 체크아웃 경과 처리: DB에서 `check_out`을 과거 날짜로 수동 변경 후 테스트

```bash
sqlite3 local.db "UPDATE bookings SET check_in = datetime('now', '-3 days'), check_out = datetime('now', '-1 day') WHERE id = '<booking-id>';"
```

- [ ] "정산 완료" 버튼 활성화 확인 (체크아웃 이후에만)
- [ ] 클릭 → 호스트 90% + 플랫폼 10% 분배 확인
- [ ] DB에서 `status = "completed"` 확인
- [ ] 호스트 지갑 USDC 잔액 증가 확인

### TC-BOOK-07: 확정 예약 취소 + 환불 (부분 환불 정책)
**경로**: `/my/bookings` → 확정 예약 → "예약 취소"

전제: TC-BOOK-03 확정 예약 존재

- [ ] 체크인 7일+ 전 취소 → 100% 환불 확인
  ```bash
  # 체크인을 충분히 미래로 설정
  sqlite3 local.db "UPDATE bookings SET check_in = datetime('now', '+10 days'), check_out = datetime('now', '+12 days') WHERE id = '<booking-id>';"
  ```
- [ ] 체크인 3~7일 전 취소 → 50% 환불 확인
- [ ] 체크인 3일 미만 전 취소 → 0% 환불 확인
- [ ] USDC 에스크로 예약의 경우: 온체인 부분 환불 처리 확인

---

## 4. 정산 플로우

### TC-SETTLE-01: 월 정산
**경로**: `/admin/settlements` → 매물 선택 → "월 정산 실행"

전제: TC-ADMIN-02 완료 (Active 상태 매물)

Active 전환 (완판이 필요):
```bash
cd ~/solana/rural-rest/web
npx tsx scripts/fill-funding.ts  # 투자 100% 채우기
```

- [ ] 임대 수익 입력 (예: 1,000,000 KRW)
- [ ] 정산 실행 → 서명 → 완료 확인
- [ ] 온체인 배당 적립 확인
  ```bash
  npx tsx scripts/check-rwa-status.ts
  ```
- [ ] 투자자 `/my/portfolio` → "클레임" 버튼 활성화 확인
- [ ] "클레임" 클릭 → 서명 → 지갑 USDC 잔액 증가 확인

---

## 5. DAO 거버넌스 플로우

### TC-DAO-01: 제안 생성
**계정**: Council Token 보유 운영자  
**경로**: `/dao` → "새 제안 작성"

전제: TC-ADMIN-03 완료 (운영자에게 Council Token 발급)

- [ ] 제안 제목 + 설명 + 투표 기간 입력
- [ ] "제출" 클릭 → 서명 → 제안 등록 완료
- [ ] GitHub 이슈 생성 확인 (GITHUB_DAO_REPO 설정 시)
- [ ] `/dao` 목록에서 "투표 중" 상태 확인

### TC-DAO-02: 투표
**계정**: RWA 토큰 보유 투자자  
**경로**: `/dao/[proposalId]` → "찬성 / 반대 / 기권"

전제: TC-INVEST-01 완료 (투자자가 RWA 보유)

- [ ] 투표 클릭 → 서명 → 투표 완료
- [ ] 투표권 = RWA 보유량 반영 확인
- [ ] 중복 투표 시 에러 확인
- [ ] `/dao/[proposalId]` 에서 실시간 집계 확인

### TC-DAO-03: 제안 확정
**경로**: 투표 기간 만료 후 `/dao/[proposalId]` → "확정"

로컬에서 투표 기간 단축 처리: `initializeDao` 시 `VOTING_PERIOD = 10` (10초) 으로 설정 후 테스트

- [ ] 투표 기간 만료 후 "확정" 버튼 활성화 확인
- [ ] 정족수(10%) 미달 → "부결" 확인
- [ ] 정족수 충족 + 찬성 ≥ 60% → "가결" 확인
- [ ] 결과 GitHub 이슈에 댓글 반영 확인

---

## 6. 반응형 확인

- [ ] 모바일(375px): 햄버거 메뉴 → 드로어 열림/닫힘
- [ ] 태블릿(768px): 사이드바 표시, 컬럼 숨김 동작
- [ ] 데스크탑(1280px): 전체 레이아웃 정상

---

## 7. devnet 전환 방법

```bash
# .env 수정
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC=https://api.devnet.solana.com
VITE_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU  # devnet USDC
```

> Anchor 프로그램은 devnet에 이미 배포됨 (`anchor deploy` 불필요)

---

## 알려진 제한 사항

| 항목 | 내용 |
|------|------|
| 메시지 실시간 수신 | 폴링 없음 — 새로고침 필요 |
| 예약 알림 | 미구현 (Phase 1 예정) |
| 교통 요청 | 미구현 (Phase 1 예정) |
| KYC | 시뮬레이션만 (Phase 2) |
| 디지털 키 | 미구현 (Phase 2) |
| TC-BOOK-06/07 로컬 | 날짜 수동 조작 필요 (validator 시간 고정) |
| DAO 투표 기간 로컬 | `setup-localnet.ts`에서 `VOTING_PERIOD` 단축 필요 |
