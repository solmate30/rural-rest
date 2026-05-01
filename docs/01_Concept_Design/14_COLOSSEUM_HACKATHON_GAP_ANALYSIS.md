# 14. Colosseum 해커톤 갭 분석 및 전략

생성: 2026-03-28 15:00
업데이트: 2026-03-30 15:00

---

## 1. 개요

Colosseum Copilot API를 활용해 5,400+개 Solana 해커톤 프로젝트 데이터베이스에서 RWA/부동산 토큰화 유사 프로젝트를 검색하고, Rural Rest의 경쟁 환경과 차별화 포인트를 분석했다.

---

## 2. 경쟁 환경 분석

### 2.1 클러스터 위치

Rural Rest는 **"Solana Real Estate Tokenization"** 클러스터 (`v1-c1`)에 속함.

- **crowdedness: 204** — 매우 포화된 공간
- Blockride, ORO 등도 동일 클러스터에 위치

### 2.2 Generic 부동산 토큰화 = 수상 불가

Copilot `winnersOnly: false` 검색에서 확인된 유사 프로젝트들:

| 프로젝트 | 해커톤 | prize |
|---------|--------|-------|
| Zamindar | Radar | null |
| TokenEstate | Cypherpunk | null |
| Vezora.io | Cypherpunk | null |
| Estato | Radar | null |

공통 problemTags: `illiquid real estate`, `high barriers to investment`, `lack of transparency`
공통 solutionTags: `fractional ownership`, `on-chain property registry`, `cross-border investment`

→ 이 포지셔닝으로는 수상 불가. 심사위원에게 차별화로 인식되지 않음.

---

## 3. 우승 프로젝트 패턴 분석

Copilot `winnersOnly: true` 검색 결과 (RWA 관련 수상작):

### CREAM — Honorable Mention RWAs (Cypherpunk 2025)
- **슬러그:** `cream`
- **한 줄:** "Decentralized energy grid on Solana tokenizing rooftop solar assets for stable income."
- **차별점:** 태양광 패널 물리적 에너지 출력 → 온체인 수익 분배. **DePIN + RWA 결합**
- **핵심:** yield source가 kWh 단위로 측정 가능하고 물리적으로 검증 가능

### ORO — Honorable Mention DeFi (Radar 2024)
- **슬러그:** `oro`
- **한 줄:** "Yield-generating tokenized gold protocol on Solana providing liquidity and returns."
- **차별점:** 금 토큰화 + DeFi yield 생성. **보유가 아닌 수익**
- **핵심:** appreciation 아닌 operations에서 나오는 실제 yield

### Genesis — 3rd Place Consumer $15,000 (Radar 2024)
- **슬러그:** `genesis`
- **한 줄:** "Fractionalized and tokenized intellectual property investment and royalty sharing."
- **차별점:** IP 로열티 토큰화. **실제 캐시플로우** (d-reader 플랫폼과 연계)
- **핵심:** 기존 플랫폼의 실제 수익을 온체인으로 분배

### Blockride — Honorable Mention DePin (Renaissance 2024)
- **슬러그:** `blockride`
- **한 줄:** "Mobility marketplace providing vehicle financing in Africa through tokenized hire purchase."
- **차별점:** 아프리카 + 차량 금융 + tokenized 할부 계약. **구체적 지역 + 구체적 문제**
- **핵심:** "어디서나 통하는" 플랫폼이 아닌 특정 지역의 특정 문제 해결

---

## 4. 우승 핵심 요소 정리

1. **측정 가능한 실제 yield source** — 에너지 kWh, 로열티 금액, 임대 수익. Appreciation 아님.
2. **두 가지 primitive 결합** — DePIN+RWA, IP+DeFi, DePin+Consumer
3. **구체적 지역 또는 자산 유형** — 아프리카, 태양광, 금, 만화 IP
4. **실제 동작하는 온체인 yield 분배** — 데모에서 실제 트랜잭션이 보여야 함

---

## 5. Rural Rest 차별화 포인트

우리는 이미 우승 패턴을 갖추고 있다:

| 요소 | Rural Rest | 비교 |
|------|-----------|------|
| 구체적 자산 | 한국 농촌 폐가 (abandoned rural houses) | Blockride의 아프리카 차량과 동급 희소성 |
| yield source | Airbnb 임대 수익 (야간 숙박료) | CREAM의 에너지처럼 operations에서 나오는 실제 수익 |
| 측정 가능성 | pricePerNight × occupancyRate × 365 | kWh와 동급으로 구체적 |
| 투명성 | 3자 정산 (투자자30% + 운영자30% + 지자체40%) | on-chain으로 검증 가능한 분배 |
| 임팩트 스토리 | 농촌 소멸 방지 + 문화유산 보존 + 지역 경제 활성화 | ESG/DePin 각도에서 설득력 높음 |

### 추천 포지셔닝

> "Korean Rural Heritage RWA — Airbnb-style rental yield, distributed on-chain to global investors."

Generic "부동산 토큰화"가 아닌:
- **"Hospitality yield + Rural revival + Solana"**
- CREAM처럼 DePIN-adjacent 포지션 (실물 자산이 수익을 생성)
- 제출 트랙: **RWAs** (Cypherpunk 기준)

---

## 6. 온체인 완성도 (Updated 2026-04-04)

코드 직접 확인 기준 (docs 아님):

| 기능 | Anchor 프로그램 | 프론트엔드 | 통합 상태 |
|------|----------------|-----------|----------|
| initialize_config | 완성 | 관리자 초기 설정 | 정상 |
| set_crank_authority | 완성 | 관리자 설정 | 정상 |
| set_treasury | 완성 | 관리자 설정 | 정상 |
| initialize_property | 완성 | InitializePropertyButton (온체인 호출) | 정상 |
| open_position | 완성 | PurchaseCard 내 호출 (온체인) | 정상 |
| purchase_tokens | 완성 | PurchaseCard 내 호출 (온체인) | 정상 |
| release_funds | 완성 | ReleaseFundsButton (온체인 호출) | 정상 |
| cancel_position | 완성 | CancelPositionButton (온체인 호출) | 정상 |
| refund | 완성 | RefundButton (온체인 호출) | 정상 |
| activate_property | 완성 | ActivateButton (온체인 호출) | 정상 |
| distribute_monthly_revenue | 완성 | MonthlySettlementButton (온체인 호출) | 정상 |
| claim_dividend | 완성 | ClaimButton (온체인 호출) | 정상 |
| create_booking_escrow | 완성 | 예약 결제 흐름 | 정상 |
| release_booking_escrow | 완성 | 예약 완료 정산 | 정상 |
| cancel_booking_escrow | 완성 | 예약 취소 환불 | 정상 |

- Anchor 프로그램: **14개 instruction 구현, 41개 테스트 케이스 통과**
- E2E 스크립트: `web/scripts/` 10개 (데모 녹화 시 추가 예정)
- **Devnet 배포 완료** (`setup-devnet.ts`, `register-helius-webhook.ts` 실행됨)
- **Pyth Oracle 연동 완료** — `create_booking_escrow`에서 KRW/USDC 실시간 환율 변환
  - Devnet feed: `Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD`
  - Staleness check: 60초, confidence interval: 2% 이내
  - `skip-oracle` feature flag로 테스트 우회 가능 (`anchor test -- --features skip-oracle`)
  - 프론트엔드: `web/app/lib/pyth.ts`, `usePythRate.ts` hook, 6개 라우트 적용

### 이전 핵심 버그 — 해결됨

이전 분석에서 `DistributeDividendButton.tsx`가 온체인 미호출이라 BROKEN으로 판정했으나, 현재 admin 정산 플로우는 `MonthlySettlementButton.tsx`로 교체됨. 이 컴포넌트가 `distributeMonthlyRevenue` instruction을 직접 호출하고 (line 189-200), 운영자/지자체 USDC 전송도 같은 플로우에서 처리.

- `acc_dividend_per_share` 온체인에서 정상 증가
- `claimDividend` 호출 시 실제 pending 배당 수령 가능
- Explorer에서 트랜잭션 확인 가능

### 잔여 이슈 (비치명적)

1. **Dead code**: `DistributeSettlementButton.tsx` (operator용)는 HTTP-only이며 어디에서도 import되지 않음. 정리 필요.
2. **emit! 이벤트 없음**: Anchor 프로그램에 이벤트 emit이 없음. 단, Helius webhook이 program ID 기준으로 트랜잭션을 추적하므로 **데모에 영향 없음**. 향후 indexer 연동 시 편의성 개선 항목.

---

## 7. 추가 리서치: Proof-of-Yield 수상 패턴

**"물리적 데이터가 온체인에 기록되는" 프로젝트들의 수상 여부:**

| 프로젝트 | 데이터 소스 | 수상 | 이유 |
|---------|-----------|------|------|
| Green Energy Network (Breakout) | IoT 기기 → 에너지 데이터 온체인 | Honorable Mention DePIN $5K | 실제 technical demo 존재 (Loom) |
| SoulBoard (Breakout) | 광고판 뷰 → 온체인 검증 | 4th Place DePIN $10K | 실제 물리 공간 + 온체인 증명 |
| Kiko Network (Radar) | 사용자 소유 기상 관측소 데이터 | 5th Place DePIN $5K | 하드웨어 + 온체인 데이터 흐름 |
| TryKey (Renaissance) | IoT 센서 (차량/장비 사용량) | null | 개념만, 실제 데이터 없음 |
| TryKeyProtocol (Radar) | 하드웨어 Proof of Yield | null | 개념만, 실제 데이터 없음 |

**패턴**: 데이터가 실제로 흐르는 technical demo가 있는 프로젝트만 수상. "나중에 IoT 붙일 것"은 통하지 않음.

**Rural Rest에 주는 교훈**: 온체인 배당 분배가 실제 devnet 트랜잭션으로 보여야 한다. demo = 실제 Solana Explorer 링크.

---

## 8. 아카이브 인사이트

Colosseum Copilot archive corpus (Superteam Blog, a16z Crypto, Pantera Capital 등) 기반:

- **Superteam RWA Deep Dive (2025-08)**: "RWA tokenization surged from $5B to $24B (2022–2025), 380% growth. Solana is uniquely positioned due to high throughput, low fees." → RWA는 성장하는 카테고리지만 **진입장벽이 낮아 포화 위험**.
- **a16z Crypto (2025-08)**: "Asset managers deliver flexibility through fractionalization and programmability — auto-rebalancing baskets or yield-based instruments." → **프로그래머블 yield**가 핵심 차별화.
- **Pantera Capital (2025-07)**: "Mounting pressure on issuers to extend full shareholder rights to tokenholders." → 투자자 권리 (배당+거버넌스) 온체인 보장이 기대값이 됨.
- **"Real yield to DeFi users"** — 2025년 RWA 성공 키워드. appreciation 아닌 operations 수익.

---

## 9. 심사위원 시각 냉정 분석

> 심사위원이라면 어떻게 볼 것인가.

### 강점 (실제로 인정받을 부분)

1. **Anchor 프로그램 완성도 높음** — 14개 instruction 구현 (RWA 핵심 9개 + booking escrow 3개 + config 2개). 41개 테스트 케이스 통과. PDA 구조 정확, 고정소수점 배당 수학 (1e12 precision) 올바름. 단순 데모용이 아닌 실사용 가능한 수준.
2. **투자 → 정산 → 수령 E2E 온체인 동작** — MonthlySettlementButton이 distributeMonthlyRevenue를 온체인 호출하고, ClaimButton이 claimDividend를 호출. Explorer에서 실제 트랜잭션 확인 가능. 3자 정산 (투자자 배당 + 운영자 USDC 전송 + 지자체 USDC 전송)이 하나의 플로우에서 실행됨.
3. **유즈케이스 희소성** — 한국 농촌 폐가 RWA를 다루는 프로젝트는 5,400개 데이터베이스에 없음. 심사위원이 기억함.
4. **3자 정산 구조** — 투자자:운영자:지자체 = 30:30:40. 단순 투자자 배당이 아닌 지역사회 연계. 이건 진짜 새롭다.
5. **풀스택 완성도** — Anchor + React Router 7 + Turso + 지갑 연결 + KYC + E2E 스크립트 10개 (추가 예정). 개념 증명 수준을 넘음.
6. **Pyth Oracle 실시간 연동** — create_booking_escrow에서 KRW/USDC 실시간 환율 변환. staleness check + confidence interval 검증 포함. "프로그래머블 yield" 주장에 완전한 기술적 근거.
7. **Devnet 배포 완료** — setup-devnet.ts 실행, Helius webhook 등록. Explorer에서 실제 트랜잭션 확인 가능.

### 약점 (탈락 요인이 될 부분)

1. **"실제 수익이 어디서 나오는가"가 불분명** — 현재는 admin이 수동으로 운영비를 입력해서 정산. 실제 예약 데이터가 자동으로 배당을 트리거하는 구조가 없음. "그냥 admin이 숫자 입력하면 되는 거잖아요?"라는 질문에 답하기 어려움.
2. **실제 사용자/부동산 없음** — 개념 증명. 경쟁 프로젝트 (Genesis)는 d-reader라는 실제 플랫폼과 연계. 우리는 경주 데이터 리서치 문서는 있지만 실제 부동산이 없음.
3. **Generic 포지셔닝 위험** — 제출 시 "한국 농촌 폐가"를 충분히 강조하지 않으면 crowdedness 204인 일반 부동산 토큰화로 분류됨.
4. **Anchor 이벤트 미구현** — emit! 없음. 단, 데모 자체에는 영향 없음 (Helius webhook이 대체). 향후 개선 항목.

### 심사위원이 할 질문 (예상)

- "devnet에서 실제로 배당이 분배되는 거 보여주실 수 있나요?" → **대응 가능**. MonthlySettlementButton으로 distribute → ClaimButton으로 claim. Explorer 링크 제공.
- "admin이 수익을 수동 입력하면 임의로 조작 가능하지 않나요? 어떻게 수익을 검증하나요?" → 아직 약점. 예약 데이터 기반 자동 계산은 구현했으나 (grossRevenue를 bookings에서 산출), 운영비는 admin 수동 입력.
- "한국 농촌 시장이 얼마나 큰가요? 규제 이슈는?"
- "Chaincrib, Vezora와 뭐가 다른가요?"
- "왜 토큰이 non_transferable인가요? 2차 시장은?" → Token-2022 non_transferable extension 적용. 규제 준수를 위한 의도적 설계.

### 냉정한 현재 점수 (10점 만점, Updated 2026-04-04)

| 항목 | 2026-03-30 | 현재 | 이유 |
|------|-----------|------|------|
| 기술 완성도 | 8/10 | **9/10** | 14개 instruction, 41개 테스트, Pyth Oracle 실시간 연동, devnet 배포 완료 |
| 혁신성 | 8/10 | 8/10 | 3자 정산, 한국 농촌 폐가, booking escrow = 독특 (변동 없음) |
| 데모 가능성 | 7/10 | **9/10** | devnet 배포 완료. Explorer 링크 즉시 제공 가능. Pyth 실시간 환율로 "프로그래머블 yield" 완성 |
| 시장 규모/타당성 | 7/10 | 7/10 | 폐가 시장 실재, 글로벌 관광객 수요 증명 가능 (변동 없음) |
| 팀/실행력 | 미정 | 미정 | 문서화 수준 높음, E2E 스크립트 체계적 |

**현재 상태: RWAs 트랙 Prize 수상 경쟁권.** devnet에서 14 instruction + Pyth Oracle + booking escrow 전체 플로우 동작. 기술 완성도는 수상 요건 충족.
**남은 조건**: 데모 영상 녹화 + Explorer 링크 수집 + 피치덱 v3 제출.

---

## 10. 우선순위 로드맵 (Updated 2026-03-30)

### ~~Priority 1 — 배당 분배 온체인 연동~~ DONE
- ~~`DistributeDividendButton` 온체인 연동~~ → `MonthlySettlementButton`으로 교체 완료
- ~~devnet에서 `distributeMonthlyRevenue` → `claimDividend` E2E 동작~~ → localnet 검증 완료
- ~~Solana Explorer에서 실제 트랜잭션 확인 가능해야 함~~ → 확인 가능

### Priority 1 (신규) — devnet 데모 준비
- devnet 배포 (프로그램 deploy + USDC mint 설정)
- 데모 시나리오 스크립트: 투자 → 정산 → 수령 실제 화면 녹화
- `DistributeSettlementButton.tsx` dead code 정리 또는 삭제
- 데모용 Explorer 링크 수집

### Priority 2 — 차별화 강화
- Anchor emit! 이벤트 추가 (Explorer/indexer 가독성 향상)
- Pyth Oracle KRW/USDC 실시간 환율 (하드코딩 1350 제거)
- 펀딩 진행률 온체인 직접 조회 강화 (`fetchPropertyOnchain` 이미 구현, UI 일부 미적용)

### Priority 3 — 혁신성 강조 (시간 허용 시)
- 예약 완료 이벤트 → 자동 배당 분배 트리거 설계 (Proof-of-Rental 개념)
- 투자자 포지션 PDA 직접 읽기 (내 보유량 = 온체인 데이터)

---

## 관련 프로젝트 문서

- `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` — Anchor 프로그램 명세 (instruction, 수학, 에러코드)
- `docs/04_Logic_Progress/13_SETTLEMENT_ARCHITECTURE.md` — 3자 정산 아키텍처 (투자자 30%, 운영자 30%, 지자체 40%)
- `docs/04_Logic_Progress/10_RWA_DIVIDEND_LOGIC.md` — 배당 분배 알고리즘
- `docs/01_Concept_Design/15_IMPLEMENTATION_STAGES.md` — 구현 단계 로드맵 (Stage 1 완료 현황)

## 참고 링크

- Colosseum Copilot API: `https://copilot.colosseum.com/api/v1`
- Superteam RWA Deep Dive: `https://blog.superteam.fun/p/deep-dive-of-the-state-of-rwas-on`
- CREAM: `https://arena.colosseum.org/projects/explore/cream`
- ORO: `https://arena.colosseum.org/projects/explore/oro`
- Genesis: `https://arena.colosseum.org/projects/explore/genesis`
- Green Energy Network: `https://arena.colosseum.org/projects/explore/green-energy-network-(gen)`
- SoulBoard: `https://arena.colosseum.org/projects/explore/soulboard`
