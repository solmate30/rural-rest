# 08. DAO 구현 명세서 (Technical Specification)

> Created: 2026-02-18 12:00
> Last Updated: 2026-04-03 00:00
> Migration: Realms → Custom Anchor (2026-03-30). 이전 Realms 버전은 `docs/00_ARCHIVE/08_DAO_IMPLEMENTATION_SPEC_REALMS.md`에 보존.

본 문서는 [09_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/09_DAO_GOVERNANCE_PLAN.md) 기획서를 바탕으로 Rural Rest DAO의 1단계 기술 구현을 정의한다. RWA 1차 발행 직후 투표 기능만을 온체인으로 구현하는 범위를 기술한다.

---

## Realms 폐기 사유

| # | 사유 | 심각도 |
|---|------|--------|
| 1 | **Token-2022 미지원** — spl-governance는 구형 SPL Token만 지원. RWA 토큰이 Token-2022 NonTransferable extension을 사용하므로 Realms에 토큰 입금/투표 불가 | Hard Blocker |
| 2 | **유지보수 중단** — v3.1.0 (2022.12) 이후 3년간 메이저 업데이트 없음. 원본 repo (solana-labs/SPL) 2025.03 아카이브 | High Risk |
| 3 | **10% 캡 미지원** — Realms 네이티브 지원 없음. Voter Weight Addin 커스텀 프로그램을 별도 작성해야 하므로 결국 커스텀 코드 불가피 | Complexity |
| 4 | **다중 Mint 비호환** — Realms는 단일 communityMint 요구. 매물별 개별 mint 구조와 비호환 | Architecture |

---

## 1. 개요 및 구현 범위

### 1.1. 기반 문서

- **기획서**: [09_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/09_DAO_GOVERNANCE_PLAN.md)
- **투표 방어 로직**: [11_DAO_VOTING_DEFENSE_LOGIC.md](../01_Concept_Design/11_DAO_VOTING_DEFENSE_LOGIC.md)
- **핵심 가정**: RWA 1차 발행 직후 DAO 운영 시작, 1단계는 **투표만** 구현 (자동 온체인 실행 없음)

### 1.2. 착수 전 준비 체크리스트 (Pre-Implementation Checklist)

> 아래 항목이 모두 완료되어야 구현을 시작할 수 있다.

#### A. RWA 토큰 준비

- [x] **RWA Token-2022 Mint** — Anchor 프로그램(`rural-rest-rwa`)의 `initialize_property`에서 생성됨
- [x] **NonTransferable extension** — 적용 완료 (2026-03-30)
- [x] **테스트용 RWA 토큰 분배** — localnet 테스트에서 `purchase_tokens`로 분배

#### B. Council Token 준비

- [x] **Council Token Mint 생성** — `8R419i6fFFMxneC2hEag6ZFh9qVomvvdGqwWiLRyKUBW` (devnet, SPL Token)
    - `COUNCIL_MINT` 환경 변수에 공개키 기입 완료
    - Mint Authority = Crank Authority (`6xwcyZ8gwbW6vXFbijSYeTkcrtGfXueU82LRsgsnk9nm`)
- [x] **Admin 대시보드 발급 UI** — `/admin` 페이지 상단 "Council Token 발급" 버튼 → 사이드 패널
    - `POST /api/admin/issue-council-token` API 구현 완료
- [ ] **마을 대표/지방정부 지갑 목록 확보** — 실제 운영 시 필요
- [ ] **host/지자체 회원가입 시 자동 발급** — 추후 구현 예정

#### C. Squads Multisig 준비 (MVP 이후)

- [ ] **Squads Protocol v4 Multisig 생성** — mainnet 전환 시 필요
- [ ] **Council Token Mint Authority → Multisig 이전** — mainnet 전환 시 필요

#### D. DAO 프로그램 배포

- [x] **`rural-rest-dao` Anchor 프로그램 빌드 및 배포** — `3JfNNdbhrvtc6tzXwp2R2K51grjiHMT1bLKSqAnV9bqX`
- [x] **`initialize_dao` 호출** — DaoConfig PDA 생성 완료
    - PDA: `C7ovfgZkJLbDAn5bs4gQtVT2dENosmfi58DmFvufBWiH`
    - voting_period: 604800 (7일), quorum: 10%, approval: 50%, cap: 없음

#### E. 환경 변수 완성

| 변수 | 용도 | 상태 |
|------|------|------|
| `SOLANA_RPC_URL` | devnet RPC URL | 완료 |
| `SERVER_DAO_PROGRAM_ID` | DAO 프로그램 ID | 완료 |
| `COUNCIL_MINT` | Council Token Mint 공개키 | 완료 |
| `CRANK_SECRET_KEY` | Crank 비밀키 (발급/자동화용) | 완료 |

#### F. 구현 순서 (실제 완료 순서)

```
1. Anchor DAO 프로그램 작성 + localnet 테스트  ✅
2. Council Token Mint 생성 (spl-token CLI)      ✅
3. Devnet 배포 + initialize_dao                 ✅
4. 웹 UI /governance, /governance/new, /governance/:id  ✅
5. Governance Blinks (/api/actions/governance/:proposalId)  ✅
6. Admin 대시보드 Council Token 발급 패널       ✅
7. Squads Multisig + Mint Authority 이전        □ mainnet 전환 시
```

---

## 2. 기술 스택

| 항목 | 선택 | 비고 |
|------|------|------|
| **체인** | Solana | Devnet → Mainnet |
| **DAO 프레임워크** | 커스텀 Anchor 프로그램 (`rural-rest-dao`) | Realms 폐기, 사유 상단 참조 |
| **토큰 표준** | Token-2022 | RWA (NonTransferable) + Council (NonTransferable) |
| **비상 관리** | Squads Protocol v4 | M-of-N multisig |
| **지갑 연동** | Solana Wallet Adapter | 기존 투자 플로우 재사용 |
| **Anchor** | 0.32.1 | anchor-spl 0.32.1 |

---

## 3. State Accounts (PDA 구조)

### 3.1. DaoConfig

```
PDA Seeds: ["dao_config"]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `authority` | Pubkey | 관리자 (Squads multisig) |
| `council_mint` | Pubkey | Council Token Mint |
| `voting_period` | i64 | 투표 기간 (초). 기본 604800 (7일) |
| `quorum_bps` | u16 | 정족수 (BPS). 기본 1000 (10%) |
| `approval_threshold_bps` | u16 | 가결 기준 (BPS). 기본 6000 (60%) |
| `voting_cap_bps` | u16 | 투표권 하드 캡 (BPS). 기본 1000 (10%) |
| `proposal_count` | u64 | 제안 카운터 (자동 증가) |
| `rwa_program` | Pubkey | RWA 프로그램 ID (InvestorPosition 읽기용) |
| `bump` | u8 | PDA bump |

### 3.2. Proposal

```
PDA Seeds: ["proposal", proposal_id.to_le_bytes()]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | u64 | 제안 ID (DaoConfig.proposal_count에서 할당) |
| `creator` | Pubkey | 제안 생성자 (Council Token 보유자) |
| `title` | String (max 128) | 제안 제목 |
| `description_uri` | String (max 256) | IPFS/Arweave URI (긴 설명) |
| `category` | ProposalCategory | Operations / Guidelines / FundUsage / Other |
| `status` | ProposalStatus | Voting / Succeeded / Defeated / Cancelled |
| `votes_for` | u64 | 찬성 투표 가중치 합계 |
| `votes_against` | u64 | 반대 투표 가중치 합계 |
| `votes_abstain` | u64 | 기권 투표 가중치 합계 |
| `total_eligible_weight` | u64 | 제안 생성 시점 전체 RWA 유통량 스냅샷 |
| `voting_starts_at` | i64 | 투표 시작 시간 (Unix timestamp) |
| `voting_ends_at` | i64 | 투표 종료 시간 (Unix timestamp) |
| `created_at` | i64 | 생성 시간 (Unix timestamp) |
| `bump` | u8 | PDA bump |

### 3.3. VoteRecord

```
PDA Seeds: ["vote", proposal_id.to_le_bytes(), voter.key()]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `proposal` | Pubkey | 대상 Proposal |
| `voter` | Pubkey | 투표자 |
| `vote_type` | VoteType | For / Against / Abstain |
| `weight` | u64 | 캡 적용 후 실제 투표 가중치 |
| `raw_weight` | u64 | 캡 적용 전 원래 보유량 |
| `bump` | u8 | PDA bump |

### 3.4. Enums

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalCategory {
    Operations,   // 숙소 운영 규칙 (예약/취소, 숙박 일수 등)
    Guidelines,   // 브랜드/서비스 가이드라인
    FundUsage,    // 마을 기금 사용
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    Voting,
    Succeeded,
    Defeated,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum VoteType {
    For,
    Against,
    Abstain,
}
```

---

## 4. Instructions (5개)

### 4.1. `initialize_dao`

- **서명자**: authority (Squads multisig)
- **동작**: DaoConfig PDA 초기화, 파라미터 설정
- **검증**:
  - `council_mint` 유효한 Token-2022 Mint
  - `voting_period` > 0
  - `quorum_bps` <= 10000
  - `approval_threshold_bps` <= 10000
  - `voting_cap_bps` <= 10000
  - `rwa_program` 유효한 프로그램 ID

### 4.2. `create_proposal`

- **서명자**: creator (Council Token 보유자)
- **동작**: Proposal PDA 생성, 투표 기간 시작, proposal_count 증가
- **검증**:
  - creator의 Council Token ATA 잔액 >= 1
  - `title` 길이 <= 128 bytes
  - `description_uri` 길이 <= 256 bytes
- **Remaining Accounts**: 모든 Active 상태 PropertyToken 계정 (readonly)
- **추가 Account**: `council_mint` — Council Token ATA 검증용 (supply는 사용하지 않음)
  ```
  total_eligible_weight = sum(property_token.tokens_sold for each active property)
  ```
- **스냅샷**: 생성 시점의 `total_eligible_weight` 기록 → 정족수/캡 계산 기준 (RWA만)

### 4.3. `cast_vote`

- **서명자**: voter
- **동작**: VoteRecord PDA 생성, Proposal 투표수 업데이트
- **투표권 계산**:
  ```
  raw_weight = sum(investor_position.amount for each property where owner == voter)
  cap = total_eligible_weight * voting_cap_bps / 10000
  weight = min(raw_weight, cap)
  ```
- **Remaining Accounts**: voter의 모든 InvestorPosition PDA (readonly)
  - 각 position의 `owner == voter.key()` 검증
- **검증**:
  - `voting_starts_at <= now <= voting_ends_at`
  - `status == Voting`
  - VoteRecord PDA 미존재 (중복 투표 방지)
  - `raw_weight > 0` (RWA 미보유자 차단 — Council Token만 보유 시 투표 불가)

### 4.4. `finalize_proposal`

- **서명자**: 누구나 (permissionless, 투표 기간 종료 후)
- **동작**: 최종 결과 판정, status 업데이트
- **판정 로직**:
  ```
  total_voted = votes_for + votes_against + votes_abstain
  quorum_met = total_voted >= total_eligible_weight * quorum_bps / 10000

  // 기권은 정족수에 포함되지만 가결 판정에서 제외
  approval = votes_for >= (votes_for + votes_against) * approval_threshold_bps / 10000

  if !quorum_met → Defeated
  if approval → Succeeded
  else → Defeated
  ```
- **검증**:
  - `now > voting_ends_at`
  - `status == Voting`

### 4.5. `cancel_proposal`

- **서명자**: creator 또는 authority (Squads multisig)
- **동작**: status → Cancelled
- **검증**: `status == Voting`

---

## 5. CU 예산 (예상)

| Instruction | 예상 CU | 비고 |
|-------------|---------|------|
| `initialize_dao` | 20,000 | 단순 초기화 |
| `create_proposal` | 50,000 | PropertyToken remaining accounts 읽기 |
| `cast_vote` | 60,000-80,000 | InvestorPosition remaining accounts 읽기 (매물 수에 비례) |
| `finalize_proposal` | 15,000 | 산술 연산만 |
| `cancel_proposal` | 10,000 | 상태 변경만 |

경주 파일럿 5개 매물 기준 → remaining accounts 최대 5개 → CU 충분.

---

## 6. 투표권 산정

### 6.1. 규칙

- **투표권 = RWA 보유량만 (1:1)**
  - RWA: InvestorPosition.amount across all properties
  - Council Token은 투표권에 포함되지 않음
- **10% 하드 캡**: 온체인 네이티브 적용. `min(raw_weight, total_eligible_weight * 10%)`
- **스냅샷**: `total_eligible_weight`는 제안 생성 시점에 기록 (PropertyToken.tokens_sold 합산만)
- **개인 투표권**: cast_vote 시점의 InvestorPosition 잔액 합산

### 6.2. 토큰 역할 구분

| 토큰 | 대상 | 역할 | 표준 |
|------|------|------|------|
| **RWA Token** | 투자자 | 투표권 (보유량 비례, 1:1) | Token-2022 NonTransferable |
| **Council Token** | 마을 대표/지방정부 | 제안 생성 자격만 | Token-2022 NonTransferable |

- 마을/지자체는 RWA 미구매 → 투표권 없음
- 역할 분리: 현장을 아는 주체(마을/지자체)가 안건 제안 → 경제적 이해관계자(투자자)가 결정

### 6.3. Remaining Accounts 패턴

**`cast_vote`에서 투표권 합산:**
```
remaining_accounts: [
  investor_position_property_1 (readonly),
  investor_position_property_2 (readonly),
  ...
]
```
각 InvestorPosition 역직렬화 → `owner == voter` 검증 → `amount` 합산 → 캡 적용.

**`create_proposal`에서 전체 유통량 스냅샷:**
```
remaining_accounts: [
  property_token_1 (readonly),  // Active 상태
  property_token_2 (readonly),
  ...
]
+ council_mint (named account)
```
각 account의 `tokens_sold` 합산 + `council_mint.supply` → `total_eligible_weight`.

---

## 7. 비상 관리 권한 (Multisig)

### 7.1. 구성

- **도구**: Squads Protocol v4
- **서명 구조**: M-of-N (예: 2-of-3: Rural Rest + 지방정부 + 마을 대표)
- **공개키**: `MULTISIG_PUBKEY` 환경 변수

### 7.2. 통제 범위

| 대상 | 가능 | 내용 |
|------|------|------|
| Council Token Mint Authority | O | 마을 대표 교체 시 재발급 |
| DaoConfig 파라미터 변경 | O | authority만 호출 가능 |
| cancel_proposal | O | 비상 제안 취소 |
| DAO 프로그램 Upgrade Authority | O | 프로그램 업그레이드 |
| RWA 프로그램 | X | 별도 authority 관리 |

---

## 8. 거버넌스와 수익 배분의 완전한 분리

### 8.1. 분리 원칙

- DAO 프로그램(`rural-rest-dao`)과 RWA 프로그램(`rural-rest-rwa`)은 **별도 프로그램**
- **공유 상태 없음**. DAO는 RWA의 InvestorPosition/PropertyToken을 **읽기만** 수행 (CPI 없음, 직접 역직렬화)
- DAO 가결 결과가 수익 배분 로직에 직접 입력되지 않음

### 8.2. 구현 지침

| 구분 | DAO (본 문서) | 수익 배분 (별도) |
|------|---------------|------------------|
| 프로그램 | `rural-rest-dao` | `rural-rest-rwa` |
| 데이터 소스 | InvestorPosition.amount (투표권) | InvestorPosition.amount (배당 비율) |
| 트랜잭션 | 제안/투표/finalize | distribute/claim |
| 연동 | 없음 | 없음 |

---

## 9. 클라이언트 연동

### 9.1. 웹 앱 요구사항

- **지갑 연결**: 기존 Solana Wallet Adapter 재사용
- **진입점**: 독립 거버넌스 섹션 (전체 DAO 범위, 매물별 아님)
- **라우트**:
  - `/governance` — 제안 목록 (탭: 투표중/완료/전체, 카테고리 필터)
  - `/governance/new` — 제안 생성 (폼 + 실시간 미리보기)
  - `/governance/:id` — 제안 상세 (투표 현황, 마크다운 설명, 투표 패널)

### 9.2. 의존성

| 패키지 | 용도 |
|--------|------|
| `@coral-xyz/anchor` | DAO 프로그램 IDL 기반 클라이언트 |
| `@solana/web3.js` | RPC, 트랜잭션 |
| `@solana/spl-token` | Council Token ATA 잔액 조회 |
| `@solana/wallet-adapter-react` | 지갑 연결 (기존 재사용) |
| `@sqds/multisig` | Squads Protocol v4 (비상 관리) |

### 9.3. DB 스키마 (오프체인 캐시)

```sql
-- 제안 오프체인 메타데이터 (온체인 Proposal과 동기화)
CREATE TABLE dao_proposals (
    id TEXT PRIMARY KEY,
    proposal_id INTEGER NOT NULL UNIQUE,     -- 온체인 ID
    proposal_pubkey TEXT UNIQUE,
    creator_wallet TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,               -- 전체 설명 (온체인은 URI만)
    category TEXT NOT NULL,                  -- operations/guidelines/fund_usage/other
    status TEXT NOT NULL,                    -- voting/succeeded/defeated/cancelled
    votes_for INTEGER NOT NULL DEFAULT 0,
    votes_against INTEGER NOT NULL DEFAULT 0,
    votes_abstain INTEGER NOT NULL DEFAULT 0,
    voting_ends_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
```

### 9.4. UI 상태 분기

| 상태 | 표시 |
|------|------|
| 지갑 미연결 | "지갑을 연결하세요" + 연결 버튼 |
| RWA/Council 미보유 | "투표권이 없습니다 (RWA / Council 토큰 미보유)" |
| RWA 보유 | 제안 목록 + 투표 가능 + 투표권 표시 |
| Council Token 보유 | 제안 생성 버튼 활성화 + 투표 가능 (Council Token 가중치 포함) |
| RWA + Council 모두 보유 | 제안 생성 + 투표 (RWA + Council 합산 가중치) |

---

## 10. 셋업 스크립트

| 스크립트 | 동작 |
|----------|------|
| `setup-council-mint.ts` | Council Token Mint 생성 (Token-2022, NonTransferable) |
| `setup-squads-multisig.ts` | Squads v4 multisig 생성 (M-of-N) |
| `transfer-council-authority.ts` | Council Mint Authority → Squads multisig 이전 |
| `initialize-dao.ts` | DaoConfig 초기화 (multisig 서명) |
| `mint-council-tokens.ts` | 마을 대표 지갑에 Council Token 발급 |
| `verify-dao-setup.ts` | 온체인 상태 검증 |

---

## 11. 마일스톤

| 단계 | 내용 | 완료 조건 |
|------|------|-----------|
| 1 | Anchor DAO 프로그램 작성 + localnet 테스트 | 5개 instruction, 테스트 전체 통과 |
| 2 | Council Token + Squads Multisig 셋업 | 스크립트 실행 + 권한 이전 확인 |
| 3 | Devnet 배포 + E2E | initialize_dao → create_proposal → cast_vote → finalize 전체 플로우 |
| 4 | 웹 UI | `/governance` 제안 목록/상세/생성 |
| 5 | QA 시나리오 전체 검증 | `07_DAO_TEST_SCENARIOS.md` 기준 통과 |

---

## 12. Phase 2+ Backlog (운영환경 전환 시)

| # | 항목 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | 보안 감사 | High | Sec3 + OtterSec 등 외부 감사 |
| 2 | 개인별 스냅샷 정교화 | High | 제안 시점 개인별 잔액 머클 트리 (현재는 cast_vote 시점 조회) |
| 3 | KYC 연동 Sybil 방어 | High | 동일인 다중 지갑 방어 |
| 4 | remaining accounts 확장성 | Medium | 매물 50개+ 시 머클 증명 온체인 검증으로 전환 |
| 5 | 프로그램 업그레이드 전략 | Medium | Upgrade Authority → multisig |
| 6 | `emit!` 이벤트 + 인덱싱 | Medium | ProposalCreated, VoteCast, ProposalFinalized |
| 7 | Dual-Pass (핵심 안건) | Low | RWA 투표 + Council 추가 승인 이중 통과 |
| 8 | 이차 투표 (Quadratic Voting) | Low | 10% 하드 캡의 보완/대체안 |

> **참고**: RWA 토큰이 non-transferable이므로 "토큰 이동을 통한 투표 조작"은 불가. 제안 후 신규 purchase_tokens만 해당되며, 이는 실제 투자이므로 Phase 1에서는 허용 가능.

---

## 13. Error Codes

| 코드 | 이름 | 조건 |
|------|------|------|
| 6000 | `InvalidVotingPeriod` | voting_period <= 0 |
| 6001 | `InvalidQuorum` | quorum_bps > 10000 |
| 6002 | `InvalidThreshold` | approval_threshold_bps > 10000 |
| 6003 | `InvalidVotingCap` | voting_cap_bps > 10000 |
| 6004 | `TitleTooLong` | title > 128 bytes |
| 6005 | `DescriptionUriTooLong` | description_uri > 256 bytes |
| 6006 | `InsufficientCouncilTokens` | Council Token ATA 잔액 < 1 |
| 6007 | `VotingNotStarted` | now < voting_starts_at |
| 6008 | `VotingEnded` | now > voting_ends_at |
| 6009 | `VotingNotEnded` | finalize 시 now <= voting_ends_at |
| 6010 | `InvalidProposalStatus` | 예상 status와 불일치 |
| 6011 | `NoVotingPower` | raw_weight == 0 (RWA + Council 합산) |
| 6012 | `InvalidPositionOwner` | InvestorPosition.owner != voter |
| 6013 | `InvalidPropertyStatus` | PropertyToken.status != Active |
| 6014 | `MathOverflow` | checked_* 산술 실패 |
| 6015 | `Unauthorized` | cancel 시 creator/authority 아닌 서명자 |
| 6020 | `InvalidCouncilAta` | Council Token ATA mint != dao_config.council_mint |
| 6021 | `InvalidCouncilAtaOwner` | Council Token ATA owner != voter |

---

## 14. 제안 설명 오프체인 저장 (GitHub Gist)

### 14.1. 배경

온체인 Proposal 계정의 `description_uri`(max 256 bytes)에는 URL만 저장한다. 실제 제안 설명 본문은 오프체인에 저장하고 URL로 참조한다.

Solana Realms의 방식을 참고하여 **GitHub Gist**를 사용한다.

| 항목 | 내용 |
|------|------|
| **저장소** | GitHub Gist (public) |
| **인증** | 서버 측 GitHub PAT (`GITHUB_GIST_TOKEN`, gist scope) |
| **사용자 요구사항** | GitHub 계정 불필요 (서버가 대신 생성) |
| **파일명** | `proposal.md` |
| **형식** | Markdown |

### 14.2. 흐름

```
1. 사용자가 /governance/new에서 마크다운으로 설명 작성
2. "제안 등록하기" 클릭
3. 프론트엔드 → POST /api/governance/gist { title, content }
4. 서버 → GitHub API (POST https://api.github.com/gists)
   - Authorization: Bearer GITHUB_GIST_TOKEN
   - Body: { public: true, files: { "proposal.md": { content } } }
5. 서버 → 프론트엔드에 raw_url 반환
6. 프론트엔드 → 온체인 create_proposal(title, raw_url, category)
7. description_uri에 Gist raw URL 저장
```

### 14.3. 상세 페이지 렌더링

- `governance.$id.tsx` loader에서 `description_uri`가 `gist.githubusercontent.com`을 포함하면 서버에서 fetch → 마크다운 텍스트 획득
- `react-markdown` 컴포넌트로 렌더링 (커스텀 컴포넌트 스타일링, `@tailwindcss/typography` 미사용)
- Gist URL이 아닌 경우 외부 링크로만 표시

### 14.4. 대체 모드

사용자는 "직접 작성" 대신 "URL 입력" 모드를 선택하여 기존 문서(Arweave, IPFS, 외부 URL 등)를 직접 입력할 수 있다.

### 14.5. 환경 변수

| 변수 | 용도 | 비고 |
|------|------|------|
| `GITHUB_GIST_TOKEN` | GitHub PAT (gist scope) | 서버 전용, `VITE_` 접두사 없음 |

토큰 미설정 시 `/api/governance/gist`는 503 응답 → 사용자에게 "URL 입력" 모드 안내.

---

## 15. 설계 결정 근거 (Design Decision Records)

> Updated: 2026-04-01

### 15.1. Council Token 역할 결정

**결정: Council Token = 제안 생성 자격만. 투표권 없음.**

마을대표/지방정부는 RWA를 구매하지 않으므로 투표권이 없다. Council Token은 제안을 올릴 수 있는 자격증 역할만 한다.

**설계 원칙**: 현장을 아는 주체(마을/지자체)가 안건을 제안하고, 경제적 이해관계자(투자자)가 투표로 결정한다.

| 토큰 | 제안 생성 | 투표 | 발행 방식 |
|------|---------|------|----------|
| Council Token | O (1개 이상 필수) | X | authority가 무료 발급 |
| RWA Token | X | O (보유량 기반) | USDC로 구매 |

- 제안은 마을/지자체만 가능: 현장 상황을 아는 주체가 안건을 올리는 구조
- 투표는 양쪽 모두: 제안에 대해 투자자 + 마을 모두 의사 표현

### 15.3. Quorum 10% 유지 근거

**결정: 단일 quorum 10% (1000 BPS), 카테고리별 차등 미적용**

- 카테고리별 quorum 차등은 대부분 DAO에서 채택하지 않음 (Compound, Nouns, Uniswap 등 단일 quorum)
- MVP 단계에서 온체인 복잡성 추가는 부적절
- 10%는 초기 소규모 커뮤니티에서 정족수 미달 방지와 최소 합의 사이 균형점
- 프로덕션 전환 시 카테고리별 차등 검토 (특히 `fundUsage` 강화)

---

## 16. MVP 현황 및 향후 개선 로드맵


> Updated: 2026-04-01

### 16.1. MVP 현재 구현 상태

| 항목 | 현재 (MVP) | 비고 |
|------|-----------|------|
| Authority | Rural Rest 단독 Keypair | 단일 서명자 |
| Quorum (정족수) | 10% (1000 BPS) | 전 카테고리 동일 |
| Approval Threshold | 60% (6000 BPS) | |
| Voting Cap | 10% (1000 BPS) | 고래 방지 |
| Voting Period | 7일 (604800초) | 범위: 1~30일 |
| Finalize | 서버 자동 (permissionless) | loader에서 투표 기간 만료 시 자동 호출 |
| Council 참여 요건 | 없음 | Council Token 보유자 투표 강제 아님 |
| 투자자 참여 요건 | 없음 | RWA 보유자 투표 강제 아님 |
| Squads Multisig | 미적용 | |

### 16.2. 프로덕션 전환 시 필수 개선 사항

아래 항목은 실서비스 전에 반드시 구현해야 한다. 우선순위 순.

#### A. Authority Multisig 전환 (P0)

- 현재: Rural Rest 단독 keypair이 authority
- 목표: **Squads Protocol v4 Multisig (2-of-3)**
  - 서명자: Rural Rest 운영팀 + 지자체 담당자 + 마을 대표
- 범위: `initialize_dao`, `release_funds`, `activate_property`, Council Token mint authority
- 이유: 단일 서명자는 single point of failure. 실물 자산 운영에서는 다자 합의 필수

#### B. 카테고리별 Quorum 차등 적용 (P1)

- 현재: 단일 `quorum_bps` (10%)
- 목표: 카테고리별 별도 quorum

| 카테고리 | 현재 | 프로덕션 목표 | 이유 |
|----------|------|-------------|------|
| `operations` (운영) | 10% | **20%** (2000 BPS) | 숙소 운영 규칙 변경 -- 적당한 합의 필요 |
| `guidelines` (가이드라인) | 10% | **15%** (1500 BPS) | 비교적 가벼운 안건 |
| `fundUsage` (자금 사용) | 10% | **30%** (3000 BPS) | 실제 자금 이동 -- 충분한 참여 필수 |
| `other` (기타) | 10% | **15%** (1500 BPS) | 일반 안건 |

- 구현: `DaoConfig`에 `quorum_bps`를 카테고리별 4개 필드로 분리하거나, 별도 `CategoryConfig` PDA 도입
- 이유: 자금 사용 안건과 가이드라인 안건의 중요도가 다름

#### C. RWA 투자 기간 만료 자동 Status 전환 (P1)

- 현재: authority가 수동으로 `release_funds` + `activate_property` 호출
- 목표: 투자 deadline 만료 시 서버에서 자동 트리거
  - 모집률 >= `min_funding_bps` → `release_funds` → `activate_property`
  - 모집률 < `min_funding_bps` → 투자자에게 `refund` 안내
- 구현 방법: 서버 loader 또는 cron job에서 deadline 체크 후 permissionless instruction 호출
- 전제: `release_funds`를 permissionless로 변경하거나, 서버가 authority keypair 보유

#### D. 투표 위임 (Delegation) (P2)

- 현재: 직접 투표만 가능
- 목표: 투자자가 다른 주소에 투표권 위임 가능
- 이유: 모든 투자자가 매번 투표에 참여하기 어려움. 신뢰하는 대표에게 위임

### 16.3. 온체인 프로그램 수정 필요 항목

| 개선 사항 | 프로그램 수정 | 마이그레이션 |
|-----------|-------------|-------------|
| A. Multisig 전환 | 불필요 (authority 변경만) | `update_authority` ix 추가 필요 |
| B. 카테고리별 Quorum | `DaoConfig` 또는 별도 PDA | DaoConfig account 크기 변경 → 마이그레이션 필요 |
| C. RWA 자동 전환 | `release_funds` 권한 변경 검토 | 없음 (서버 로직) |
| D. 투표 위임 | 새 instruction + DelegationRecord PDA | 없음 |

---

## 17. Related Documents

- **기획서**: [09_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/09_DAO_GOVERNANCE_PLAN.md) — DAO 기획 (본 명세의 기반)
- **투표 방어 로직**: [11_DAO_VOTING_DEFENSE_LOGIC.md](../01_Concept_Design/11_DAO_VOTING_DEFENSE_LOGIC.md) — 10% 캡, KYC, Sybil 방어
- **RWA 프로그램 명세**: [11_ANCHOR_PROGRAM_SPEC.md](./11_ANCHOR_PROGRAM_SPEC.md) — InvestorPosition/PropertyToken PDA 구조
- **배당 로직**: [10_RWA_DIVIDEND_LOGIC.md](../04_Logic_Progress/10_RWA_DIVIDEND_LOGIC.md) — DAO와 분리된 수익 배분
- **QA 시나리오**: [07_DAO_TEST_SCENARIOS.md](../05_QA_Validation/07_DAO_TEST_SCENARIOS.md) — DAO 테스트 시나리오
- **Known Issues**: [11_RWA_KNOWN_ISSUES.md](../04_Logic_Progress/11_RWA_KNOWN_ISSUES.md) — RWA 알려진 이슈
- **Archive**: [08_DAO_IMPLEMENTATION_SPEC_REALMS.md](../00_ARCHIVE/08_DAO_IMPLEMENTATION_SPEC_REALMS.md) — 이전 Realms 기반 명세
