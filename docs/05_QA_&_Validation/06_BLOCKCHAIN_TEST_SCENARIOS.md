# Blockchain Feature Test Scenarios
> Created: 2026-02-10 16:30
> Last Updated: 2026-02-10 16:30

## 1. Overview

### 1.1. 테스트 환경
- **네트워크**: Solana Devnet
- **RPC**: Helius Devnet 엔드포인트
- **테스트 SOL**: Devnet Faucet (`solana airdrop 2`)
- **테스트 USDC**: Devnet USDC Mint (자체 발행 또는 Circle Devnet)
- **테스트 지갑**: Phantom (Devnet 모드), CLI 키페어

### 1.2. 테스트 도구
- Anchor Test Framework (`anchor test`)
- `solana-test-validator` (로컬 검증기)
- Playwright/Cypress (E2E UI 테스트)

---

## 2. Wallet Connection Tests

### TC-BC-001: Phantom 지갑 연결 성공
- **Steps**: 프로필 설정 -> "Connect Wallet" -> Phantom 선택 -> 승인
- **Expected**: `user.walletAddress`에 공개키 저장, Toast "지갑이 연결되었습니다"
- **Verify**: DB에 `walletAddress` 필드 값 확인

### TC-BC-002: 지갑 연결 거부
- **Steps**: "Connect Wallet" -> Phantom -> 거부
- **Expected**: Toast "지갑 연결이 거부되었습니다", `walletAddress` 변경 없음

### TC-BC-003: 연결된 지갑 해제
- **Steps**: 프로필 설정 -> "Disconnect" 클릭
- **Expected**: `walletAddress` null로 업데이트, Header 지갑 표시 제거

### TC-BC-004: 네트워크 불일치 경고
- **Steps**: Phantom이 Mainnet에 연결된 상태에서 Devnet 앱 접속
- **Expected**: 경고 다이얼로그 "네트워크를 Devnet으로 전환해주세요"

### TC-BC-005: 지갑 미설치 시 안내
- **Steps**: 지갑 앱 미설치 상태에서 "Connect Wallet" 클릭
- **Expected**: "Get Phantom" 설치 안내 화면 표시

---

## 3. Crypto Payment Tests

### TC-BC-010: SOL 결제 성공
- **Precondition**: 지갑 연결 완료, SOL 잔액 충분
- **Steps**: 예약 -> 결제 수단 "Crypto" -> SOL 선택 -> "Pay with Phantom" -> 승인
- **Expected**: 트랜잭션 confirmed, `booking.status` -> `confirmed`, `wallet_transactions` 레코드 생성
- **Verify**: Solana Explorer에서 트랜잭션 확인, 에스크로 PDA 잔액 확인

### TC-BC-011: USDC 결제 성공
- **Precondition**: 지갑 연결 완료, USDC ATA에 잔액 충분
- **Steps**: 예약 -> "Crypto" -> USDC 선택 -> 결제 -> 승인
- **Expected**: SPL Token transfer 성공, `wallet_transactions.tokenMint`에 USDC mint 기록

### TC-BC-012: 잔액 부족 사전 경고
- **Steps**: SOL 잔액 0.001인 상태에서 0.5 SOL 결제 시도
- **Expected**: 결제 버튼 비활성화, "잔액이 부족합니다" 메시지

### TC-BC-013: 트랜잭션 서명 거부
- **Steps**: 결제 진행 -> Phantom 서명 화면에서 "Reject"
- **Expected**: `booking.status` = `pending` 유지, "결제가 취소되었습니다" Toast

### TC-BC-014: 트랜잭션 Timeout
- **Steps**: 서명 후 네트워크 지연 시뮬레이션 (60초 초과)
- **Expected**: "트랜잭션 확인에 시간이 걸리고 있습니다" 메시지, 재시도 버튼

### TC-BC-015: 환불 처리
- **Steps**: 결제 완료된 예약 -> 체크인 7일 전 취소
- **Expected**: 에스크로에서 100% 환불 트랜잭션, `wallet_transactions.type` = `refund`
- **Verify**: Guest 지갑 잔액 복원 확인

### TC-BC-016: 이중 결제 방지
- **Steps**: 동일 예약에 대해 동시에 2개 결제 시도
- **Expected**: 두 번째 결제 요청이 거부됨 ("이미 결제가 진행 중입니다")

### TC-BC-017: 환율 갱신 후 금액 변경
- **Steps**: 결제 화면 5분 이상 대기
- **Expected**: 환율 자동 갱신, 금액 업데이트 표시, 이전 환율 기반 트랜잭션 거부

---

## 4. NFT Minting Tests

### TC-BC-020: 숙박 완료 시 NFT 자동 민팅
- **Precondition**: 지갑 연결된 사용자, 숙박 완료 처리
- **Steps**: booking.status -> `completed` 업데이트
- **Expected**: `nft_mints` 테이블에 `status: 'minted'` 레코드 생성, 사용자 지갑에 cNFT 도착
- **Verify**: Helius DAS API로 asset 조회

### TC-BC-021: NFT 메타데이터 정확성
- **Steps**: 민팅된 NFT의 `metadataUri` 조회
- **Expected**: name, location, check-in/out 날짜, 계절이 booking 데이터와 일치

### TC-BC-022: NFT Gallery 목록 표시
- **Steps**: `/my-nfts` 페이지 접속
- **Expected**: 보유 NFT 목록이 카드 형태로 표시, 총 개수 정확

### TC-BC-023: 지갑 미연결 사용자 NFT 보관
- **Steps**: 지갑 미연결 상태에서 숙박 완료
- **Expected**: `nft_mints.status` = `pending_wallet`, `mintAddress` = null
- **Follow-up**: 지갑 연결 후 미발행 NFT 일괄 민팅

### TC-BC-024: 중복 민팅 방지
- **Steps**: 동일 booking에 대해 2회 민팅 트리거
- **Expected**: 두 번째 호출은 무시 (이미 minted 상태)

---

## 5. Eco-Points Tests

### TC-BC-030: 숙박 완료 포인트 적립
- **Steps**: booking 완료 처리
- **Expected**: `eco_points.balance` += 1,000, `eco_point_transactions` 기록 생성

### TC-BC-031: 장기 체류 보너스 적용
- **Steps**: 7일 이상 숙박 완료
- **Expected**: 기본 1,000 x 2 = 2,000 EP 적립

### TC-BC-032: 포인트 -> 할인 쿠폰 교환
- **Steps**: 10,000 EP 보유 -> 10,000원 할인 쿠폰 교환
- **Expected**: `balance` -= 10,000, `eco_point_transactions.type` = `spend`, 쿠폰 발급

### TC-BC-033: 등급 승급/유지/강등
- **Steps A (승급)**: 포인트 3,000 도달
- **Expected A**: `tier` = `silver`
- **Steps B (강등)**: 12개월간 숙박 없음
- **Expected B**: `tier` 한 단계 하락

### TC-BC-034: 포인트 만료 처리
- **Steps**: 12개월 전 적립된 포인트 존재, 만료 처리 실행
- **Expected**: 만료분 차감, `eco_point_transactions.type` = `expire`

### TC-BC-035: 연속 방문 보너스
- **Steps**: 3개월 내 재예약 후 숙박 완료
- **Expected**: 기본 EP x 1.5 보너스 적용

---

## 6. RWA Token Tests

### TC-BC-040: 빈집 토큰 발행
- **Precondition**: 관리자 권한, approved 상태의 빈집
- **Steps**: `initialize_property(valuation, totalSupply)` 호출
- **Expected**: SPL Token Mint 생성, `rwa_tokens` 레코드, `status` = `active`
- **Verify**: 온체인 totalSupply 확인

### TC-BC-041: USDC로 토큰 매수
- **Steps**: 투자자가 10 토큰 매수 (335 USDC)
- **Expected**: 투자자 ATA에 10 토큰, `rwa_investments` 레코드, `tokensSold` += 10
- **Verify**: 온체인 토큰 잔액 확인

### TC-BC-042: 배당 분배 정확성
- **Precondition**: 투자자 A 50토큰, 투자자 B 30토큰 보유, 월 수익 100 USDC (순배당)
- **Steps**: `distribute_dividends` 호출
- **Expected**: A의 claimable = 50/10000 * 100, B의 claimable = 30/10000 * 100

### TC-BC-043: 배당금 Claim
- **Steps**: 미수령 배당금 존재 -> "Claim Dividend" 클릭 -> 서명
- **Expected**: USDC가 투자자 지갑으로 전송, `claimed_dividends` 업데이트

### TC-BC-044: KYC 미완료 지갑 토큰 전송 거부
- **Steps**: KYC 미완료 지갑으로 토큰 전송 시도
- **Expected**: 트랜잭션 실패, "KYC를 완료해주세요" 안내

### TC-BC-045: 최소 판매율 미달 시 환불
- **Steps**: 세일 기간 종료, 판매율 60% 미달
- **Expected**: 전체 투자금 환불, 토큰화 상태 -> `closed`

### TC-BC-046: 락업 기간 내 전송 차단
- **Steps**: 매수 후 90일 이내 토큰 전송 시도
- **Expected**: 전송 실패, "락업 기간(90일) 내에는 전송할 수 없습니다"

---

## 7. Security & Edge Case Tests

### TC-BC-050: 서버 키페어 노출 방지
- **Steps**: 클라이언트 번들 분석 (소스맵, 네트워크 요청)
- **Expected**: 서버 키페어가 클라이언트에 노출되지 않음

### TC-BC-051: 프로그램 Authority 변경 차단
- **Steps**: 비인가 지갑으로 `set_authority` 호출
- **Expected**: 트랜잭션 실패 (Anchor constraint violation)

### TC-BC-052: 악의적 인스트럭션 인젝션
- **Steps**: 변조된 트랜잭션으로 에스크로 인출 시도
- **Expected**: 서버 검증에서 차단 (인스트럭션 내용 검증)

### TC-BC-053: 지갑 분실 시 자산 복구
- **Steps**: 지갑 분실 신고 -> 관리자 개입 요청
- **Expected**: Custodial 복구 프로세스 안내 (신원 확인 후)

---

## 8. Integration Tests (블록체인 + 기존 시스템)

### TC-BC-060: Crypto 결제 -> Booking State Machine 통합
- **Steps**: SOL 결제 완료
- **Expected**: booking.status `pending` -> `confirmed` 정상 전이, 호스트에게 예약 알림

### TC-BC-061: NFT 민팅 실패 시 Eco-Points 폴백
- **Steps**: NFT 민팅 실패 (네트워크 오류 시뮬레이션)
- **Expected**: Eco-Points는 정상 적립, NFT는 `status: 'failed'`로 기록, 재시도 큐에 추가

### TC-BC-062: Admin Dashboard 크립토 매출 포함
- **Steps**: 크립토 결제 포함된 기간의 Admin Dashboard 조회
- **Expected**: 총 매출에 크립토 결제 금액(KRW 환산) 포함

### TC-BC-063: AI Concierge 블록체인 관련 질문 처리
- **Steps**: "NFT는 어떻게 받나요?" 질문
- **Expected**: Concierge가 NFT 발급 조건과 지갑 연결 안내 제공

---

## 9. Related Documents
- **Foundation**: [Blockchain Vision](../01_Concept_&_Design/08_BLOCKCHAIN_VISION.md) - 블록체인 기능 전략
- **Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - 기술 스택
- **Specs**: [Solana Payment Spec](../03_Technical_Specs/09_SOLANA_PAYMENT_SPEC.md) - 결제 API 명세
- **Specs**: [RWA Token Spec](../03_Technical_Specs/10_RWA_TOKEN_SPEC.md) - RWA 토큰 명세
- **Logic**: [Solana Payment Logic](../04_Logic_&_Progress/10_SOLANA_PAYMENT_LOGIC.md) - 결제 상태 머신
- **Logic**: [NFT Gamification Logic](../04_Logic_&_Progress/11_NFT_GAMIFICATION_LOGIC.md) - NFT/포인트 로직
- **Logic**: [RWA Tokenization Logic](../04_Logic_&_Progress/12_RWA_TOKENIZATION_LOGIC.md) - RWA 비즈니스 로직
- **Test**: [Blockchain Security Audit](./07_BLOCKCHAIN_SECURITY_AUDIT.md) - 보안 감사 체크리스트
