# RWA Monthly Dividend Distribution Logic (DeFi Staking Model)

> Created: 2026-03-10
> Last Updated: 2026-03-23
> 이전 버전(실시간 배당)은 미완성 초안이었음. 실제 정책은 월별 순이익 기준 배당.

---

## 0. 배당 정책 (비즈니스 룰)

- **배당 주기**: 월 1회, 매월 말 운영자가 호출
- **배당 기준**: 순이익 = 총 숙박 매출 − 인건비 − 운영비 − 기타 비용
- **적자 월**: 배당 없음 (0). 음수 배당 없음, 손실 이월 없음
- **배당 실행자**: 플랫폼 운영자 (authority) 만 호출 가능
- **투자자 수령**: 아무 때나 `claim_dividend` 호출로 수령 가능

---

## 1. 핵심 개념

### 왜 이 알고리즘이 필요한가?

투자자가 수백 명이어도 배당 분배가 **O(1)** — 투자자 수에 무관하게 단 한 번의 연산으로 끝남.
전통 방식(투자자마다 개별 송금)은 솔라나 Compute Unit 한도를 금방 초과해서 불가능.

### 글로벌 상태: `acc_dividend_per_share` (누적 주당 배당액)

`PropertyToken` 계정에 저장. 월별 배당 분배 때마다 증가.

```
새 acc_dividend_per_share = 기존 값 + (순이익 × PRECISION) / 판매된 토큰 수
```

`PRECISION = 1_000_000_000_000 (1e12)` — 정수 연산에서 소수점 손실 방지.

### 개인 상태: `reward_debt` (수령 부채)

`InvestorPosition` 계정에 저장. "이 투자자는 이 시점까지의 배당을 이미 받은 것으로 간주"라는 영수증.

```
미수령 배당 = (보유 토큰 수 × acc_dividend_per_share) / PRECISION - reward_debt
```

---

## 2. 전체 흐름

### Step 1. 토큰 구매 (`purchase_tokens`)

투자자 A가 토큰 10개 구매. 이 시점 `acc_dividend_per_share = 5_000_000_000_000` (= 5 USDC × 1e12).

```
position.amount = 10
position.reward_debt = (10 × 5_000_000_000_000) / 1e12 = 50 USDC
```

의미: 구매 전에 쌓인 배당 50 USDC는 A의 몫이 아님을 수학적으로 기록.

---

### Step 2. 월별 배당 분배 (`distribute_monthly_revenue`)

월말 운영자가 순이익 1,000 USDC 확인 후 호출. 현재 판매된 토큰 100개.

```
added = (1,000 × 1e12) / 100 = 10_000_000_000_000
새 acc_dividend_per_share = 5_000_000_000_000 + 10_000_000_000_000 = 15_000_000_000_000
```

투자자 수와 무관하게 이 덧셈 1번만 일어남.

---

### Step 3. 배당 수령 (`claim_dividend`)

투자자 A가 claim 호출.

```
미수령 = (10 × 15_000_000_000_000) / 1e12 - 50
       = 150 - 50
       = 100 USDC
```

수령 후 reward_debt 갱신: `10 × 15_000_000_000_000 / 1e12 = 150`
→ 다시 claim해도 (150 - 150 = 0), 중복 수령 불가.

---

## 3. 정밀도 처리

솔라나/Rust는 부동소수점 미지원. `PRECISION = 1e12` 사용.

```
나쁜 예 (정밀도 없음):
  순이익 100 USDC, 토큰 1,000,000개
  added = 100 / 1,000,000 = 0  ← 전액 소실

좋은 예 (1e12 적용):
  added = (100 × 1_000_000_000_000) / 1,000,000 = 100_000_000
  토큰 1개 보유자 수령: 100_000_000 / 1e12 = 0.0001 USDC ← 정확
```

USDC는 6 decimals (1 USDC = 1,000,000 micro-USDC). 컨트랙트 내부는 micro-USDC 단위로 처리.

---

## 4. Anchor instruction 요약

| Instruction | 호출자 | 시점 | 역할 |
|---|---|---|---|
| `purchase_tokens` | 투자자 | 구매 시 | reward_debt 초기 설정 |
| `distribute_monthly_revenue` | 운영자(authority) | 월말 | acc_dividend_per_share 업데이트 |
| `claim_dividend` | 투자자 | 아무 때나 | 미수령 배당 USDC 수령 |

---

## 5. 관련 문서

- `docs/03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md` — 배당 정책 원문
- `anchor/programs/rural-rest-rwa/src/lib.rs` — 실제 구현
