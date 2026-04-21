# CLAUDE.md — Rural Rest RWA Anchor Program

## Overview

한국 농촌 폐가를 SPL Token-2022로 토큰화하고, USDC 임대 수익을 투자자에게 온체인 배당하는 Solana Anchor 프로그램.
Program ID: `EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR`

---

## Dev Commands

```bash
# 프로그램 빌드
anchor build

# 테스트
anchor test

# devnet 배포
anchor deploy --provider.cluster devnet

# 온체인 상태 확인
node web/scripts/check-onchain.mjs

# IDL 재생성 (구조 변경 후)
anchor build && cp target/idl/rural_rest_rwa.json web/app/anchor-idl/
```

---

## Critical Rules

### NEVER
- `init_if_needed` 사용 금지 — 재초기화 공격 가능, 명시적 검증 불가
- bare `anchor test` 금지 — `--features` 누락 시 oracle/가격 검증 비활성화됨
- `authority` single key로 mainnet 배포 금지 — Squads multisig 필수
- `PRECISION` 상수를 함수 내부에 중복 정의 금지 — 모듈 레벨 `const PRECISION: u128 = 1_000_000_000_000`만 사용
- RWA 토큰에 transfer 허용 금지 — non_transferable extension 적용됨, 2차 시장 미지원 (설계 결정)

### ALWAYS
- 모든 산술 연산은 `checked_*` 사용, 실패 시 `RwaError::MathOverflow`
- 반올림은 항상 **floor** (Rust 정수 나눗셈 기본값, 명시적 ceil 사용 금지)
- 새 instruction 추가 시 이 파일의 Error Codes, Decisions 섹션 업데이트
- 파라미터 범위 검증을 instruction 진입부 첫 번째로 배치

---

## Architecture

### Instruction 패턴 (3단계)

```
1. 검증 (require!)
   → 상태, 권한, 파라미터 범위, 경계값

2. CPI 실행
   → transfer_checked / mint_to / set_authority

3. 상태 업데이트
   → account 필드 변경, 상태 전환
```

### 상태 머신

```
Funding ──(완판 or deadline+goal)──► Funded ──(activate)──► Active
   │
   └──(deadline + goal 미달)──► Failed
```

| 상태 | purchase | cancel_position | release_funds | activate | distribute | claim | refund |
|------|---------|----------------|--------------|---------|-----------|-------|--------|
| Funding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Funded | ❌ | ❌ | ✅ (1회) | ✅ | ❌ | ❌ | ❌ |
| Active | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Failed | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### CPI 맵

```
purchase_tokens
  ├─ transfer_checked: investor_usdc → funding_vault  [usdc_token_program]
  └─ mint_to: token_mint → investor_rwa_account       [token_program Token-2022]

release_funds   → transfer_checked: funding_vault → authority_usdc
refund          → transfer_checked: funding_vault → investor_usdc
activate        → set_authority: MintTokens → None (영구 소각)
distribute      → transfer_checked: authority_usdc → usdc_vault
claim           → transfer_checked: usdc_vault → investor_usdc

create_booking_escrow  → transfer_checked: guest_usdc → escrow_vault  (Pyth로 KRW→USDC 변환)
release_booking_escrow → transfer_checked: escrow_vault → authority_usdc
cancel_booking_escrow  → transfer_checked: escrow_vault → guest_usdc
```

---

## BookingEscrow (예약 USDC 에스크로)

예약은 오프체인 DB(no gas), 결제만 온체인 USDC로 처리. Pyth 오라클로 KRW→USDC 온체인 변환.

### Account 구조

```rust
pub struct BookingEscrow {
    pub guest: Pubkey,
    pub listing_id: String,   // max 32바이트 (PDA seed 제한)
    pub booking_id: String,   // max 36바이트 (UUID)
    pub usdc_mint: Pubkey,
    pub amount_usdc: u64,     // micro-USDC (6자리)
    pub check_in: i64,        // Unix timestamp
    pub check_out: i64,
    pub status: EscrowStatus, // Pending | Released | Refunded
    pub bump: u8,
}
```

**PDA seeds**: `["booking_escrow", booking_id.as_bytes()]`
**Escrow vault**: ATA(usdc_mint, booking_escrow_pda)

### Instructions

| Instruction | 서명자 | 조건 | CPI |
|-------------|--------|------|-----|
| `create_booking_escrow(listing_id, booking_id, amount_krw, check_in, check_out)` | guest | check_in > now, amount_krw > 0 | guest_usdc → escrow_vault |
| `release_booking_escrow(booking_id)` | authority or crank_authority | status==Pending, now >= check_out | escrow_vault → host 90% + treasury 10% |
| `cancel_booking_escrow(booking_id)` | guest / authority / crank | status==Pending, (guest: now < check_in) | escrow_vault → guest_usdc 100% |
| `cancel_booking_escrow_partial(booking_id, guest_bps)` | authority or crank_authority | status==Pending, guest_bps 1~9999 | escrow_vault → guest guest_bps% + host 나머지 |

### Pyth KRW→USDC 변환 수학

Pyth USD/KRW 피드: "1 KRW당 USD" (raw_price × 10^expo = USD per KRW)

```
// expo는 음수 (예: -10)
// micro_usdc = amount_krw × raw_price × 1_000_000 / 10^|expo|
let divisor = 10u128.checked_pow((-expo) as u32);
let micro_usdc = (amount_krw as u128)
    .checked_mul(raw_price)?
    .checked_mul(1_000_000)?
    .checked_div(divisor)?;
amount_usdc = u64::try_from(micro_usdc)?;
```

검증:
- staleness: `price_feed.get_price_no_older_than(now, 60)` (60초 초과 시 StalePythPrice)
- confidence: `conf × 50 <= price` (2% 초과 시 PythConfidenceTooWide)

### Pyth 피드 주소

| 네트워크 | 피드 (USD/KRW) |
|----------|---------------|
| devnet   | `Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD` |
| mainnet  | `GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU` |
| Hermes REST feed_id | `e539120487c29b4defdf9a53d337316ea022a2688978a468f9efd847201be7e3` |

### skip-oracle 테스트 모드

Pyth 계정 없는 로컬/unit 테스트용:

```bash
# skip-oracle feature로 테스트 (1 USD = 1350 KRW 고정)
anchor test -- --features skip-oracle
```

```toml
# Cargo.toml [features]
skip-oracle = []  # Pyth 우회, amount_usdc = amount_krw * 1_000_000 / 1350
```

> **주의**: `bare anchor test`는 oracle feature 없이 실행되어 테스트가 skip-oracle 경로를 탐. 항상 `--features` 명시.

### 에러 코드 (6020~6024)

| 코드 | 이름 | 조건 |
|------|------|------|
| 6020 | StalePythPrice | Pyth 가격이 60초 이상 오래됨 |
| 6021 | PythConfidenceTooWide | 신뢰도 구간 > 2% (불안정한 시장) |
| 6022 | InvalidPythPrice | 가격 음수 또는 zero |
| 6023 | BookingNotPending | status != Pending |
| 6024 | CheckOutNotPassed | now < check_out (체크아웃 전 release 시도) |
| 6025 | InvalidRefundBps | guest_bps가 1~9999 범위 밖 |

---

> PDA Seeds 전체 테이블, Error Codes 상세 조건, 수학 명세, 테스트 케이스:
> `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` 참조

---

## DAO Program (`rural-rest-dao`)

별도 Anchor 프로그램. RWA 프로그램과 **완전 분리** (공유 상태 없음, CPI 없음).

### Dev Commands

```bash
# DAO 프로그램 빌드
cd programs/rural-rest-dao && anchor build

# DAO 테스트
anchor test -- --features dao

# IDL 복사
cp target/idl/rural_rest_dao.json web/app/anchor-idl/
```

### PDA Seeds

| Account | Seeds | 설명 |
|---------|-------|------|
| DaoConfig | `["dao_config"]` | DAO 설정 (1개) |
| Proposal | `["proposal", id.to_le_bytes()]` | 제안 |
| VoteRecord | `["vote", proposal_id.to_le_bytes(), voter.key()]` | 투표 기록 |

### Instructions (5개)

| Instruction | 서명자 | 핵심 동작 |
|-------------|--------|-----------|
| `initialize_dao` | authority | DaoConfig 초기화 |
| `create_proposal` | creator (Council Token) | Proposal 생성, total_eligible_weight 스냅샷 |
| `cast_vote` | voter | VoteRecord 생성, RWA+Council 투표권 합산, voter_count 증가 |
| `finalize_proposal` | 누구나 | 정족수/가결 판정, status 변경 |
| `cancel_proposal` | creator or authority | status → Cancelled |

### Critical Rules (DAO)

- **NEVER** RWA 프로그램에 CPI 호출 — InvestorPosition/PropertyToken은 remaining accounts로 **읽기만**
- **ALWAYS** remaining accounts의 각 account를 역직렬화 후 owner/status 검증
- **ALWAYS** 투표권 계산에 `checked_*` 산술 사용 (cap은 voting_cap_bps로 설정, MVP=10000 즉 cap 없음)
- **ALWAYS** VoteRecord PDA로 중복 투표 방지 (init constraint)

### Remaining Accounts 패턴

`cast_vote`:
```
remaining_accounts: [InvestorPosition_1, InvestorPosition_2, ...]
+ voter_council_ata (Optional) → Council Token 잔액 합산
→ RWA amount + Council amount 합산 → voting_cap_bps 적용 (MVP: 10000 = cap 없음)
```

`create_proposal`:
```
remaining_accounts: [PropertyToken_1, PropertyToken_2, ...]
+ council_mint (named account)
→ tokens_sold 합산 + council_mint.supply → total_eligible_weight
```

### 판정 로직

```
total_voted = votes_for + votes_against + votes_abstain
quorum_met = total_voted >= total_eligible_weight * quorum_bps / 10000
approval = votes_for >= (votes_for + votes_against) * approval_threshold_bps / 10000
→ !quorum_met: Defeated | approval: Succeeded | else: Defeated
```

> 구현 명세: `docs/03_Technical_Specs/08_DAO_IMPLEMENTATION_SPEC.md`
> 테스트 시나리오: `docs/05_QA_Validation/07_DAO_TEST_SCENARIOS.md`

---

## Decisions

작업하면서 내린 설계 결정 기록. 변경 시 이유와 함께 업데이트.

| 결정 | 내용 | 이유 |
|------|------|------|
| Council Token 투표권 | Council Token 보유자도 cast_vote로 투표 가능 (1:1 가중치) | 마을/지자체는 RWA 미보유, 운영 주체의 공식 의사 표현 필요 |
| RWA 토큰 양도 불가 | `non_transferable` extension 적용 | 2차 시장 미지원, investor_position PDA 불일치 버그 방지 |
| `open_position` 분리 | `init_if_needed` → `open_position` + `purchase_tokens` 분리 | 재초기화 공격 방지, 명시적 constraint |
| `funds_released: bool` | `PropertyToken`에 필드 추가 | `release_funds` 중복 호출 방지 |
| `usdc_mint` 저장 | `PropertyToken`에 `usdc_mint: Pubkey` 필드 추가 | 가짜 mint 주입 방지 |
| `PRECISION = 1e12` | 모듈 레벨 상수 | u64 overflow 방지, 소수점 6자리 USDC 정밀도 유지 |
| 반올림 floor | 전체 연산 floor | 일관성, dust는 vault에 잔류 |
| `listing_id` max 32바이트 | Solana PDA seed 제한 | UUID(36바이트) 직접 사용 불가 |
| `authority` 신뢰 모델 | `net_revenue_usdc` 수동 입력 허용 | 오프체인 임대 수익 검증은 계약으로 처리, 온체인 oracle 미도입 |
| 월별 중복 분배 허용 | `distribute_monthly_revenue` 호출 횟수 제한 없음 | authority 신뢰 + 운영 유연성 우선 |
| mainnet: Squads multisig | authority → multisig 전환 필수 | single key 해킹/분실 시 자금 위험 |
| voting_cap_bps MVP=10000 | 개인 투표 캡 제거, 완전 토큰 비례 투표 | MVP 단계에서 기관 투자자 없음; 향후 기관 cap 별도 도입 예정 |
| voter_count 온체인 저장 | Proposal에 `voter_count: u32` 추가, cast_vote 시 +1 | UI에서 "X표 / 전체 Y표 (Z명 참여)" 표시 위해 RPC 추가 호출 없이 조회 |
| mainnet: audit 필수 | Sec3 + OtterSec | 실제 투자금 보호 |
| BookingEscrow PDA | seeds: ["booking_escrow", booking_id] | booking_id = UUID 36바이트, PDA별 독립 에스크로 |
| KRW→USDC 온체인 변환 | Pyth USD/KRW 피드, checked 산술, u128 중간값 | 오프체인 환율 하드코딩 불신, trustless 변환 |
| skip-oracle feature | 테스트 시 Pyth 우회 (1350 KRW/USD 고정) | 로컬 테스트 환경에서 Pyth 계정 불필요 |
| release_booking: crank_authority | rwa_config.crank_authority도 release 가능 | 자동 정산 크론잡 지원 |

---
