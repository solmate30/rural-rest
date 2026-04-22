# 11. Anchor 프로그램 명세 (SPECIFICATION)

생성: 2026-03-28 17:30
업데이트: 2026-04-23 00:00

Program ID: `F5ZAPhk9Yw65WzEisS6SsAtXQd3xyUFwsMdWvA3QYSDE`
Anchor: 0.32.1 | Token-2022 (RWA mint) + SPL Token (USDC)

---

## 1. State

### PropertyToken

| 필드 | 타입 | 단위 | 설명 |
|------|------|------|------|
| `authority` | `Pubkey` | — | 프로퍼티 소유자 (운영자) |
| `listing_id` | `String` (max 32) | — | DB listing ID (PDA seed 용도) |
| `token_mint` | `Pubkey` | — | SPL Token-2022 mint 주소 |
| `usdc_mint` | `Pubkey` | — | USDC mint 주소 (가짜 mint 주입 방지) |
| `total_supply` | `u64` | tokens | 총 발행량 고정값 (100_000_000) |
| `tokens_sold` | `u64` | tokens | 현재 판매된 수량 |
| `valuation_krw` | `u64` | KRW (원화) | 부동산 평가액 |
| `price_per_token_usdc` | `u64` | micro-USDC (1e-6) | 토큰 1개당 가격 |
| `acc_dividend_per_share` | `u128` | PRECISION 단위 (1e12) | 누적 배당 per token (단조 증가) |
| `status` | `PropertyStatus` | enum | 현재 상태 |
| `funding_deadline` | `i64` | Unix timestamp (초) | 펀딩 마감 시각 |
| `min_funding_bps` | `u16` | basis points (1/10000) | 최소 판매율 (6000 = 60%) |
| `funds_released` | `bool` | — | `release_funds` 호출 여부 (중복 방지) |
| `funding_vault_bump` | `u8` | — | PDA bump |
| `bump` | `u8` | — | PDA bump |

> `funds_released`: `release_funds` 중복 호출 방지용. 구현 완료.

### InvestorPosition

| 필드 | 타입 | 단위 | 설명 |
|------|------|------|------|
| `owner` | `Pubkey` | — | 투자자 지갑 주소 |
| `token_mint` | `Pubkey` | — | 대상 property mint |
| `amount` | `u64` | tokens | 보유 토큰 수량 |
| `reward_debt` | `u128` | PRECISION 단위 (1e12) | 이미 반영된 배당 기준선 |
| `bump` | `u8` | — | PDA bump |

### PropertyStatus 전환표

```
Funding ──(완판 or release_funds)──► Funded ──(activate)──► Active
   │                                    │
   │                                    └──(cancel_position, deadline 전)──► Funding
   └──(deadline + goal 미달)──► Failed
```

| 상태 | purchase | cancel_position | release_funds | activate | distribute | claim | refund |
|------|---------|----------------|--------------|---------|-----------|-------|--------|
| Funding | ✅ | ✅ (deadline 전) | ✅ (deadline 후 + goal 달성 → Funded 전환) | ❌ | ❌ | ❌ | ❌ |
| Funded | ❌ | ✅ (deadline 전 + !funds_released) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Active | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Failed | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### PDA Seeds

| 계정 | Seeds | 비고 |
|------|-------|------|
| `property_token` | `["property", listing_id.as_bytes()]` | |
| `funding_vault` | `["funding_vault", listing_id.as_bytes()]` | Token account (seed 방식) |
| `investor_position` | `["investor", property_token.key(), investor.key()]` | |
| `usdc_vault` | ATA(usdc_mint, property_token) | Associated Token Account |
| `investor_rwa_account` | ATA(token_mint, investor) | Associated Token Account |

---

## 2. Instruction 명세

### `initialize_property`

| 파라미터 | 타입 | 검증 |
|---------|------|------|
| `listing_id` | `String` | — |
| `total_supply` | `u64` | — |
| `valuation_krw` | `u64` | — |
| `price_per_token_usdc` | `u64` | — |
| `funding_deadline` | `i64` | `> Clock::unix_timestamp` → `InvalidDeadline` |
| `min_funding_bps` | `u16` | — |

생성 계정: `property_token`, `token_mint`, `funding_vault`, `usdc_vault`
`funds_released = false`로 초기화.

---

### `open_position`

`investor_position`을 **최초 1회** 생성하는 전용 instruction.
`purchase_tokens`에서 `init_if_needed`를 제거하기 위해 분리.

| 파라미터 | 타입 | 검증 |
|---------|------|------|
| `listing_id` | `String` | — |

생성 계정: `investor_position` (`init`, 1회만 가능)
초기값: `owner = investor`, `token_mint = property_token.token_mint`, `amount = 0`, `reward_debt = 0`

---

### `purchase_tokens`

| 파라미터 | 타입 | 검증 |
|---------|------|------|
| `listing_id` | `String` | — |
| `amount` | `u64` | `> 0` → `ZeroAmount` |

| 검증 조건 | 에러 |
|----------|------|
| `amount > 0` | `ZeroAmount` |
| `status == Funding` | `InvalidStatus` |
| `clock <= funding_deadline` | `FundingExpired` |
| `tokens_sold + amount <= total_supply` | `InsufficientTokenSupply` |
| `position.amount + amount <= total_supply * 3 / 10` | `ExceedsInvestorCap` (30%) |
| `investor != authority` | `AuthorityCannotInvest` |

CPI:
1. `transfer_checked`: investor_usdc → funding_vault (`amount × price_per_token_usdc`, decimals=6)
2. `mint_to`: token_mint → investor_rwa_account (`amount`개)

자동 전환: `tokens_sold == total_supply` → `status = Funded`

`investor_position`은 사전에 `open_position`으로 생성돼 있어야 함 (`init` 없음).

---

### `release_funds`

| 검증 조건 | 에러 |
|----------|------|
| `!funds_released` | `FundsAlreadyReleased` |
| `clock > funding_deadline` | `FundingStillOpen` |
| `status == Funding` AND `goal 달성` (tokens_sold >= min_threshold) | `ReleaseNotAvailable` |
| `signer == authority` | has_one |

CPI: `transfer_checked`: funding_vault → authority_usdc (vault 전액, decimals=6)
사후: `funds_released = true`, `status = Funded`

---

### `refund`

| 검증 조건 | 에러 |
|----------|------|
| `clock > funding_deadline` AND `tokens_sold < min_threshold` | `RefundNotAvailable` |
| `position.amount > 0` | `AlreadyRefunded` |
| `position.owner == investor` | `Unauthorized` |

CPI: `transfer_checked`: funding_vault → investor_usdc (`position.amount × price_per_token_usdc`, decimals=6)
사후: `position.amount = 0`, `position.reward_debt = 0`, `status = Failed`

---

### `cancel_position`

펀딩 중 투자자가 직접 포지션을 취소. 쿨링오프 없음 — Funding 또는 Funded 상태에서 deadline 전이면 호출 가능.

| 파라미터 | 타입 | 검증 |
|---------|------|------|
| `listing_id` | `String` | — |

| 검증 조건 | 에러 |
|----------|------|
| `!funds_released` | `FundsAlreadyReleased` |
| `(status == Funding \|\| status == Funded) && clock <= deadline` | `InvalidStatus` |
| `position.amount > 0` | `AlreadyRefunded` |
| `position.owner == investor` | `Unauthorized` |

CPI:
1. `burn`: investor_rwa_account에서 `position.amount`개 소각 (`token_program` Token-2022)
2. `transfer_checked`: funding_vault → investor_usdc (`position.amount × price_per_token_usdc`, decimals=6)

사후:
- `position.amount = 0`, `position.reward_debt = 0`
- `property.tokens_sold -= cancelled_amount`
- 상태는 Funding으로 복귀 (Funded였다면 Funding으로 되돌림)

> 운영 시 쿨링오프 기간 도입 검토 예정 (`11_RWA_KNOWN_ISSUES.md` §4 참조).

---

### `activate_property`

| 검증 조건 | 에러 |
|----------|------|
| `status == Funded` | `InvalidStatus` |
| `signer == authority` | has_one |

CPI: `set_authority(MintTokens, None)` — mint authority 영구 소각 (이후 추가 발행 불가)

---

### `distribute_monthly_revenue`

| 파라미터 | 타입 | 검증 |
|---------|------|------|
| `listing_id` | `String` | — |
| `net_revenue_usdc` | `u64` | `> 0` → `ZeroRevenue` |

| 검증 조건 | 에러 |
|----------|------|
| `net_revenue_usdc > 0` | `ZeroRevenue` |
| `status == Active` | `InvalidStatus` |
| `signer == authority` | has_one |

CPI: `transfer_checked`: authority_usdc → usdc_vault (`net_revenue_usdc`, decimals=6)

---

### `claim_dividend`

| 검증 조건 | 에러 |
|----------|------|
| `pending > 0` | `NoPendingDividend` |
| `position.owner == investor` | `Unauthorized` |

CPI: `transfer_checked`: usdc_vault → investor_usdc (`pending as u64`, decimals=6)

---

## 3. 수학 명세

### 공통 상수

```rust
const PRECISION: u128 = 1_000_000_000_000; // 1e12 (모듈 레벨 정의)
```

### 배당 분배 (`distribute_monthly_revenue`)

```
added = floor(net_revenue_usdc × PRECISION / tokens_sold)
acc_dividend_per_share += added
```

- 반올림: **floor** (Rust 정수 나눗셈 기본)
- dust (나머지): usdc_vault에 잔류, 클레임 불가
- `tokens_sold > 0` 보장: Active 도달 조건에 의해 항상 성립

### 배당 클레임 (`claim_dividend`)

```
gross   = floor(position.amount × acc_dividend_per_share / PRECISION)
pending = gross − position.reward_debt
reward_debt_new = gross  (클레임 후 동일 공식으로 재계산)
```

- 반올림: **floor** (양방향 일관성)
- `pending < 0` 발생 불가 (acc_dps는 단조 증가, reward_debt는 직전 gross와 같음)

### 최소 목표 임계값 (`release_funds`, `refund`)

```
min_threshold = floor(total_supply × min_funding_bps / 10_000)
```

- 반올림: **floor** (투자자에게 유리한 방향)
- 예: total_supply=100_000_000, min_funding_bps=6000 → min_threshold=60_000_000

### 투자자 상한 (`purchase_tokens`)

```
max_per_investor = total_supply * 3 / 10   // 30%
```

- `total_supply`는 항상 10의 배수 (설계상 100_000_000 고정)
- 의결권 캡 10%는 DAO 구현 시 별도 처리 (온체인 구매 상한과 분리)

### 환불 금액 (`refund`)

```
refund_amount = position.amount × price_per_token_usdc
```

- 나눗셈 없음, 정확한 값

### u128 사용 근거

| 연산 | 이유 |
|------|------|
| `acc_dividend_per_share` (u128) | `PRECISION(1e12) × total_supply(1e8)` → u64 최대값(1.8e19) 초과 가능 |
| `reward_debt` (u128) | 위와 동일 |
| 중간 계산 (`amount as u128 × ...`) | u64 × u64 overflow 방지 |

---

## 4. 에러 코드

| 에러 | 코드 | 발생 Instruction | 트리거 조건 |
|------|------|----------------|-----------|
| `InsufficientTokenSupply` | 6000 | `purchase_tokens` | `tokens_sold + amount > total_supply` |
| `ExceedsInvestorCap` | 6001 | `purchase_tokens` | `position.amount + amount > total_supply * 3 / 10` (30%) |
| `MathOverflow` | 6002 | 전체 | `checked_*` 연산 실패 |
| `NoPendingDividend` | 6003 | `claim_dividend` | `pending == 0` 또는 underflow |
| `Unauthorized` | 6004 | `refund`, `claim_dividend` | `position.owner != signer` |
| `InvalidStatus` | 6005 | `purchase_tokens`, `cancel_position`, `activate_property`, `distribute_monthly_revenue` | 허용되지 않은 상태 |
| `FundingExpired` | 6006 | `purchase_tokens` | `clock > funding_deadline` |
| `RefundNotAvailable` | 6007 | `refund` | deadline 미경과 또는 goal 달성 |
| `AlreadyRefunded` | 6008 | `refund` | `position.amount == 0` |
| `InvalidDeadline` | 6009 | `initialize_property` | `funding_deadline <= clock` |
| `ReleaseNotAvailable` | 6010 | `release_funds` | 완판도 아니고 goal도 미달 |
| `AuthorityCannotInvest` | 6011 | `purchase_tokens` | `investor == authority` |
| `ZeroAmount` | 6012 | `purchase_tokens` | `amount == 0` |
| `ZeroRevenue` | 6013 | `distribute_monthly_revenue` | `net_revenue_usdc == 0` |
| `FundsAlreadyReleased` | 6014 | `release_funds`, `cancel_position` | `funds_released == true` |
| `InvalidFundingBps` | 6015 | `initialize_property` | `min_funding_bps == 0` 또는 `> 10_000` |
| `InvalidPrice` | 6016 | `initialize_property` | `price_per_token_usdc == 0` |
| `DeadlineTooFar` | 6017 | `initialize_property` | `funding_deadline > now + 365일` |
| `FundingStillOpen` | 6018 | `release_funds` | `clock <= funding_deadline` (펀딩 기간 중 release 불가) |

---

## 5. 테스트 seed 범위 및 케이스

### 기준값

```
PRECISION        = 1_000_000_000_000
TOTAL_SUPPLY     = 100_000_000
PRICE_PER_TOKEN  = 1_000          // 0.001 USDC
MIN_FUNDING_BPS  = 6_000          // 60%
MIN_THRESHOLD    = 60_000_000     // 60% of TOTAL_SUPPLY
MAX_PER_INVESTOR = 30_000_000     // 30% of TOTAL_SUPPLY
```

### 배당 계산

| 케이스 | amount | 분배 net_revenue | reward_debt | 기대 pending |
|-------|--------|-----------------|-------------|------------|
| 1차 배당 후 클레임 | 10 | 100_000_000 / 100토큰 | 0 | 10_000_000 |
| 2차 배당 후 클레임 | 10 | 추가 50_000_000 / 100 | 1차 gross | 5_000_000 |
| 더블 클레임 | 10 | — | 클레임 후 갱신 | 0 → `NoPendingDividend` |
| 후발 투자자 과거 배당 차단 | 50 | 1차 이전 구매 없음 | acc_dps 기준 설정 | 0 |
| 후발 투자자 미래 배당 | 50 | 2차 이후 클레임 | 1차 acc_dps 기준 | 25_000_000 |

### 경계값

| 케이스 | 입력 | 기대 결과 |
|-------|------|----------|
| amount = 0 | `purchase_tokens(0)` | `ZeroAmount` |
| amount = MAX_PER_INVESTOR (정확히 30%) | 통과 | |
| amount = MAX_PER_INVESTOR + 1 | `ExceedsInvestorCap` | |
| amount = 잔여량 (완판) | 통과 + `status = Funded` | |
| amount = 잔여량 + 1 | `InsufficientTokenSupply` | |
| tokens_sold = MIN_THRESHOLD (60%) | `refund` → `RefundNotAvailable` | |
| tokens_sold = MIN_THRESHOLD - 1 | `refund` → 통과 | |
| net_revenue_usdc = 0 | `distribute_monthly_revenue(0)` | `ZeroRevenue` |
| `release_funds` 2회 호출 | 1회 성공 후 2회 | `FundsAlreadyReleased` |

### 오버플로우 방어

| 케이스 | 값 | 기대 결과 |
|-------|-----|----------|
| `amount × price` | amount = u64::MAX/2, price = 2 | u128 중간값으로 안전 처리 |
| `acc_dps` 최대 근접 | u128::MAX - 1 + 1 | `Some(u128::MAX)` |
| `acc_dps` 오버플로우 | u128::MAX - 1 + 2 | `None` → `MathOverflow` |

---

## 6. 관련 문서

- `anchor/programs/rural-rest-rwa/src/lib.rs` — 실제 구현
- `anchor/CLAUDE.md` — 개발 가이드 및 빌드 명령
- `docs/03_Technical_Specs/10_ANCHOR_PROGRAM_AUDIT.md` — 보안 및 CU 감사
- `docs/04_Logic_Progress/10_RWA_DIVIDEND_LOGIC.md` — 배당 분배 알고리즘 (DeFi Masterchef 수학)
- `docs/04_Logic_Progress/11_RWA_KNOWN_ISSUES.md` — 알려진 이슈 및 Stage 2 항목
- `docs/04_Logic_Progress/12_RWA_FUNDING_ESCROW_LOGIC.md` — 펀딩 에스크로 및 환불 로직
- `docs/04_Logic_Progress/13_SETTLEMENT_ARCHITECTURE.md` — 3자 정산 아키텍처
