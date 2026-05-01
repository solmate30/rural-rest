# 15. 단계별 구현 로드맵

생성: 2026-03-28 18:00
업데이트: 2026-03-28 18:00

---

## Stage 1 — 해커톤 데모 (현재)

**목표:** devnet에서 E2E 배당 흐름이 실제 Solana 트랜잭션으로 동작하는 것을 심사위원 앞에서 증명.

### Anchor 프로그램 (`anchor/`)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| `listing_id` max 32바이트 제한 | `lib.rs` | P0 |
| `PropertyToken`에 `usdc_mint: Pubkey` 저장 + constraint 검증 | `lib.rs` | P0 |
| `non_transferable` extension 적용 (`initialize_property`) | `lib.rs` | P0 |
| `init_if_needed` 제거 → `open_position` instruction 분리 | `lib.rs` | P0 |
| `PropertyToken`에 `funds_released: bool` 추가 | `lib.rs` | P0 |
| `PRECISION` 모듈 레벨 상수 통합 | `lib.rs` | P0 |
| 에러 추가: `ZeroAmount`, `ZeroRevenue`, `FundsAlreadyReleased`, `InvalidFundingBps`, `InvalidPrice`, `DeadlineTooFar` | `lib.rs` | P0 |
| 파라미터 범위 검증 (`min_funding_bps`, `price`, `deadline`) | `lib.rs` | P0 |
| `claim_dividend` 명시적 `status == Active` 체크 | `lib.rs` | P1 |
| `investor_position.token_mint` constraint 추가 | `lib.rs` | P1 |
| `valudation_krw` → `valuation_krw` 오타 수정 + IDL 재생성 | `lib.rs` + IDL | P1 |

### 프론트엔드 (`web/`)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| `DistributeDividendButton` 온체인 연동 (`distribute_monthly_revenue` CPI) | `components/rwa/DistributeDividendButton.tsx` | P0 |
| `open_position` instruction 클라이언트 연동 (첫 구매 시 선행 호출) | `components/rwa/PurchaseCard.tsx` | P0 |
| 클라이언트 CU 한도 명시 (`ComputeBudgetProgram`) | RWA 컴포넌트 전체 | P1 |
| 펀딩 진행률 온체인 직접 조회 (PDA → DB 아님) | `routes/invest.detail.tsx` | P1 |

### 검증

```bash
# devnet E2E 흐름 확인
1. initialize_property → devnet 배포
2. purchase_tokens (투자자 지갑)
3. activate_property
4. distribute_monthly_revenue → Solana Explorer에서 트랜잭션 확인
5. claim_dividend → 투자자 USDC 수령 확인
node web/scripts/check-onchain.mjs  # acc_dividend_per_share > 0 확인
```

---

## Stage 2 — Devnet 안정화

**목표:** 실제 운영 가능한 수준의 보안과 운영 편의성 확보.

### Anchor 프로그램

| 작업 | 설명 |
|------|------|
| `emit!` 이벤트 추가 | `PurchaseEvent`, `DividendDistributedEvent`, `DividendClaimedEvent`, `RefundEvent` |
| `investor_position` close instruction | 환불 후 rent 회수 |
| `refund` 시 RWA 토큰 burn | 쓸모없는 토큰 지갑 잔류 방지 |
| Emergency pause (`paused: bool`) | 버그 발견 시 즉시 자금 보호 |
| `extend_deadline` instruction | 펀딩 기간 연장 필요 시 |

### 인프라

| 작업 | 설명 |
|------|------|
| Squads multisig → `authority` 이전 | single key 위험 제거 |
| upgrade authority → Squads multisig | 프로그램 임의 수정 방지 |

### 프론트엔드

| 작업 | 설명 |
|------|------|
| 이벤트 기반 UI 업데이트 | `emit!` 이벤트 구독으로 실시간 반영 |
| Pyth Oracle KRW/USDC 연동 | 하드코딩 환율 제거 |
| 투자자 포지션 온체인 직접 읽기 | PDA에서 실시간 보유량 조회 |

---

## Stage 3 — Mainnet 배포

**목표:** 실제 투자자 자금이 들어와도 안전한 수준.

### 필수 조건 (모두 충족해야 배포 가능)

| 조건 | 담당 | 비고 |
|------|------|------|
| Sec3 Soteria 자동 감사 | 개발팀 | 빠르고 저렴, 먼저 실행 |
| OtterSec 또는 Neodyme 수동 감사 | 외부 | 실제 투자금 보호 필수 |
| 감사 결과 전량 반영 | 개발팀 | |
| Squads multisig authority 확인 | 개발팀 | Stage 2 완료 전제 |
| upgrade authority 처리 결정 | 팀 결정 | freeze vs multisig |
| 법률 검토 (증권성, KYC/AML) | 법무 | |
| SPV 또는 법인 구조 확정 | 경영 | |

### 운영 가이드라인

- `net_revenue_usdc` 수동 입력은 운영자-투자자 간 계약으로 보완 (온체인 oracle 미도입)
- 초기 mainnet은 투자 cap 설정 (예: 프로퍼티당 $10,000 상한) 후 점진적 확대
- 월별 배당 분배 내역 오프체인 공시 (투명성 보완)

---

## 참고 문서

| 문서 | 내용 |
|------|------|
| `anchor/CLAUDE.md` | Critical Rules, 수정 대기 목록 |
| `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` | PDA seeds, 수학 명세, 에러코드 |
| `docs/03_Technical_Specs/10_ANCHOR_PROGRAM_AUDIT.md` | CU 가이드, 보안 이슈 목록 |
| `docs/01_Concept_Design/14_COLOSSEUM_HACKATHON_GAP_ANALYSIS.md` | 경쟁 환경, 심사위원 분석 |
