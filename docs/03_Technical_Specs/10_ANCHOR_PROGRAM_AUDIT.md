# 10. Anchor 프로그램 감사 (CU / 보안 / 산술)

생성: 2026-03-28 17:00
업데이트: 2026-03-28 (P0/P1 수정 반영)

대상 파일: `anchor/programs/rural-rest-rwa/src/lib.rs`
프로그램 ID: `EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR`

---

## 1. Compute Unit (CU) 가이드

### 1.1 Solana CU 기본 개념

| 항목 | 값 |
|------|-----|
| 기본 트랜잭션 CU 한도 | 200,000 CU |
| 최대 요청 가능 CU | 1,400,000 CU |
| SPL Token CPI (transfer_checked) | ~4,000–6,000 CU |
| SPL Token CPI (mint_to) | ~4,000–6,000 CU |
| SPL Token CPI (set_authority) | ~3,000–4,000 CU |
| PDA 파생 (find_program_address) | ~300–500 CU |
| 계정 직렬화/역직렬화 | ~100–500 CU/계정 |
| SHA256 해시 1회 | ~200 CU |

**기본 200,000 CU는 단순 instruction에 충분하지만, 명시적으로 설정하지 않으면 불필요한 비용을 지불.**

### 1.2 Instruction별 CU 예상 및 권장 한도

| Instruction | 계정 수 | CPI 수 | 예상 소비 CU | 권장 한도 |
|-------------|--------|--------|------------|----------|
| `initialize_property` | 10 | 0 (Anchor 내부 계정 생성) | ~20,000–30,000 | 50,000 |
| `open_position` | 5 | 0 | ~5,000–8,000 | 15,000 |
| `purchase_tokens` | 10 | 2 (transfer + mint_to) | ~25,000–40,000 | 70,000 |
| `release_funds` | 7 | 1 (transfer) | ~12,000–18,000 | 30,000 |
| `refund` | 8 | 1 (transfer) | ~12,000–18,000 | 30,000 |
| `activate_property` | 4 | 1 (set_authority) | ~8,000–12,000 | 20,000 |
| `distribute_monthly_revenue` | 7 | 1 (transfer) | ~12,000–18,000 | 30,000 |
| `claim_dividend` | 8 | 1 (transfer) | ~15,000–20,000 | 35,000 |
| `cancel_position` | 9 | 2 (burn + transfer) | ~18,000–28,000 | 40,000 |

> 수치는 SPL Token CPI 단가 기반 이론 추정값 — devnet 실측 필요 (§1.3 참조).
> 최초 구매 시 `open_position` + `purchase_tokens` 두 instruction을 preInstructions로 묶어 단일 tx 전송.

### 1.3 실제 CU 측정 방법

**방법 1: solana logs (devnet)**
```bash
solana logs --url devnet | grep "consumed"
# 출력 예: Program consumed 28453 of 200000 compute units
```

**방법 2: 프로그램 내부 로깅**
```rust
use anchor_lang::solana_program::log::sol_log_compute_units;

pub fn purchase_tokens(...) -> Result<()> {
    sol_log_compute_units(); // 시작 시점 CU 로그
    // ... 로직 ...
    sol_log_compute_units(); // 종료 시점 CU 로그
    Ok(())
}
```

**방법 3: Anchor test에서 측정**
```typescript
const tx = await program.methods.purchaseTokens(listingId, amount)
  .accounts({...})
  .rpc({ commitment: "confirmed" });

const txInfo = await provider.connection.getTransaction(tx, {
  commitment: "confirmed",
  maxSupportedTransactionVersion: 0,
});
console.log("CU used:", txInfo?.meta?.computeUnitsConsumed);
```

### 1.4 클라이언트에서 CU 한도 명시적 설정

```typescript
import { ComputeBudgetProgram } from "@solana/web3.js";

const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
  units: 70_000, // purchase_tokens 기준
});

const setPriority = ComputeBudgetProgram.setComputeUnitPrice({
  microLamports: 1_000, // 우선순위 수수료 (혼잡 시 높임)
});

const tx = new Transaction()
  .add(modifyComputeUnits)
  .add(setPriority)
  .add(purchaseIx);
```

> Anchor의 `.preInstructions([modifyComputeUnits, setPriority])` 패턴으로 간결하게 추가 가능.

---

## 2. CPI 맵

```
initialize_property
  └─ (없음, Anchor init이 내부 처리)

purchase_tokens
  ├─ transfer_checked: investor_usdc → funding_vault  [usdc_token_program]
  └─ mint_to: token_mint → investor_rwa_account       [token_program (Token-2022)]

release_funds
  └─ transfer_checked: funding_vault → authority_usdc [usdc_token_program]

refund
  └─ transfer_checked: funding_vault → investor_usdc  [usdc_token_program]

activate_property
  └─ set_authority: token_mint MintTokens → None      [token_program (Token-2022)]

distribute_monthly_revenue
  └─ transfer_checked: authority_usdc → usdc_vault    [usdc_token_program]

claim_dividend
  └─ transfer_checked: usdc_vault → investor_usdc     [usdc_token_program]

cancel_position
  ├─ burn: investor_rwa_account                       [token_program (Token-2022)]
  └─ transfer_checked: funding_vault → investor_usdc  [usdc_token_program]
```

**주의사항:**
- Token-2022 (`token_program`)와 표준 SPL Token (`usdc_token_program`) 두 개를 혼용. 계정 전달 시 프로그램 혼동 주의.
- `purchase_tokens`만 2 CPIs — 가장 무거운 instruction.

---

## 3. 산술 연산 checked 감사

### 3.1 전체 결과

| Instruction | 연산 | checked 여부 | 비고 |
|-------------|------|-------------|------|
| `purchase_tokens` | `tokens_sold + amount` | ✅ checked_add | |
| `purchase_tokens` | `current_amount + amount` | ✅ checked_add | |
| `purchase_tokens` | `amount * price_per_token_usdc` | ✅ u128 checked_mul | |
| `purchase_tokens` | `reward_debt + (amount * acc_dps)` | ✅ checked_add/mul | |
| `purchase_tokens` | `position.amount + amount` | ✅ checked_add | |
| `purchase_tokens` | `property.tokens_sold + amount` | ✅ checked_add | |
| `purchase_tokens` | `total_supply / 10` | ⚠️ **unchecked 나눗셈** | 아래 참조 |
| `release_funds` | `total_supply * min_funding_bps` | ✅ u128 checked_mul | |
| `refund` | `total_supply * min_funding_bps` | ✅ u128 checked_mul | |
| `refund` | `position.amount * price_per_token` | ✅ u128 checked_mul | |
| `distribute_monthly_revenue` | `revenue * PRECISION` | ✅ checked_mul | |
| `distribute_monthly_revenue` | `/ tokens_sold` | ✅ checked_div | ⚠️ 0-나눗셈 위험 (아래 참조) |
| `distribute_monthly_revenue` | `acc_dps + added` | ✅ checked_add | |
| `claim_dividend` | `amount * acc_dps` | ✅ checked_mul | |
| `claim_dividend` | `/ PRECISION` | ✅ checked_div | |
| `claim_dividend` | `gross - reward_debt` | ✅ checked_sub | |

### 3.2 발견된 이슈

**이슈 A: `total_supply / 10` 미검사** — `total_supply`는 설계상 100,000,000 고정이므로 실질적 위험 없음. 주석으로 명시.

**이슈 B: `distribute_monthly_revenue`에서 `tokens_sold = 0` 시 MathOverflow** — Active 상태 도달 조건에 의해 tokens_sold > 0 보장. `ZeroRevenue(6013)` 에러 추가로 0 금액 입력은 사전 차단됨. **완화 완료.**

**이슈 C: `PRECISION` 상수 중복 정의** → 모듈 레벨 `const PRECISION: u128 = 1_000_000_000_000;`으로 통합. **수정 완료.**

---

## 4. 보안 이슈 목록

### 4.1 `init_if_needed` — `investor_position` [수정 완료]

`open_position` instruction으로 분리. `purchase_tokens`에서 `init_if_needed` 제거.
`investor_position.owner == investor` 및 `investor_position.token_mint == property_token.token_mint` constraint 추가.

### 4.2 `init_if_needed` — `investor_rwa_account` [변경 불필요]

ATA에 대한 `init_if_needed`는 Solana 표준 관행. PDA 파생 결정론적 → 재초기화 공격 불가.

### 4.3 `release_funds` 중복 호출 가능 [수정 완료]

`PropertyToken.funds_released: bool` 플래그 추가. `release_funds` 첫 번째 호출 후 `true`로 설정.
두 번째 호출 시 `FundsAlreadyReleased(6014)` 에러.

### 4.4 `valudation_krw` 오타 [수정 완료]

`valuation_krw`로 수정. IDL 재생성 완료. 프론트엔드 전파 완료.

### 4.5 가짜 USDC mint 주입 가능 [수정 완료]

`PropertyToken.usdc_mint: Pubkey` 저장. 모든 instruction에 `#[account(address = property_token.usdc_mint)]` constraint 추가.

---

## 5. 에러 코드 참조

전체 에러 코드는 `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` §4 참조 (6000~6017, 18개).

---

## 6. 잔여 항목 (Stage 2)

P0/P1 이슈는 모두 수정 완료. 아래는 devnet 안정화 이후 처리:

| # | 항목 | mainnet 필수 | 비고 |
|---|------|------------|------|
| 1 | 클라이언트 CU 한도 명시적 설정 | 권장 | §1.4 코드 참조 |
| 2 | `non_transferable` Token-2022 extension | 권장 | 2차 시장 지원 시 필수 |
| 3 | `emit!` 이벤트 (PurchaseEvent 등) | 권장 | 인덱서 연동용 |
| 4 | `investor_position` close (환불 후 rent 회수) | 권장 | |
| 5 | devnet CU 실측 후 §1.2 수치 업데이트 | 권장 | 현재 이론 추정값 |
