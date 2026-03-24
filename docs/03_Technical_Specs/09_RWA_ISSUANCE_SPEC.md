# 14. RWA 발행 구현 명세서 (Technical Specification)

> Created: 2026-03-10 12:00
> Last Updated: 2026-03-18 13:00

본 문서는 [15_RWA_ISSUANCE_PLAN.md](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md) 기획서를 바탕으로 Rural Rest RWA(빈집 자산)의 Solana 발행·매수·배당 연동을 정의한다. 착수 전 체크리스트, 기술 스택, 토큰·프로그램 설계, 발행 흐름, 클라이언트 연동, 마일스톤을 기술한다.

---

## 1. 개요 및 구현 범위

### 1.1. 기반 문서

*   **기획서**: [15_RWA_ISSUANCE_PLAN.md](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md)
*   **핵심 가정**: 1 빈집 = 1 SPL Token Mint. Solana(Devnet → Mainnet), Anchor Program, USDC 결제.

### 1.2. 착수 전 준비 체크리스트 (Pre-Implementation Checklist)

> 아래 항목이 완료되어야 온체인 발행·매수 구현을 시작할 수 있다.

#### A. 법률·규제 (첫 번째 블로커)

- [ ] **증권 해당성·STO 요건 법률 자문** 완료 또는 시범 범위 확정
- [ ] **SPV 설립** 계획 또는 시범 시 SPV 없이 테스트 발행 범위 문서화
- [ ] **KYC/AML** 연동 방안 확정 (투자 전 KYC 필수 여부, 파트너 후보)

#### B. 감정·자산 데이터

- [ ] **파일럿 빈집 1채 이상** 선정 및 **감정평가** 완료 (감정가 등 투자 기준 금액 확정)
- [ ] **총 발행량**은 빈집당 **100,000,000(1억) 고정** (기획서 19 참조). 토큰당 매수가격 = (해당 빈집 투자 기준 금액) ÷ 100,000,000
- [ ] **listing_id**와 온체인 Property Token 매핑 정책 확정

#### C. Solana·Anchor 환경

- [ ] **Solana Devnet** RPC 및 지갑(페이어) 준비
- [ ] **Anchor** 설치 및 RWA용 프로그램 워크스페이스 구성
- [ ] **USDC Devnet** Mint 확보 (또는 테스트용 USDC 파우셋)

#### D. 웹앱 연동 상태

- [ ] **Solana Wallet Adapter** 기존 투자 플로우(`/invest`)와 동일 스택 재사용 가능 여부 확인
- [ ] **`@solana/web3.js`**, **`@solana/spl-token`** 버전 호환 확인

#### E. 환경 변수

- [ ] 아래 변수 정의 및 (Devnet) 값 기입

| 변수 | 용도 |
| :--- | :--- |
| `SOLANA_NETWORK` | `devnet` / `mainnet-beta` |
| `RWA_PROGRAM_ID` | Anchor RWA 프로그램 공개키 (배포 후) |
| `USDC_MINT` | USDC SPL Token Mint (Devnet/Mainnet) |

#### F. 구현 순서

```
1. 법률·규제 범위 확정 (A)
2. 파일럿 빈집 감정 및 데이터 확정 (B)
3. Anchor Program 개발·배포 (C)
4. 웹 연동 (D) 및 환경 변수 (E) 반영
5. Devnet 발행·매수 E2E 검증
6. QA 시나리오 통과 후 Mainnet 전환 검토
```

---

### 1.3. 구현 상태 (Implementation Status)

| 구성 요소 | 상태 | 비고 |
| :--- | :--- | :--- |
| Anchor RWA Program (initialize_property, purchase_tokens 등) | 미구현 | 10_RWA_TOKEN_SPEC 아카이브 참조 |
| SPL Token Mint (빈집별) 생성 | 미구현 | Authority 호출로 생성 |
| 토큰화 신청 UI (`/admin/tokenize`) | 미구현 | 신청·서류 업로드 |
| 투자 매수 플로우 (USDC → 토큰) | 미구현 | `/invest/:id` Purchase 트랜잭션 |
| 배당 분배·Claim | 미구현 | 별도 문서 11_RWA_DIVIDEND_LOGIC 연동 |

---

## 2. 기술 스택

### 2.1. 체인 및 도구

| 항목 | 선택 | 비고 |
| :--- | :--- | :--- |
| **체인** | Solana | Devnet → Mainnet |
| **토큰** | SPL Token | 빈집별 Mint, decimals 0 |
| **결제** | USDC (SPL) | 6 decimals |
| **프로그램** | Anchor | RWA 전용 Program (Property, InvestorPosition, DividendPool 등) |

### 2.2. 환경 변수 (요약)

| 변수 | 용도 |
| :--- | :--- |
| `SOLANA_NETWORK` | devnet / mainnet-beta |
| `RWA_PROGRAM_ID` | RWA Anchor Program 공개키 |
| `USDC_MINT` | USDC Mint 공개키 |

---

## 3. 토큰 설계 (발행 관점)

### 3.1. 빈집별 Mint

*   **1 listing = 1 Token Mint**. 여러 빈집이 있으면 Mint가 여러 개.
*   **Decimals**: 0 (정수 단위).
*   **총 발행량**: **집 1채당 100,000,000(1억) 토큰 고정**. 빈집마다 동일. Anchor `initialize_property` 시 `total_supply = 100_000_000`으로 설정.
*   **비율 계산**: 수익 지분·배당·DAO 투표권 등은 모두 **보유 토큰 수 ÷ 100,000,000**으로 산출. 토큰당 매수가격은 (해당 빈집 투자·감정 기준 금액) ÷ 100,000,000으로 별도 산정.

### 3.2. Anchor Program 요약

*   **State**: PropertyToken(Authority, listing_id, token_mint, total_supply, tokens_sold, valuation_krw, price_per_token_usdc, status), InvestorPosition, DividendPool 등. 상세 구조·PDA는 [00_ARCHIVE/future_blockchain/10_RWA_TOKEN_SPEC.md](../00_ARCHIVE/future_blockchain/10_RWA_TOKEN_SPEC.md) 참조.
*   **Instructions**: `initialize_property`(Authority), `purchase_tokens`(투자자, USDC → 토큰), `distribute_dividends`, `claim_dividend` 등. 배당 관련은 수익 배분 문서와 분리 유지.

### 3.3. 발행 흐름 (기술)

1. 호스트 토큰화 신청(오프체인) → 플랫폼 심사·감정·승인
2. Authority가 Anchor `initialize_property` 호출 → SPL Token Mint 생성, PropertyToken PDA 생성
3. 투자자가 `purchase_tokens` 호출(USDC 전송) → 토큰 수령, InvestorPosition 갱신
4. 세일 기간 종료 또는 목표 판매율 달성 후 `active` 등 상태 전이. 배당은 별도 로직 문서 참조.

---

## 4. DB·오프체인 연동

*   **rwa_tokens**: listing_id, token_mint, symbol, total_supply, tokens_sold, price_per_token_usdc, valuation_krw, status 등. 구현 명세는 아카이브 10_RWA_TOKEN_SPEC Section 6 참조.
*   **rwa_investments**: user_id, token_mint_address, amount, total_invested_usdc, purchase_tx_signature 등.
*   **배당**: 이력은 **rwa_dividends** 및 Anchor DividendPool과 연동. **배당 주기 = 1달(월 단위)**. 배당 기준 = **순이익**(총 매출 − 모든 운영 비용). **적자 시** 해당 월 배당 = 0(음수 배당 없음). 손실 이월 정책은 별도 검토. **운영 준비금**: 적자 월 급여·필수 비용 지급을 위해 **회사 보유 RWA의 일부를 매각한 대금**을 운영준비금으로 적립·보유(B안). 부족 시 준비금에서 충당. 보유 비율·매각 시점·목표 규모는 기획서 19 §2.5 및 별도 정책 참조. 상세는 11_RWA_DIVIDEND_LOGIC 참조.

---

## 5. 클라이언트 연동

### 5.1. 라우트·기능

| 경로 | 기능 | 비고 |
| :--- | :--- | :--- |
| `/invest` | RWA 토큰 목록(빈집 카드), 필터, CTA | 기존 구현 로그 기준 |
| `/invest/:id` | 토큰 상세, Purchase (Amount, USDC 결제), 지갑 서명 | RWA 발행 명세 적용 |
| `/admin/tokenize` | 토큰화 신청 폼, 서류 업로드, 심사 상태 | 호스트 전용 |

### 5.2. 의존성

| 패키지 | 용도 |
| :--- | :--- |
| `@solana/web3.js` | RPC, 트랜잭션 |
| `@solana/spl-token` | USDC·RWA 토큰 전송, 잔액 조회 |
| `@solana/wallet-adapter-react` | 지갑 연결 (기존) |
| Anchor 클라이언트 (IDL) | initialize_property, purchase_tokens 호출 |

---

## 6. 마일스톤

| 단계 | 내용 | 완료 조건 |
| :--- | :--- | :--- |
| 1 | 법률·규제 범위 및 파일럿 자산 확정 | 자문 요약·감정가 확정 문서 |
| 2 | Anchor RWA Program Devnet 배포 | initialize_property로 Mint 1개 생성 성공 |
| 3 | purchase_tokens Devnet 연동 | USDC → RWA 토큰 매수 E2E 성공 |
| 4 | `/invest/:id` Purchase UI 연동 | 지갑 서명 후 온체인 반영 확인 |
| 5 | QA 시나리오 통과 | RWA_ISSUANCE_TEST_SCENARIOS 기준 검증 |
| 6 | Mainnet 전환 검토 | 규제·운영 정책 확정 후 |

---

## 7. Related Documents

- **Concept_Design**: [15_RWA_ISSUANCE_PLAN.md](../01_Concept_Design/15_RWA_ISSUANCE_PLAN.md) - RWA 발행 기획서
- **Concept_Design**: [14_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/14_DAO_GOVERNANCE_PLAN.md) - DAO (RWA = Community Token)
- **Technical_Specs**: [08_DAO_IMPLEMENTATION_SPEC.md](./08_DAO_IMPLEMENTATION_SPEC.md) - DAO 구현 (RWA Mint 선행 필요)
- **Logic_Progress**: [11_RWA_DIVIDEND_LOGIC.md](../04_Logic_Progress/11_RWA_DIVIDEND_LOGIC.md) - 배당 로직 (발행·매수와 분리)
- **Logic_Progress**: [10_RWA_IMPLEMENTATION_LOG.md](../04_Logic_Progress/10_RWA_IMPLEMENTATION_LOG.md) - RWA 연동 진행 로그
- **Archive**: [10_RWA_TOKEN_SPEC.md](../00_ARCHIVE/future_blockchain/10_RWA_TOKEN_SPEC.md) - RWA 토큰·Anchor 상세 명세 (참고용)
- **Archive**: [12_RWA_TOKENIZATION_LOGIC.md](../00_ARCHIVE/future_blockchain/12_RWA_TOKENIZATION_LOGIC.md) - 토큰화 파이프라인·배당 알고리즘 (참고용)
- **QA_Validation**: [RWA_ISSUANCE_TEST_SCENARIOS.md](../05_QA_Validation/RWA_ISSUANCE_TEST_SCENARIOS.md) - RWA 발행·매수 테스트 시나리오
