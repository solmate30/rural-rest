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
