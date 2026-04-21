# 13. 정산 아키텍처 — 3자 분배 설계

> Created: 2026-03-25
> Updated: 2026-04-21

> **선행 문서**: `docs/04_Logic_Progress/15_REFUND_AND_TREASURY_POLICY.md`
> — 이 문서는 "영업이익 3자 분배" 단계만 다룬다. 예약금 10%/90% 분리,
>   `listing_vault` PDA, 환불 정책은 15번 문서에서 정의한다.

---

## 0. 분배 구조 요약

### 자금 흐름 전체 (15번 문서 요약)

```
예약금 100% → booking_escrow
체크아웃 release → 10% treasury (플랫폼 수수료, 즉시)
                 → 90% listing_vault (월정산 대기)
월정산 → listing_vault − 운영비 = 영업이익 → 아래 3자 분배
```

**주의**: 이 문서의 "매출"과 "영업이익"은 **`listing_vault`에 쌓인 90% 기준**이다.
플랫폼 10% 수수료는 release 시점에 이미 선제외됐으므로 월정산 계산에 포함되지 않는다.

### 영업이익 3자 분배

Rural Rest 플랫폼은 월 숙박 영업이익을 3자에게 분배한다:

| 대상 | 비율 | 방식 | 주체 |
|------|------|------|------|
| **지자체** | 40% | 온체인 push (어드민 → 지자체 고정 지갑) | 어드민 자동 |
| **마을 운영자** | 30% | 온체인 push (어드민 → 운영자 지갑) | 어드민 자동 |
| **RWA 투자자** | 30% | 온체인 pull (투자자 → vault에서 claim) | 투자자 직접 |

### 왜 push vs pull 구분인가?

- **지자체/운영자**: 단일 수신자, 기관 파트너 → 어드민이 직접 전송(push). 단순하고 실용적.
- **투자자**: 수십~수천 명, 지분 비율 계산 필요, 트러스트리스 필요 → 에스크로(vault) 기반 claim(pull). 투자자가 자신의 몫을 직접 검증하고 수령.

---

## 1. 월 정산 플로우

```
어드민 /admin/settlements 접속
    ↓
미정산 매물에 [정산하기] 클릭
    ↓
Step 1: 운영비 입력 (숙박 매출 = listing_vault 온체인 잔고 + 카드 매출 KRW credit)
    ↓
Step 2: dryRun API 호출 → 분배 미리보기
    영업이익 = 매출 - 운영비
    지자체 40%  operatingProfit * 0.4 / KRW_PER_USDC
    운영자 30%  operatingProfit * 0.3 / KRW_PER_USDC
    투자자 30%  operatingProfit * 0.3 / KRW_PER_USDC
    ↓
Step 3: [정산 확정] → POST /api/admin/monthly-settlement { dryRun: false }
    ↓
DB 기록:
    - local_gov_settlements (지자체 40%, payoutTx 자동 생성)
    - operator_settlements  (운영자 30%, payoutTx 자동 생성)
    - rwa_dividends         (투자자별 배당 기록, claimTx = null)
```

---

## 2. 투자자 Claim 플로우

```
투자자 /my-investments 접속 (Phantom 연결 필요)
    ↓
미수령 배당 표시 → [Claim] 버튼 클릭
    ↓
ClaimButton.tsx:
    1. Anchor program.methods.claimDividend(listingId) 호출
    2. 온체인 tx 서명 수령
    3. POST /api/rwa/claim-dividend { rwaTokenId, walletAddress, claimTx }
    ↓
DB 업데이트:
    rwaDividends.claimTx = tx 서명
    rwaDividends.claimedAt = now
```

---

## 3. DB 테이블 구조

### `local_gov_settlements`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | UUID v4 |
| listingId | text FK | 매물 ID |
| month | text | "2026-03" 형식 |
| grossRevenueKrw | integer | 숙박 매출 합계 |
| operatingProfitKrw | integer | 영업이익 |
| settlementUsdc | integer | 지자체 몫 micro-USDC (40%) |
| govWalletAddress | text | 지자체 수령 지갑 (환경변수 `VITE_LOCAL_GOV_WALLET`) |
| payoutTx | text | Solana push tx 서명 (devnet: `gov_payout_...`) |
| paidAt | timestamp | 자동 지급 시각 |

### `operator_settlements`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | UUID v4 |
| operatorId | text FK | 운영자 user.id |
| listingId | text FK | 매물 ID |
| month | text | "2026-03" 형식 |
| grossRevenueKrw | integer | 숙박 매출 합계 |
| operatingCostKrw | integer | 운영비 |
| operatingProfitKrw | integer | 영업이익 |
| settlementUsdc | integer | 운영자 몫 micro-USDC (30%) |
| payoutTx | text | Solana push tx 서명 (devnet: `op_payout_...`) |
| paidAt | timestamp | 자동 지급 시각 |

### `rwa_dividends`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | text PK | `div-{tokenId}-{month}-{wallet[:8]}` |
| walletAddress | text | 투자자 Solana 지갑 |
| rwaTokenId | text FK | RWA 토큰 ID |
| month | text | "2026-03" 형식 |
| dividendUsdc | integer | 배당액 micro-USDC (지분 비례) |
| claimTx | text | 투자자 claim tx 서명 (null = 미수령) |
| claimedAt | timestamp | 수령 시각 |

---

## 4. 환경변수

```bash
# .env
VITE_LOCAL_GOV_WALLET=GovWa11etXXXXXXXXX...  # 지자체 고정 수령 지갑
VITE_RWA_PROGRAM_ID=EmtyjF4cDpTN6gZYsDPrFJBdAP8G2Ap3hsZ46SgmTpnR
VITE_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
```

---

## 5. Admin 정산 페이지 UI

`/admin/settlements` 테이블 열:
- **매물** — 썸네일 + 이름
- **숙박 매출** — KRW + 예약 건수
- **운영비** — KRW
- **영업이익** — KRW
- **분배 내역** — 정산 완료 시 지자체/운영자/투자자 3자 USDC 표시
- **상태** — 정산하기 버튼 / 완료 배지

---

## 6. local → devnet → mainnet 차이

| 항목 | local (현재) | devnet | mainnet |
|------|------|------|------|
| 지자체 push tx | `createTransferCheckedInstruction` (실제 tx) | 동일 | 동일 |
| 운영자 push tx | `createTransferCheckedInstruction` (실제 tx) | 동일 | 동일 |
| 투자자 claim | Anchor `claimDividend` on localhost:8899 | devnet RPC | mainnet RPC |
| USDC mint | devnet Circle faucet USDC | 동일 | USDC mainnet mint |
| authority | 단일 키 | 동일 | Squads multisig 필수 |

---

## 7. 관련 파일

```
web/app/routes/api.admin.monthly-settlement.ts  — 월 정산 API (dryRun 지원)
web/app/components/admin/MonthlySettlementButton.tsx  — 3단계 정산 모달
web/app/routes/admin.settlements.tsx  — 정산 관리 페이지
web/app/components/investments/ClaimButton.tsx  — 투자자 claim UI
web/app/routes/api.rwa.claim-dividend.ts  — claim 기록 API
web/app/db/schema.ts  — DB 스키마 (localGovSettlements, operatorSettlements, rwaDividends)
```
