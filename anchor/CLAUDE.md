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
```

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
| `cast_vote` | voter | VoteRecord 생성, 투표권 합산 + 10% 캡 |
| `finalize_proposal` | 누구나 | 정족수/가결 판정, status 변경 |
| `cancel_proposal` | creator or authority | status → Cancelled |

### Critical Rules (DAO)

- **NEVER** RWA 프로그램에 CPI 호출 — InvestorPosition/PropertyToken은 remaining accounts로 **읽기만**
- **ALWAYS** remaining accounts의 각 account를 역직렬화 후 owner/status 검증
- **ALWAYS** 투표권 계산에 `checked_*` 산술 사용, 캡 적용은 `min(raw, cap)`
- **ALWAYS** VoteRecord PDA로 중복 투표 방지 (init constraint)

### Remaining Accounts 패턴

`cast_vote`:
```
remaining_accounts: [InvestorPosition_1, InvestorPosition_2, ...]
→ 각 account: owner == voter 검증 + amount 합산 → 캡 적용
```

`create_proposal`:
```
remaining_accounts: [PropertyToken_1, PropertyToken_2, ...]
→ 각 account: status == Active 검증 + tokens_sold 합산 → total_eligible_weight
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
| mainnet: audit 필수 | Sec3 + OtterSec | 실제 투자금 보호 |

---
