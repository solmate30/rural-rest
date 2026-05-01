# DAO & Governance QA Test Scenarios

> Created: 2026-03-10 03:00
> Last Updated: 2026-03-30 16:00
> Migration: Realms → Custom Anchor (2026-03-30). 이전 Realms 버전은 `docs/00_ARCHIVE/07_DAO_TEST_SCENARIOS_REALMS.md`에 보존.

본 문서는 `08_DAO_IMPLEMENTATION_SPEC.md` 및 `09_DAO_GOVERNANCE_PLAN.md`에 정의된 Rural Rest 단일 DAO의 1단계를 검증하기 위한 통합 및 E2E(End-to-End) 테스트 시나리오를 정의한다.

---

## 1. 테스트 환경 및 준비 (Prerequisites)

- **네트워크**: Solana localnet (Anchor 테스트) + Devnet (E2E)
- **테스트 지갑 구성**:
  - `authority` (운영자 / Squads multisig 역할)
  - `councilMember` (마을 대표 / Council Token 1개 보유)
  - `investor1` (투자자 1 / RWA 1,000 보유)
  - `investor2` (투자자 2 / RWA 500 보유)
  - `whale` (고래 투자자 / RWA 3,000 보유 -- 10% 캡 테스트용)
  - `outsider` (RWA/Council Token 미보유)
- **초기 상태**:
  - `rural-rest-rwa` 프로그램: Active 상태 PropertyToken 2개 이상 (tokens_sold 설정)
  - `rural-rest-dao` 프로그램: 배포 완료
  - Council Token-2022 Mint: NonTransferable extension 적용, 배포 완료
  - investor1, investor2, whale: InvestorPosition PDA 생성 + purchase_tokens 완료

---

## 2. 셋업 및 초기화 검증 (Setup & Initialization)

### 시나리오 2.1: DAO 초기화 (`initialize_dao`) 파라미터 검증
- **목적**: DaoConfig PDA가 올바른 파라미터로 초기화되는지 확인
- **서명자**: `authority`
- **Action**: `initialize_dao` instruction 전송
- **Expected Result**:
  - [ ] DaoConfig PDA 생성 확인
  - [ ] `quorum_bps == 1000` (10%)
  - [ ] `approval_threshold_bps == 6000` (60%)
  - [ ] `voting_cap_bps == 1000` (10%)
  - [ ] `voting_period == 604800` (7일)
  - [ ] `council_mint` == Council Token Mint 공개키
  - [ ] `rwa_program` == RWA 프로그램 ID
  - [ ] `proposal_count == 0`

### 시나리오 2.2: 멀티시그(Squads) 권한 인계 (Authority Transfer)
- **목적**: Council Token의 Mint Authority가 Multisig로 정상 이전되었는지 확인
- **사전 조건**: Council Token Mint 배포 완료
- **Action**: Mint Authority를 Multisig 주소로 이전
- **Expected Result**:
  - [ ] 단일 지갑에서 Council Token 추가 민팅 시도 → 에러 (권한 없음)
  - [ ] Multisig 제안을 통해 Council Token 민팅 → 성공

### 시나리오 2.3: Council Token 양도 불가 (NonTransferable) 검증
- **목적**: Council Token이 타 지갑으로 전송 불가함을 확인
- **서명자**: `councilMember`
- **Action**: Council Token을 `investor1`에게 전송 시도
- **Expected Result**:
  - [ ] 트랜잭션 실패 (NonTransferable extension에 의한 차단)
  - [ ] `investor1`의 Council Token 잔액 0 유지

---

## 3. 권한 및 제안 생성 (Proposal Creation)

### 시나리오 3.1: 투자자(Council Token 미보유)의 제안 생성 실패
- **목적**: Council Token 없는 RWA 보유자가 제안을 생성할 수 없음을 확인
- **서명자**: `investor1` (RWA 1,000개, Council Token 0개)
- **Action**: `create_proposal` instruction 전송
- **Expected Result**:
  - [ ] `InsufficientCouncilTokens` 에러 반환
  - [ ] Proposal PDA 생성되지 않음

### 시나리오 3.2: 마을 대표의 제안 생성 성공
- **목적**: Council Token 보유자가 제안을 생성할 수 있음을 확인
- **서명자**: `councilMember` (Council Token 1개 보유)
- **Remaining Accounts**: Active 상태 PropertyToken 계정들
- **Action**: `create_proposal` instruction 전송 (title: "전체 숙소 운영 규칙 개정", category: Operations)
- **Expected Result**:
  - [ ] Proposal PDA 생성 확인
  - [ ] `status == Voting`
  - [ ] `total_eligible_weight` == 모든 Active PropertyToken의 `tokens_sold` 합산
  - [ ] `voting_ends_at == voting_starts_at + dao_config.voting_period`
  - [ ] DaoConfig.proposal_count 1 증가

### 시나리오 3.3: 제안 제목 길이 초과 실패
- **목적**: title 128바이트 초과 시 거부됨을 확인
- **서명자**: `councilMember`
- **Action**: 129바이트 이상 title로 `create_proposal` 전송
- **Expected Result**:
  - [ ] `TitleTooLong` 에러 반환

### 시나리오 3.4: RWA/Council Token 모두 미보유자의 제안 생성 실패
- **서명자**: `outsider`
- **Action**: `create_proposal` instruction 전송
- **Expected Result**:
  - [ ] `InsufficientCouncilTokens` 에러 반환

---

## 4. 투표 권한 및 가중치 (Voting & Weight)

### 시나리오 4.1: 투표권 1:1 매핑 확인
- **목적**: InvestorPosition.amount 합산이 투표 가중치와 일치하는지 확인
- **서명자**: `investor1` (RWA 1,000개)
- **Remaining Accounts**: investor1의 모든 InvestorPosition PDA
- **Action**: `cast_vote` (VoteType::For) instruction 전송
- **Expected Result**:
  - [ ] VoteRecord PDA 생성
  - [ ] `raw_weight == 1000`, `weight == 1000` (캡 미적용, 10% 이내)
  - [ ] Proposal.votes_for += 1000

### 시나리오 4.1+: 투표권 10% 하드 캡 적용 확인
- **목적**: 보유량이 total_eligible_weight의 10% 초과 시 캡이 적용되는지 확인
- **서명자**: `whale` (RWA 3,000개, total_eligible_weight = 10,000 가정)
- **Action**: `cast_vote` (VoteType::For) instruction 전송
- **Expected Result**:
  - [ ] `raw_weight == 3000`
  - [ ] `weight == 1000` (10,000 * 10% = 1,000으로 캡 적용)
  - [ ] Proposal.votes_for에 1,000만 누적 (3,000이 아님)

### 시나리오 4.2: 중복 투표 방지
- **목적**: 동일 제안에 동일 voter가 두 번 투표할 수 없음을 확인
- **서명자**: `investor1` (4.1에서 이미 투표)
- **Action**: 동일 Proposal에 `cast_vote` 재전송
- **Expected Result**:
  - [ ] VoteRecord PDA 이미 존재하므로 `init` constraint 실패 (AccountAlreadyInUse 등)

### 시나리오 4.3: 투표권 없는 사용자의 투표 실패
- **서명자**: `outsider` (RWA 0개)
- **Action**: `cast_vote` instruction 전송 (remaining accounts 빈 배열)
- **Expected Result**:
  - [ ] `NoVotingPower` 에러 반환

### 시나리오 4.4: InvestorPosition.owner 불일치 검증
- **목적**: 타인의 InvestorPosition을 전달해도 투표권에 포함되지 않음을 확인
- **서명자**: `investor2`
- **Remaining Accounts**: investor1의 InvestorPosition PDA (owner != investor2)
- **Action**: `cast_vote` instruction 전송
- **Expected Result**:
  - [ ] `InvalidPositionOwner` 에러 반환

---

## 5. 결론 및 상태 변화 (Resolution & Thresholds)

### 시나리오 5.1: 정족수(Quorum) 미달 시 부결 처리
- **목적**: 참여율이 10% 미만이면 찬성률과 무관하게 부결됨을 확인
- **사전 조건**: total_eligible_weight = 10,000. investor2 (500 RWA, 5%) 단독 찬성 투표. 투표 기간 경과.
- **서명자**: 누구나
- **Action**: `finalize_proposal` instruction 전송
- **Expected Result**:
  - [ ] `status == Defeated`
  - [ ] 찬성률 100%이지만 정족수(10%, 1,000표) 미달로 부결

### 시나리오 5.2: 정족수 충족 + 가결 (60% 이상) 확인
- **목적**: 정족수와 찬성률 동시 충족 시 가결 처리
- **사전 조건**: total_eligible_weight = 10,000. investor1 (1,000, 찬성) + investor2 (500, 반대). 투표 기간 경과.
- **서명자**: 누구나
- **Action**: `finalize_proposal` instruction 전송
- **Expected Result**:
  - [ ] 참여율 15% (1,500/10,000) >= 10% 정족수 충족
  - [ ] 찬성률 66.7% (1,000/1,500) >= 60% 가결 기준 충족
  - [ ] `status == Succeeded`

### 시나리오 5.3: 정족수 충족 + 부결 (60% 미만) 확인
- **목적**: 정족수는 충족하나 찬성률 부족 시 부결됨을 확인
- **사전 조건**: total_eligible_weight = 10,000. investor1 (1,000, 반대) + whale (캡 적용 1,000, 찬성) + investor2 (500, 반대). 투표 기간 경과.
- **서명자**: 누구나
- **Action**: `finalize_proposal` instruction 전송
- **Expected Result**:
  - [ ] 참여율 25% >= 10% 정족수 충족
  - [ ] 찬성률 40% (1,000/2,500) < 60% 가결 기준 미달
  - [ ] `status == Defeated`

### 시나리오 5.4: 투표 기간 중 finalize 시도 실패
- **목적**: 투표 기간이 아직 끝나지 않은 상태에서 finalize 불가
- **Action**: 투표 기간 내 `finalize_proposal` instruction 전송
- **Expected Result**:
  - [ ] `VotingNotEnded` 에러 반환

---

## 6. 투표 기간 경계값 (Voting Period Boundary)

### 시나리오 6.1: 투표 기간 내 정상 투표 확인
- **목적**: voting_starts_at <= now <= voting_ends_at 범위에서 투표 성공
- **Action**: 제안 생성 직후 `cast_vote` instruction 전송
- **Expected Result**:
  - [ ] 투표 성공 및 VoteRecord 생성

### 시나리오 6.2: 투표 기간 만료 후 투표 시도 실패
- **목적**: 투표 기간 종료 후 투표가 차단됨을 확인
- **사전 조건**: 테스트용 짧은 voting_period 설정 후 기간 경과
- **Action**: 기간 만료 후 `cast_vote` instruction 전송
- **Expected Result**:
  - [ ] `VotingEnded` 에러 반환

---

## 7. 제안 취소 (Cancel Proposal)

### 시나리오 7.1: 제안 생성자의 취소 성공
- **서명자**: `councilMember` (제안 생성자)
- **Action**: `cancel_proposal` instruction 전송
- **Expected Result**:
  - [ ] `status == Cancelled`

### 시나리오 7.2: authority의 비상 취소 성공
- **서명자**: `authority` (Squads multisig)
- **Action**: `cancel_proposal` instruction 전송
- **Expected Result**:
  - [ ] `status == Cancelled`

### 시나리오 7.3: 권한 없는 사용자의 취소 실패
- **서명자**: `investor1` (제안 생성자도, authority도 아님)
- **Action**: `cancel_proposal` instruction 전송
- **Expected Result**:
  - [ ] `Unauthorized` 에러 반환

### 시나리오 7.4: Voting 상태가 아닌 제안 취소 실패
- **사전 조건**: finalize로 Succeeded/Defeated 상태인 제안
- **Action**: `cancel_proposal` instruction 전송
- **Expected Result**:
  - [ ] `InvalidProposalStatus` 에러 반환

---

## 8. 멀티시그 비상 통제 (Multisig Emergency Control)

### 시나리오 8.1: Multisig를 통한 Council Token 재발급
- **목적**: 마을 대표 교체 시 Multisig로 신규 Council Token 발급
- **Action**:
  1. Squads에서 신규 지갑에 Council Token 민팅 트랜잭션 제안
  2. M-of-N 서명 완료 후 실행
- **Expected Result**:
  - [ ] 서명 미달 시 실행 불가
  - [ ] 서명 완료 후 신규 지갑 Council Token 잔액 1개
  - [ ] 단일 지갑 직접 민팅 여전히 실패

### 시나리오 8.2: Multisig를 통한 Treasury 자금 이동
- **목적**: 비상 시 Multisig가 Treasury 자금을 이동할 수 있음을 확인
- **Expected Result**:
  - [ ] M-of-N 서명 완료 후 자금 이동 성공
  - [ ] 서명 미달 시 실행 불가

---

## 9. 거버넌스/수익 배분 분리 검증 (Separation Verification)

### 시나리오 9.1: DAO 투표 결과가 배당 시스템에 영향 없음
- **목적**: 거버넌스와 수익 배분의 완전한 분리 확인
- **사전 조건**: DAO 제안 가결 (시나리오 5.2) 완료
- **Action**: RWA 프로그램의 PropertyToken, InvestorPosition, USDC vault 상태 조회
- **Expected Result**:
  - [ ] 배당 비율/잔액/수령 가능 금액이 DAO 가결 전과 동일
  - [ ] DAO 프로그램과 RWA 프로그램 사이에 공유 PDA 없음

---

## 10. 클라이언트(UI) 연동 검증 (Client Integration)

### 시나리오 10.1: 거버넌스 탭 진입 및 상태 분기
- **목적**: 지갑 상태에 따른 UI 분기 확인
- **Action**: `/invest/:id/governance` 페이지 진입
- **Expected Result**:
  - [ ] (지갑 미연결) "지갑을 연결하세요" 표시
  - [ ] (RWA 미보유) "투표권이 없습니다" + 투자 유도 표시
  - [ ] (RWA 보유) 제안 목록 + 투표권 표시
  - [ ] (Council Token 보유) "제안 생성" 버튼 활성화

### 시나리오 10.2: 투표 UI 플로우
- **목적**: 찬성/반대/기권 투표 전체 플로우 정상 작동
- **Action**: 활성 제안에서 찬성 투표 버튼 클릭 → 확인 → 트랜잭션 서명
- **Expected Result**:
  - [ ] 트랜잭션 성공 후 투표 현황 업데이트
  - [ ] 이미 투표한 제안에서 투표 버튼 비활성화
  - [ ] 투표권 표시: "나의 투표권: X / 캡 적용: Y"

---

## 11. Related Documents

- **기획서**: [09_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/09_DAO_GOVERNANCE_PLAN.md) — DAO 기획
- **구현 명세**: [08_DAO_IMPLEMENTATION_SPEC.md](../03_Technical_Specs/08_DAO_IMPLEMENTATION_SPEC.md) — Custom Anchor DAO 구현 명세
- **투표 방어 로직**: [11_DAO_VOTING_DEFENSE_LOGIC.md](../01_Concept_Design/11_DAO_VOTING_DEFENSE_LOGIC.md) — 10% 캡, Sybil 방어
- **Archive**: [07_DAO_TEST_SCENARIOS_REALMS.md](../00_ARCHIVE/07_DAO_TEST_SCENARIOS_REALMS.md) — 이전 Realms 기반 테스트 시나리오
