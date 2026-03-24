# 13. RWA 펀딩 에스크로 & 환불 로직

> Created: 2026-03-24 00:00
> Last Updated: 2026-03-24 00:00

---

## 1. 배경

`purchase_tokens`에서 USDC를 운영자 계좌로 바로 보내면 펀딩 실패 시 환불이 불가능하다(운영자가 온라인이어야 하고, 신뢰가 필요함). 온체인에서 신뢰 없이 환불을 처리하려면 **에스크로 볼트(PDA 소유 USDC 계좌)**가 필요하다.

---

## 2. 정책 (docs/03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md 기준)

| 항목 | 값 |
|---|---|
| 세일 기간 | 4~8주 (운영자가 매물 등록 시 직접 설정) |
| 최소 판매율 | 60% (default, `min_funding_bps = 6000`) |
| 미달 시 처리 | 전액 환불 + 토큰화 취소 (`Failed` 상태) |

---

## 3. 계정 구조

### funding_vault (에스크로 볼트)
- **seeds**: `[b"funding_vault", listing_id.as_bytes()]`
- **authority**: `property_token` PDA
- **역할**: 펀딩 기간 동안 투자자 USDC 보관
- 배당용 `usdc_vault`(ATA)와 **별개**

### usdc_vault (배당 볼트)
- **seeds**: ATA(usdc_mint, property_token)
- **역할**: Active 상태에서 월 배당금 보관

---

## 4. 상태 전환 다이어그램

```
initialize_property
        ↓
   [Funding]  ← purchase_tokens (USDC → funding_vault)
     /    \
완판      deadline 경과
  ↓           ↓
[Funded]   tokens_sold ≥ 60%?
  ↓          Yes → release_funds → [Funded]
activate        No → refund 가능 → [Failed]
  ↓
[Active]  ← distribute_monthly_revenue
              claim_dividend
```

---

## 5. Instruction별 로직

### `initialize_property`
- 파라미터: `funding_deadline: i64` (Unix timestamp), `min_funding_bps: u16`
- `funding_deadline > 현재 시각` 검증
- `funding_vault` (에스크로) + `usdc_vault` (배당용) 동시 생성

### `purchase_tokens`
- 조건: `status == Funding` AND `now <= funding_deadline`
- USDC → `funding_vault` (에스크로)
- deadline 초과 시 `FundingExpired` 에러

### `release_funds` (운영자 전용)
- 조건: 완판(Funded) OR (deadline 경과 + tokens_sold ≥ min_threshold)
- `funding_vault` → `authority_usdc_account`
- deadline 달성 케이스면 `Funding → Funded` 전환

### `refund` (투자자 전용)
- 조건: `deadline 경과` AND `tokens_sold < min_threshold`
- `funding_vault` → `investor_usdc_account` (property_token PDA 서명, 신뢰 불필요)
- 환불액 = `position.amount × price_per_token_usdc`
- `status → Failed`, `position.amount → 0`

### `activate_property`
- 조건: `status == Funded`
- `Funded → Active`

---

## 6. 에러 코드

| 에러 | 발생 상황 |
|---|---|
| `FundingExpired` | deadline 이후 purchase_tokens 시도 |
| `RefundNotAvailable` | 환불 조건 미충족 (목표 달성 or deadline 미경과) |
| `AlreadyRefunded` | position.amount == 0 인데 refund 호출 |
| `InvalidDeadline` | deadline이 현재 시각 이전 |
| `ReleaseNotAvailable` | release_funds 조건 미충족 |

---

## 7. 핵심 수식

```
min_threshold = total_supply × min_funding_bps / 10_000

환불액 = position.amount × price_per_token_usdc

goal_met   = tokens_sold >= min_threshold
goal_failed = tokens_sold < min_threshold
```

---

## 8. 관련 파일
- `anchor/programs/rural-rest-rwa/src/lib.rs`
- `docs/03_Technical_Specs/09_RWA_ISSUANCE_SPEC.md`
- `docs/04_Logic_Progress/11_RWA_DIVIDEND_LOGIC.md`
- `docs/04_Logic_Progress/12_RWA_KNOWN_ISSUES.md`
