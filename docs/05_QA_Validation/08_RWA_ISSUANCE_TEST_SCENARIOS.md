# RWA 발행 및 매수 QA 테스트 시나리오

> Created: 2026-03-10 12:00
> Last Updated: 2026-03-30 00:00

본 문서는 [15_RWA_ISSUANCE_PLAN.md](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md) 및 [09_RWA_ISSUANCE_SPEC.md](../03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md)에 정의된 RWA 발행·매수·토큰 설계를 검증하기 위한 통합 및 E2E 테스트 시나리오를 정의한다.

---

## 1. 테스트 환경 및 준비 (Prerequisites)

- **네트워크**: Solana Devnet
- **테스트 지갑 구성**:
  - `Wallet Authority` (플랫폼 Authority, RWA Program 호출)
  - `Wallet Investor A` (USDC 보유, RWA 매수)
  - `Wallet Investor B` (USDC 보유, RWA 매수)
- **초기 상태**:
  - RWA Anchor Program Devnet 배포 완료
  - USDC Devnet Mint 및 테스트용 USDC 파우셋 확보
  - 파일럿 빈집 1채 감정가·총 발행량·토큰당 가격 확정

---

## 2. 발행 및 Mint 생성 검증 (Issuance & Mint)

### 시나리오 2.1: initialize_property 호출로 SPL Token Mint 생성
- **목적**: Authority가 단일 빈집에 대해 RWA 토큰 Mint를 정상 생성하는지 확인
- **사전 조건**: Authority 지갑 연결, RWA Program 배포 완료, listing_id·감정가·총발행량·토큰당가격 파라미터 준비
- **Action**: Anchor `initialize_property` 트랜잭션 전송
- **Expected Result**:
  - [ ] 트랜잭션 성공 및 새 SPL Token Mint 계정 생성 확인
  - [ ] PropertyToken PDA에 token_mint, total_supply, price_per_token_usdc, status(draft/active 등) 저장 확인
  - [ ] Mint decimals가 0임을 온체인에서 확인

### 시나리오 2.2: 동일 listing_id로 중복 발행 시도 실패
- **목적**: 1 빈집 = 1 Mint 제약이 지켜지는지 확인
- **사전 조건**: 2.1에서 이미 해당 listing_id로 Mint 생성 완료
- **Action**: 동일 listing_id로 `initialize_property` 재호출
- **Expected Result**:
  - [ ] 트랜잭션 실패 또는 PDA 중복 등으로 인한 에러 반환 확인

---

## 3. 토큰 매수 (Purchase) 검증

### 시나리오 3.1: USDC로 정상 매수 성공
- **목적**: 투자자가 USDC를 지불하고 RWA 토큰을 수령하는지 확인
- **사전 조건**: 2.1 완료, Investor A 지갑에 충분한 USDC, RWA Mint가 active(또는 세일 가능) 상태
- **Action**: `Wallet Investor A`로 `purchase_tokens` 호출 (토큰 수량 10, 해당 USDC 금액)
- **Expected Result**:
  - [ ] 트랜잭션 성공
  - [ ] Investor A 지갑의 RWA 토큰 잔액 10 증가 확인
  - [ ] Investor A 지갑의 USDC 잔액 해당 금액만큼 감소 확인
  - [ ] PropertyToken PDA의 tokens_sold 10 증가 확인
  - [ ] InvestorPosition PDA 생성·갱신 확인

### 시나리오 3.2: USDC 부족 시 매수 실패
- **목적**: 잔액 부족 시 트랜잭션이 안전하게 실패하는지 확인
- **사전 조건**: Investor B의 USDC 잔액이 요청 금액 미만
- **Action**: Investor B로 `purchase_tokens` 호출 (요청 금액 > 잔액)
- **Expected Result**:
  - [ ] 트랜잭션 실패 및 적절한 에러 메시지 반환
  - [ ] RWA 토큰·USDC 잔액 변화 없음

### 시나리오 3.3: 최대 매수 한도(30%) 초과 시 실패
- **목적**: 개인 투자자 30% 상한이 온체인 프로그램에서 적용되는지 확인 (의결권 10% 캡은 DAO 별도)
- **사전 조건**: 총 발행량 1,000토큰, 이미 300토큰 보유한 Investor A (30%)
- **Action**: 동일 Investor A로 추가 1토큰 매수 시도 (총 301토큰 = 30.1%)
- **Expected Result**:
  - [ ] 온체인 `ExceedsInvestorCap` 에러로 트랜잭션 실패

---

## 4. 클라이언트(UI) 연동 검증

### 시나리오 4.1: /invest/:id 진입 및 Purchase 플로우
- **목적**: 웹에서 토큰 상세·매수 금액 입력·지갑 서명까지 정상 동작하는지 확인
- **사전 조건**: RWA 토큰 1개 active, 사용자 지갑 연결·USDC 보유
- **Action**: `/invest/{listingId}` 방문 후 토큰 수량 입력, "Buy with USDC" 클릭, 지갑 서명
- **Expected Result**:
  - [ ] 404/White Screen 없이 페이지 렌더링
  - [ ] 토큰 정보(총 발행량, 가격, 판매량) 표시
  - [ ] 서명 완료 후 성공 피드백 및 잔액/보유량 갱신 (또는 Explorer 링크 제공)

### 시나리오 4.2: 지갑 미연결 시 안내
- **목적**: 지갑 미연결 시 매수 버튼 비활성화 또는 연결 유도 메시지 노출 확인
- **사전 조건**: 지갑 연결 해제 상태
- **Action**: `/invest/:id` 방문
- **Expected Result**:
  - [ ] "Connect Wallet to Invest" 등 연결 유도 UI 표시, 매수 실행 불가

---

## 5. 발행·배당 분리 검증 (선택)

### 시나리오 5.1: RWA 발행/매수와 배당 상태 분리 검증
- **목적**: 발행·매수 단계에서는 배당 누적기(`acc_dividend_per_share`)가 변하지 않음을 검증. 배당은 단일 프로그램 내 `distribute_monthly_revenue` instruction으로 분리 동작.
- **사전 조건**: RWA Mint 생성·매수 완료, `distribute_monthly_revenue` 미호출 상태
- **Action**: PropertyToken PDA의 `acc_dividend_per_share` 값 조회
- **Expected Result**:
  - [ ] `acc_dividend_per_share == 0` (배당 분배 전이므로)
  - [ ] InvestorPosition의 `reward_debt == 0` (배당 미수령 상태)
  - [ ] `distribute_monthly_revenue` 호출 후에만 `acc_dividend_per_share` 증가 확인

---

## 6. Related Documents

- **Concept_Design**: [15_RWA_ISSUANCE_PLAN.md](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md) - RWA 발행 기획서
- **Technical_Specs**: [09_RWA_ISSUANCE_SPEC.md](../03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md) - RWA 발행 구현 명세서
- **Logic_Progress**: [10_RWA_DIVIDEND_LOGIC.md](../04_Logic_Progress/10_RWA_DIVIDEND_LOGIC.md) - 배당 로직 (발행과 분리)
- **Archive**: [10_RWA_TOKEN_SPEC.md](../00_ARCHIVE/future_blockchain/10_RWA_TOKEN_SPEC.md) - 레거시 RWA 토큰·Anchor 상세 (참고용)
