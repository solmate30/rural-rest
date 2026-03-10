# 13. DAO 구현 명세서 (Technical Specification)

> Created: 2026-02-18 12:00
> Last Updated: 2026-03-10 05:00

본 문서는 [18_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/18_DAO_GOVERNANCE_PLAN.md) 기획서를 바탕으로 Rural Rest DAO의 1단계 기술 구현을 정의한다. RWA 1차 발행 직후 투표 기능만을 온체인으로 구현하는 범위를 기술한다.

---

## 1. 개요 및 구현 범위

### 1.1. 기반 문서

*   **기획서**: [18_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/18_DAO_GOVERNANCE_PLAN.md)
*   **핵심 가정**: RWA 1차 발행 직후 DAO 운영 시작, 1단계는 **투표만** 구현

### 1.2. 착수 전 준비 체크리스트 (Pre-Implementation Checklist)

> 아래 항목이 모두 완료되어야 구현을 시작할 수 있다. 미완료 항목이 있으면 해당 단계에서 블로킹된다.

#### A. RWA 토큰 준비 (첫 번째 블로커)

- [ ] **RWA SPL Token Mint 생성** (Devnet 기준)
    - Devnet에서 RWA Token Mint 배포 완료
    - `RWA_TOKEN_MINT` 환경 변수에 실제 공개키 기입
- [ ] **총 발행량 확정**
    - `minCommunityTokensToCreateProposal` 파라미터를 토큰 단위로 환산하려면 총 발행량이 확정되어야 함
    - 예: 총 발행량 1,000,000 RWA → 0.5% = 5,000 토큰 단위로 설정
- [ ] **테스트용 RWA 토큰 분배**
    - 테스트 지갑(Wallet C, D 등)에 Devnet RWA 토큰 배분 완료

#### B. Council Token 준비

- [ ] **Council SPL Token Mint 생성** (Devnet 기준)
    - Non-transferable(Freeze Authority 설정) 옵션 적용
    - `COUNCIL_TOKEN_MINT` 환경 변수에 실제 공개키 기입
- [ ] **마을 대표·지방정부 지갑 목록 확보**
    - Council Token 발급 대상 지갑 주소 목록 준비

#### C. Squads Multisig 준비

- [ ] **Squads Protocol v4 Multisig 생성**
    - M-of-N 서명자 구성 확정 (예: 3-of-5)
    - 서명자 지갑 주소 목록 확정
    - `MULTISIG_PUBKEY` 환경 변수에 실제 공개키 기입
- [ ] **Council Token Mint Authority → Multisig 이전**
    - 이전 완료 후 단일 지갑 민팅 불가 확인 (QA 시나리오 2.2)

#### D. 웹앱 기존 연동 상태 확인

- [ ] **`web/` 디렉토리 내 Solana Wallet Adapter 연동 상태 점검**
    - 기존 투자 플로우에서 사용 중인 `@solana/wallet-adapter-react` 버전 확인
    - DAO 연동에 재사용 가능한지 확인
- [ ] **신규 패키지 설치 가능 여부 확인**
    - `@solana/spl-governance`, `@sqds/multisig` 의존성 충돌 없음 확인

#### E. 환경 변수 완성

- [ ] 아래 5개 환경 변수 모두 실제 값 기입 완료

| 변수 | 상태 | 값 |
| :--- | :--- | :--- |
| `SOLANA_NETWORK` | 필수 | `devnet` (초기) |
| `REALMS_REALM_ID` | Realm 생성 후 기입 | - |
| `RWA_TOKEN_MINT` | A 완료 후 기입 | - |
| `COUNCIL_TOKEN_MINT` | B 완료 후 기입 | - |
| `MULTISIG_PUBKEY` | C 완료 후 기입 | - |

#### F. 구현 순서 준수

> 순서가 바뀌면 Realm 파라미터를 재설정해야 하므로 반드시 아래 순서를 따른다.

```
1. RWA Token Mint 생성 (A)
2. Council Token Mint 생성 (B)
3. Squads Multisig 생성 → Council Mint Authority 이전 (C)
4. Realms Realm 생성 (환경 변수 E 완성 후)
5. UI 구현 (D 확인 후)
6. QA 시나리오 전체 통과 확인
```

---

### 1.3. 구현 상태 (Implementation Status)

| 구성 요소 | 상태 | 비고 |
| :--- | :--- | :--- |
| Realms Realm 생성 | 미구현 | Solana Realms 기반 DAO 셋업 |
| RWA 토큰 기반 1:1 투표권 | 미구현 | SPL Token 잔액 = 투표권 |
| 제안(Proposal) 생성·투표 UI | 미구현 | `/invest/:id/governance` (투자 상세 내 거버넌스 탭) |
| 오프체인 보조 (포럼·회의록) | 미구현 | 문서/포럼 연동 (선택) |

---

## 2. 기술 스택

### 2.1. 체인 및 도구

| 항목 | 선택 | 버전/비고 |
| :--- | :--- | :--- |
| **체인** | Solana | Mainnet / Devnet (초기 개발) |
| **DAO 프레임워크** | Realms | Solana Realms DAO 툴킷 |
| **토큰 표준** | SPL Token | RWA 토큰 = 투표권 소스 |
| **지갑 연동** | Solana Wallet Adapter | 기존 투자 플로우와 동일 |

### 2.2. 환경 변수

| 변수 | 용도 |
| :--- | :--- |
| `SOLANA_NETWORK` | `mainnet-beta` / `devnet` |
| `REALMS_REALM_ID` | Realms DAO Realm 공개키 |
| `RWA_TOKEN_MINT` | RWA SPL Token Mint 공개키 (투표권 산정용) |
| `COUNCIL_TOKEN_MINT` | Council SPL Token Mint 공개키 (제안 생성 권한용) |
| `MULTISIG_PUBKEY` | Squads 멀티시그 지갑 공개키 (비상 관리 권한) |

---

## 3. 투표권 산정 (RWA 1:1)

### 3.1. 규칙

*   **투표권 = RWA 토큰 보유량 1:1**
*   **스냅샷 시점**: **제안 생성 시점 스냅샷 고정** (투표 진행 중 매수를 통한 영향력 조작 방지)
*   **참여자 구분 없음**: 투자자·마을 대표·지방정부 모두 동일. 별도 가중치·특별 권한 없음

### 3.2. 토큰 이중 구조 (권한 분리)

Realms의 Community/Council 이중 토큰 구조를 활용하여 투표권과 제안 생성 권한을 분리한다.

| 토큰 | 대상 | 역할 |
| :--- | :--- | :--- |
| **Community Token** (RWA SPL Token) | 투자자·마을 대표·지방정부 전체 | 투표권 (1:1) |
| **Council Token** (별도 SPL Token) | 마을 대표·지방정부에게만 발급 | 제안 생성 권한 |

*   Council Token은 양도 불가(Non-transferable) 설정 권장. 마을 대표·지방정부 교체 시 운영자가 재발급
*   투자자는 Community Token(RWA)만 보유하므로 투표는 가능하나 제안 생성 불가

### 3.3. Realms 파라미터 (Realm 생성 시 설정값)

| Realms 파라미터 | 값 | 설명 |
| :--- | :--- | :--- |
| `communityMint` | `RWA_TOKEN_MINT` | 투표권 토큰 = RWA SPL Token |
| `councilMint` | `COUNCIL_TOKEN_MINT` | 제안 생성 권한 토큰 (마을 대표·지방정부 전용) |
| `minCommunityTokensToCreateProposal` | `u64::MAX` (사실상 비활성화) | Community Token으로는 제안 생성 불가 |
| `minCouncilTokensToCreateProposal` | **1** | Council Token 1개 이상 보유 시 제안 생성 가능 |
| `voteThresholdPercentage` | **60%** | 가결 기준 (참여 투표 대비) |
| `communityVoteThreshold` (Quorum) | **10%** | 총 유통량 대비 최소 참여 비율 |
| `maxVotingTime` | **604800** (7일, 초 단위) | 기본 투표 기간; 긴급 안건은 별도 합의로 259200(3일) 적용 |

### 3.4. 기술적 흐름

1. Realms Realm 생성 시 `communityMint = RWA_TOKEN_MINT`, `councilMint = COUNCIL_TOKEN_MINT` 설정
2. 마을 대표·지방정부 지갑에 Council Token 발급 (운영자가 민팅)
3. 제안 생성 블록 기준 RWA 잔액을 스냅샷으로 투표권 확정
4. 투표 결과는 온체인에 기록되며, 수익 배분·Eco-Points 시스템과 **상태·데이터를 공유하지 않음**

---

## 4. 비상 관리 권한 (Multisig)

### 4.1. 구성

*   **도구**: Squads Protocol v4 (`@sqds/multisig` 패키지)
*   **서명 구조**: M-of-N (예: 3-of-5). 핵심 팀원·마을 대표·외부 자문으로 구성
*   **멀티시그 지갑 주소**: 환경 변수 `MULTISIG_PUBKEY`에 기록, 커뮤니티에 공개

### 4.2. 통제 범위 (한정적)

| 대상 | 통제 가능 여부 | 내용 |
| :--- | :--- | :--- |
| Council Token Mint Authority | 가능 | 마을 대표·지방정부 교체 시 재발급 |
| 커스텀 프로그램 (배당 풀 등) | 가능 | Upgrade Authority 또는 Pause 키를 멀티시그로 설정 |
| DAO Treasury | 가능 | 비상 자금 이동 |
| Realms(`spl-governance`) 자체 | **불가** | Solana 재단 관리 공개 프로그램. 일시 중단·강제 롤백 대상 아님 |

### 4.3. 의존성 추가

| 패키지 | 용도 |
| :--- | :--- |
| `@sqds/multisig` | Squads Protocol v4 클라이언트 |

---

## 5. 거버넌스와 수익 배분의 완전한 분리

### 5.1. 분리 원칙

*   **로직·시스템 수준 완전 분리**
*   DAO(Realms) 스마트 컨트랙트와 수익 배분·배당 스마트 컨트랙트는 **별도 프로그램**
*   공유 상태(Shared State) 없음. DAO 결과가 수익 배분 로직에 직접 입력되지 않음

### 5.2. 구현 지침

| 구분 | DAO (본 문서) | 수익 배분 (별도 문서) |
| :--- | :--- | :--- |
| 프로그램 | Realms 기반 | RWA Dividend Pool 등 별도 Anchor Program |
| 데이터 소스 | RWA 토큰 잔액 (투표권) | RWA 토큰 잔액 (배당 비율) |
| 트랜잭션 | 제안·투표·실행 | 배당금 Claim |
| 연동 | 없음 | 없음 |

---

## 6. 제안(Proposal) 및 투표 흐름

### 6.1. 의사결정 대상 (기획서 Section 4 기준)

*   숙소 운영 규칙 (예약·취소, 최소/최대 숙박 일수)
*   브랜드·서비스 가이드라인
*   마을 기금 사용 기준
*   기타 DAO 규약에 정의된 운영 가이드라인

### 6.2. 기술 흐름 (Realms 표준)

1. **제안 생성**: Council Token 보유자(마을 대표·지방정부)가 제안서 작성 후 Realms에 등록
2. **투표 기간**: 설정된 기간 동안 RWA 1:1 투표권으로 찬성/반대/기권
3. **결과 확정**: 정족수·과반수 조건 충족 시 온체인에 결과 기록
4. **실행(Optional)**: 자동 실행이 필요한 안건은 Realms Instruction 실행. 규칙 변경 등은 오프체인 운영 반영

---

## 7. 클라이언트 연동

### 7.1. 웹 앱 요구사항

*   **지갑 연결**: 기존 Solana Wallet Adapter 재사용 (투자 플로우와 동일)
*   **진입점**: 상단 네비게이션바에 노출하지 않음. 투자 상세 페이지(`/invest/:id`) 내 [거버넌스] 탭으로 진입
    *   이유: RWA 보유자 전용 기능이므로 일반 방문자 노출을 최소화하고, 투자 → 보유 → 거버넌스 참여의 자연스러운 흐름 유지
    *   1단계 이후 DAO가 성숙하면 `/governance` 독립 경로 + 네비게이션 추가로 전환 검토
*   **라우트**: `/invest/:id/governance` — 제안 목록·투표 폼 노출
*   **RWA 잔액 표시**: SPL Token `getTokenAccountBalance` 또는 Realms SDK로 투표권(예상) 표시

### 7.2. 의존성

| 패키지 | 버전 | 용도 |
| :--- | :--- | :--- |
| `@solana/web3.js` | latest | RPC, 트랜잭션 |
| `@solana/spl-token` | latest | RWA 토큰 잔액 조회 |
| `@solana/wallet-adapter-react` | latest | 지갑 연결 (기존 투자 플로우 재사용) |
| `@solana/spl-governance` | latest | Realms 프로그램 클라이언트 (Realm 생성·제안·투표 호출) |
| `@sqds/multisig` | latest | Squads Protocol v4 (비상 관리 멀티시그) |

---

## 8. 환경 및 배포

### 8.1. 초기 시범 운영

*   **법인 미등록**: 온체인만으로 시작 (기획서 Section 8)
*   **네트워크**: Devnet으로 개발·테스트 후 Mainnet 전환 검토
*   **오프체인 보조**: GitHub Discussions에서 제안 사전 토론 및 회의록 보관. 온체인 투표 전 커뮤니티 합의 형성 용도

### 8.2. 마일스톤

| 단계 | 내용 | 완료 조건 |
| :--- | :--- | :--- |
| 1 | Realms Realm 생성 (RWA Mint + Council Token 연동) | Devnet Realm 배포, RWA 1:1 투표권 및 제안 권한 분리 확인 |
| 2 | Squads 멀티시그 설정 | M-of-N 서명자 구성, Council Mint Authority 이전 완료 |
| 3 | 제안 생성·투표 UI | 웹에서 제안 조회·투표 가능 (`/invest/:id/governance`) |
| 4 | 오프체인 보조 (선택) | GitHub Discussions 링크 연동 |
| 5 | QA 테스트 시나리오 검증 | `05_QA_Validation/DAO_TEST_SCENARIOS.md` 기준 전체 시나리오 통과 |

---

## 9. Related Documents

- **Concept_Design**: [18_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/18_DAO_GOVERNANCE_PLAN.md) - DAO 기획서 (본 명세의 기반)
- **Concept_Design**: [12_PITCH_DECK_v2.md](../01_Concept_Design/12_PITCH_DECK_v2.md) - 피치 덱 (RWA·DAO 전략)
- **Archive**: [future_blockchain/11_RWA_DAO_GOVERNANCE_VISION.md](../00_ARCHIVE/future_blockchain/11_RWA_DAO_GOVERNANCE_VISION.md) - 레거시 DAO 비전
- **Archive**: [future_blockchain/09_BLOCKCHAIN_ROADMAP.md](../00_ARCHIVE/future_blockchain/09_BLOCKCHAIN_ROADMAP.md) - 블록체인 로드맵 (Phase 4 DAO)
- **Logic_Progress**: [14_RWA_REAL_TIME_DIVIDEND_LOGIC.md](../04_Logic_Progress/14_RWA_REAL_TIME_DIVIDEND_LOGIC.md) - RWA 배당 로직 (수익 배분, DAO와 분리)
- **QA_Validation**: [DAO_TEST_SCENARIOS.md](../05_QA_Validation/DAO_TEST_SCENARIOS.md) - DAO 투표·제안·멀티시그 테스트 시나리오
