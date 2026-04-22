# 환불 및 수수료·정산 정책 (Refund & Treasury Policy)

> Created: 2026-04-21 16:00
> Last Updated: 2026-04-21 16:00

## 1. 문서 목적

예약 수익이 **어디로, 언제, 얼마나** 흐르는지 단일한 기준을 정의한다. 팀원
누구든 이 문서만 읽어도 플랫폼 수수료·운영자 정산·투자자 배당·환불 정책을
이해할 수 있어야 한다.

관련 기존 문서:
- `docs/00_ARCHIVE/future_blockchain/09_SOLANA_PAYMENT_SPEC.md` — 최초 설계(10%/90% 이분 구조)
- `docs/04_Logic_Progress/13_SETTLEMENT_ARCHITECTURE.md` — 영업이익 40/30/30 분배
- `docs/04_Logic_Progress/01_BOOKING_STATE_MACHINE.md` — 예약 상태 전이
- `anchor/CLAUDE.md` — Anchor 프로그램 규칙

---

## 2. 핵심 원칙

1. **Listing별로 자금이 격리된다.** A숙소 예약금은 A숙소 투자자·운영자에게만
   귀속된다. PDA seeds에 `listing_id`를 포함해 on-chain에서 물리적 분리.
2. **플랫폼이 custodial 주체다.** 운영자 개인 지갑은 즉시 수령 대상이 아니며,
   모든 자금은 플랫폼이 제어하는 vault 또는 treasury를 거친다.
3. **결제수단에 무관하게 같은 결과.** USDC 결제든 PayPal 카드 결제든
   최종 분배 규칙은 동일하다.
4. **월정산 전까지 운영자·지자체·투자자 지급은 발생하지 않는다.** 즉시 지급은
   플랫폼 수수료(10%)뿐.

---

## 3. Phase 1 아키텍처 (현재 목표)

### 3.1. 자금 흐름

```
[예약 결제]
  USDC → booking_escrow PDA (booking_id별)
  Card → 플랫폼 PayPal 계정

[체크아웃 후 release]
  USDC:
    booking_escrow
      ├─ 10% → treasury wallet (플랫폼 공용)
      └─ 90% → listing_vault PDA (listing_id별, 신규 도입)
  Card:
    플랫폼 PayPal 잔고 유지
    DB에 platformFeeKrw(10%) / listingRevenueKrw(90%) 기록

[월정산 (매월 말일, listing별로 실행)]
  listing_vault(USDC) + DB credit(KRW 환산) = 해당 listing의 월 매출
    ├─ 운영비 차감 (수동 입력, 향후 자동화)
    └─ 영업이익 기준으로:
        ├─ 40% → 지자체 지갑 (USDC) / 계좌이체 (KRW)
        ├─ 30% → 운영자 지갑 (USDC) / 계좌이체 (KRW)
        └─ 30% → 해당 listing의 usdc_vault (투자자 배당, claim 방식)
```

### 3.2. 신규 PDA: `listing_vault`

| 항목 | 값 |
|------|-----|
| Seeds | `["listing_vault", listing_id]` |
| 용도 | 예약 수익 90%를 월정산 전까지 보관 |
| Token | USDC (listing별 ATA) |
| Authority | `rwa_config.authority` (플랫폼) |

**기존 `usdc_vault`(배당 vault)와 구분**:
- `usdc_vault`: 월정산 시 투자자 몫(30%)을 넣고, 투자자가 claim
- `listing_vault`: 예약금 90%의 임시 저장소, 월정산 시 분배 출발점

### 3.3. 신규 Anchor Instruction: `settle_listing_monthly`

```rust
pub fn settle_listing_monthly(
    ctx: Context<SettleListingMonthly>,
    listing_id: String,
    operating_cost_usdc: u64,   // 운영비 (오프체인 계산값, authority가 입력)
    gov_bps: u16,               // 기본 4000 (40%)
    operator_bps: u16,          // 기본 3000 (30%)
    investor_bps: u16,          // 기본 3000 (30%)
) -> Result<()>
```

**동작:**
1. 해당 매물의 수익 금고에 쌓인 USDC 전액에서 이번 달 실제 지출 운영비를 차감해 영업이익을 구합니다.
2. 영업이익의 40%를 지자체 계좌로 송금합니다 (토지 임대료 성격).
3. 영업이익의 30%를 마을운영자 계좌로 송금합니다 (현장 운영 보수).
4. 영업이익의 30%를 해당 매물의 투자자 배당 풀에 적립합니다. 투자자는 이후 자신의 지분에 비례해 개별 청구합니다.
5. 차감했던 운영비는 플랫폼 계좌로 회수됩니다. 플랫폼이 추후 실제 공급업체에게 지급합니다.

**검증:**
- `gov_bps + operator_bps + investor_bps == 10000`
- Authority(플랫폼) 서명만 허용
- 이미 해당 월 정산 실행됐는지 `PropertyToken.last_settled_month` 체크 (중복 방지)

### 3.4. 환불 정책 (archived spec 준수)

| 체크인까지 남은 시간 | 환불 비율 | 호스트/투자자 귀속 |
|---|---|---|
| 7일 이상 | 100% | 0% |
| 3일 이상 ~ 7일 미만 | 50% | 50% (listing_vault로 release) |
| 3일 미만 | 0% | 100% (listing_vault로 release) |

**0% 환불 시 booking status:**
- `status = "completed"` (운영자·투자자 수익으로 귀속되므로 실제 숙박과 동일 처리)
- 이는 취소 이벤트이지만 회계상 매출 인식.

### 3.5. 운영 결정사항 (Phase 1 확정)

| 항목 | 결정 | 비고 |
|------|------|------|
| 지자체 지갑 주소 | `listings.govWalletAddress` (nullable). Null이면 환경변수 `DEFAULT_GOV_WALLET` fallback | 매물별 지자체가 다를 수 있음 |
| 지자체 미등록 처리 | 운영자·투자자 몫은 정상 분배, 지자체 몫은 `settlements.govShareUsdc`에 기록하되 미전송(pending) 상태 | 나중에 등록되면 batch payout |
| 운영비 입력 | 어드민이 `/admin/settlements` UI에서 월정산 시 수동 입력 | Phase 2에서 청소비·공과금 on-chain 누적으로 자동화 |
| 정산 트리거 | 어드민 수동 실행 (`[정산 미리보기] → [확정]` 2-step). cron 자동화 없음 | 안전성 우선, 매월 말일 ~ 다음달 5일 사이 실행 |

### 3.6. DB 변경사항

`bookings` 테이블:
- `platformFeeKrw` (기존): 계속 사용, **USDC 예약에도 저장** (KRW 환산값)
- `platformFeeUsdc` (신규, nullable): USDC 결제 시 실제 10% 수수료(micro-USDC)
- `listingRevenueKrw` (신규): 90% 금액 KRW 환산 (카드 예약용)

`listings` 테이블:
- `govWalletAddress` (신규, nullable): 지자체 USDC 지갑 주소. Null이면 전역 기본값 사용.

신규 테이블 `settlements` (감사 추적용):
- `id`, `listingId`, `month`, `totalRevenueUsdc`, `operatingCostUsdc`,
  `govShareUsdc`, `operatorShareUsdc`, `investorShareUsdc`,
  `onchainTxSignature`, `createdAt`

---

## 4. Phase 2 로드맵 (향후)

| 항목 | 내용 | 이유 |
|------|------|------|
| 4-way auto split | release 시점에 on-chain에서 바로 4분할 | 운영비를 예측값으로 on-chain에 커밋, 신뢰 최소화 |
| Fiat→USDC 브릿지 | PayPal 매출도 월정산 시 USDC로 환전 | USDC/Card 플로우 완전 일원화 |
| 운영비 실시간 기록 | 청소·공과금을 on-chain에 incremental로 기록 | 월정산 authority의 수동 입력 제거 |
| 투자자 auto-claim | EBS 구독자처럼 지갑에 배당이 push | UX 개선 |

---

## 5. 운영 전 요건

기술 구현·테스트 작업은 `docs/04_Logic_Progress/00_BACKLOG.md` 참조. 본 문서는
정책이 실제 운영에 투입되기 위해 **비기술적으로** 선행되어야 하는 항목만 관리한다.

- [ ] 운영자 계약서에 "월정산 전까지 수익 지급 없음" 명시 조항 추가
- [ ] 지자체 USDC 지갑 주소 사전 등록 프로세스 수립 (매물 등록 단계 포함)
- [ ] 세무 자문: 플랫폼 매출(10%) 및 영업이익 배당의 세목 정의
- [ ] 법률 자문: 투자자 배당의 증권법 적용 여부 확인
