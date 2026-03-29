# 11. RWA Known Issues

> Created: 2026-03-23
> Updated: 2026-03-28

---

## 1. 배당 낚아채기 (Dividend Snatching)

**현상:**
배당 분배(`distribute_monthly_revenue`) 직전에 토큰을 대량 구매하고,
배당 수령 후 즉시 매도하는 행위.

**현재 상태: MVP에서 발생 불가.**
Token-2022 `non_transferable` extension을 적용할 예정이며, 2차 시장(DEX 연동) 미지원.
구매 후 즉시 매도할 수단이 없으므로 실질적 위험 없음.

**검토 시점:**
`non_transferable` 제거 또는 2차 시장 지원을 고려하는 시점에 재검토.

---

## 2. Anchor 프로그램 잔여 구현 항목 (Stage 2)

> Stage 1 구현 완료(2026-03-28) 후 남은 항목. devnet 안정화 단계에서 처리.

| 항목 | 설명 |
|------|------|
| `non_transferable` extension | `initialize_property` 시 Token-2022 NonTransferable extension 적용. 현재 미적용 — 토큰 전송이 기술적으로 가능하나 `investor_position` PDA 불일치로 배당 수령 불가. 실질적 위험 낮음. |
| `emit!` 이벤트 | `PurchaseEvent`, `DividendDistributedEvent`, `DividendClaimedEvent`, `RefundEvent`. 이벤트 기반 UI 업데이트 및 인덱서 연동용. |
| 클라이언트 CU 한도 | `ComputeBudgetProgram.setComputeUnitLimit` 명시적 설정. `purchase_tokens` 70,000 CU, `claim_dividend` 35,000 CU 권장. 현재 기본값(200,000) 사용 중. |
| `investor_position` close | 환불 후 rent 회수 instruction. |
| 투자 취소 쿨링오프 | `cancel_position`은 현재 Funding 중 언제든 취소 가능. 운영 시 구매 후 N일 이내만 허용하는 쿨링오프 기간 도입 검토 필요. |

---

## 4. 운영(Production) 전 해결 필요 사항

> Updated: 2026-03-28

| 항목 | 현재 (MVP) | 운영 요구사항 |
|------|-----------|--------------|
| **SPV 지갑 보안** | 서버 환경변수 keypair (단일 실패점) | Squads multisig (Rural Rest + 정부기관, 2-of-3) |
| **수익 보고 신뢰성** | SPV admin이 금액 수동 입력, 온체인 검증 없음 | 예약 데이터 자동 연동 or 외부 회계감사 메커니즘 |
| **DB-온체인 동기화** | 스크립트 중간 실패 시 불일치 가능 | 이벤트 기반 동기화 or idempotent DB 업데이트 |
| **release_funds 자동화** | SPV가 수동으로 스크립트 호출 | 조건 충족 감지 keeper bot (permissionless 변경 필요) |
| **투자자 유동성** | non-transferable, 2차 시장 없음 | 투자자에게 명시적 고지 필요 (by design) |
| **3자 정산 온체인화** | 지자체/운영자 분배가 오프체인 USDC 이체로만 처리 | 정산 내역을 온체인 이벤트로 기록하거나 별도 PDA로 관리 |

### release_funds 자동화 방법 (참고)

현재 `release_funds`는 `authority` 서명 필요. 자동화를 위한 두 가지 방법:

1. **keeper bot (현재 구조 유지)**: SPV 개인키를 보유한 서버가 조건 충족 감지 → 자동 서명 전송
2. **permissionless 변경 (Anchor 프로그램 수정)**: authority 체크 제거 → 조건 충족 시 누구나 호출 가능 → keeper에 SPV 키 불필요, 보안 향상

---

## 5. 2차 시장 (Secondary Market) 계획

> Updated: 2026-03-29

### 현재 상태: 2차 시장 없음 (MVP)

- `activate_property` 시 mint authority 소각 → 추가 토큰 발행 불가
- `non_transferable` extension 예정 → 토큰 전송 자체가 차단됨
- 투자자는 1차 시장(펀딩 기간)에서만 구매 가능, 이후 매도 수단 없음
- 투자자에게 유동성 제한 사전 고지 필수

### 참고 사례: 카사(KASA)

- 1차 시장: 공모 기간에 DABS(부동산 수익증권) 발행 판매
- 2차 시장: 공모 종료 후 카사 앱 내 자체 마켓플레이스에서 투자자 간 거래
- 한계: 유동성 부족으로 원하는 가격에 즉시 매도 어려움

### 향후 구현 방향 (Phase 2+)

| 방식 | 설명 | 장단점 |
|------|------|--------|
| **자체 P2P 마켓** | Rural Rest 앱 내 투자자 간 직접 거래 (매도 호가 → 매수 체결) | 카사 방식. 유동성 낮을 수 있음 |
| **Solana DEX 연동** | Raydium/Jupiter 등에 유동성 풀 생성 → 자동 거래 | 높은 유동성, 외부 의존성 |
| **하이브리드** | 앱 내 P2P + DEX 풀 동시 운영 | 최적이나 구현 복잡도 높음 |

### 전제 조건 (2차 시장 도입 전 필요)

1. `non_transferable` extension 제거 또는 transfer hook으로 교체
2. 배당 낚아채기(Dividend Snatching) 방지 메커니즘 (스냅샷 기반 배당 등)
3. `investor_position` PDA 업데이트 로직 (소유자 변경 시)
4. 규제 검토 (증권성 토큰 2차 거래 관련 법적 요건)

---

## 3. 관련 문서

- `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` — instruction 명세 전체
- `docs/04_Logic_Progress/10_RWA_DIVIDEND_LOGIC.md` — 배당 알고리즘
- `docs/04_Logic_Progress/12_RWA_FUNDING_ESCROW_LOGIC.md` — 펀딩 에스크로 및 환불 로직
- `anchor/programs/rural-rest-rwa/src/lib.rs` — 실제 구현
