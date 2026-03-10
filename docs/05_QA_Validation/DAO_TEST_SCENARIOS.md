# DAO & Governance QA Test Scenarios

> Created: 2026-03-10 03:00
> Last Updated: 2026-03-10 04:00

본 문서는 `13_DAO_IMPLEMENTATION_SPEC.md` 및 `18_DAO_GOVERNANCE_PLAN.md`에 정의된 Rural Rest 단일 DAO의 1단계를 검증하기 위한 통합 및 E2E(End-to-End) 테스트 시나리오를 정의한다.

---

## 1. 테스트 환경 및 준비 (Prerequisites)

- **네트워크**: Solana Devnet
- **테스트 지갑 구성**:
  - `Wallet A` (운영자 / Multisig 멤버 1)
  - `Wallet B` (마을 대표 / Council Token 보유, Multisig 멤버 2)
  - `Wallet C` (투자자 1 / RWA 1,000 보유)
  - `Wallet D` (투자자 2 / RWA 500 보유, 투표 기간 중 추가 매수)
- **초기 상태 (Mocks)**: 
  - 단위 RWA Token Mint 배포 완료
  - Council Token Mint 배포 완료
  - Squads Multisig (M-of-N) 셋업 및 자금(SOL) 조달 완료

---

## 2. 셋업 및 초기화 검증 (Setup & Initialization Validation)

### 시나리오 2.1: Realms DAO (Realm) 생성 및 파라미터 검증
- **목적**: DAO 생성 시 Community Mint(RWA)와 Council Mint가 올바르게 매핑되었는지 확인
- **사전 조건**: 권한 있는 운영자 지갑(`Wallet A`) 연결
- **Action**: Realm 초기화 트랜잭션 전송 및 파라미터 등록
- **Expected Result (완료 조건)**:
  - [ ] `minCommunityTokensToCreateProposal` 값이 `u64::MAX` (혹은 제안 불가능한 높은 값)으로 설정됨을 데이터 구동 코드에서 확인
  - [ ] `minCouncilTokensToCreateProposal` 값이 `1`로 설정됨을 확인
  - [ ] `voteThresholdPercentage`가 `60%`, `communityVoteThreshold`(Quorum)가 `10%`로 설정되었는지 온체인 데이터로 조회 성공

### 시나리오 2.2: 멀티시그(Squads) 권한 인계 (Authority Transfer)
- **목적**: Council Token의 Mint Authority가 Multisig로 정상적이고 안전하게 이전되었는지 확인
- **사전 조건**: Council Token Mint 배포 완료
- **Action**: Mint Authority를 Multisig 주소로 이전하는 트랜잭션 서명 (Squad SDK 활용)
- **Expected Result**:
  - [ ] 단일 지갑(`Wallet A`)에서 Council Token 추가 민팅 시도 시 에러 발생 (권한 없음)
  - [ ] Multisig 제안을 통해 `Wallet B`(마을 대표)에게 Council Token 1개 민팅 트랜잭션 성공

### 시나리오 2.3: Council Token 양도 불가(Non-transferable) 검증
- **목적**: Council Token이 타 지갑으로 이전되지 않음을 확인하여 제안 생성 권한 남용 방지
- **사전 조건**: `Wallet B` (Council Token 1개 보유) 연결
- **Action**: `Wallet B`에서 `Wallet C`로 Council Token 전송 트랜잭션 전송
- **Expected Result**:
  - [ ] 트랜잭션 실패 및 Transfer Frozen 에러 반환 확인
  - [ ] `Wallet C`의 Council Token 잔액이 0으로 유지됨

---

## 3. 권한 및 제안 생성 (Proposal Creation)

### 시나리오 3.1: 투자자(RWA Holder)의 제안 생성 실패 확인 (Security)
- **목적**: Council Token이 없는 일반 RWA 보유자가 제안을 임의 생성하여 스팸화하는 것을 방지
- **사전 조건**: `Wallet C` (RWA 1,000개 보유, Council Token 0개) 연결
- **Action**: 신규 제안(Proposal) 등록 트랜잭션 전송
- **Expected Result**:
  - [ ] 트랜잭션 실패 및 권한 부족(Unauthorized 또는 Threshold Not Met) 에러 반환 확인
  - [ ] 웹 UI 상에서 "제안 생성" 버튼이 비활성화(Disabled) 상태이거나 노출되지 않음을 확인

### 시나리오 3.2: 마을 대표(Council Token Holder)의 제안 생성 성공
- **목적**: Council Token 1개를 보유한 지정 대표자가 플랫폼 전체 규약에 대한 제안을 생성할 수 있음을 검증
- **사전 조건**: `Wallet B` (Council Token 1개 보유) 연결
- **Action**: "전체 숙소 운영 기초 규칙 개정" 제안서 작성 후 트랜잭션 전송
- **Expected Result**:
  - [ ] 트랜잭션 성공 및 제안(Proposal)이 DAO 프로그램 내에 정상 등록됨
  - [ ] 제안 상태가 "투표 진행 중(Voting)" 코어 상태로 진입 확인

### 시나리오 3.3: 마을 대표 제안 생성 버튼 활성화 확인 (Positive Case)
- **목적**: Council Token 보유자에게 제안 생성 UI가 정상 활성화되는지 확인 (3.1의 비활성화와 대응)
- **사전 조건**: `Wallet B` (Council Token 1개 보유) 연결 후 `/invest/{id}/governance` 진입
- **Action**: 거버넌스 탭 UI 렌더링 확인
- **Expected Result**:
  - [ ] \"제안 생성\" 버튼이 활성화(Enabled) 상태로 노출됨
  - [ ] 제안 작성 폼 진입 가능

---

## 4. 투표 권한 및 스냅샷 매커니즘 (Voting & Snapshot)

### 시나리오 4.1: 투표권 1:1 매핑 확인
- **목적**: RWA 보유량이 투표권(Weight)과 정확히 1:1 일치하여 행사되는지 확인
- **사전 조건**: 3.2에서 생성된 제안 활성화 단계
- **Action**: `Wallet C`로 찬성 투표(Cast Vote) 트랜잭션 전송
- **Expected Result**:
  - [ ] 투표 성공 및 해당 제안의 찬성 투표수에 `1,000` 토큰 단위 가중치가 온체인에 누적됨 확인

### 시나리오 4.2: 스냅샷 고정 검증 (장부 조작 방지) [핵심]
- **목적**: 투표 기간 중 추가 RWA 투기성 매수/양도를 하더라도 기존 등록된 제안의 투표권은 증가하지 않음을 증명
- **사전 조건**: `Wallet D` (제안 생성 시점 RWA 500개 보유) 연결
- **Action**: 
  1. `Wallet D`가 외부로부터 RWA 500개를 추가 전송받음 (현재 총 잔액 1,000개)
  2. 해당 제안에 대해 투표 트랜잭션 전송 (`Wallet D` -> 찬성)
- **Expected Result**:
  - [ ] 실제 토큰 잔액은 1,000개이나, 투표 가중치는 제안 스냅샷 시점의 **500개** 가중치로만 안전하게 반영됨 확인
  - [ ] UI에서 "제안 당시 보유량: 500 / 현재 보유량: 1,000" 형태로 징크스를 줄이는 명확한 피드백 표시

---

## 5. 결론 및 상태 변화 (Resolution & Thresholds)

### 시나리오 5.1: 정족수(Quorum) 미달 시 부결 처리
- **목적**: 투표 기간 만료 시 참여율이 총 유통량의 10% 미만일 경우, 비율과 무관하게 제안이 부결됨을 확인
- **사전 조건**: 총 10,000 RWA 유통. `Wallet D` (500 RWA, 5%) 단독 찬성 투표. 지정 투표 기간 경과.
- **Action**: 기간 만료 후 결과 확정(Finalize) 트랜잭션 전송
- **Expected Result**:
  - [ ] 제안 상태가 "Defeated (부결)"로 변경됨
  - [ ] 가결률(100%)을 만족하더라도 정족수(10%, 1,000표) 미달로 인한 부결임을 알리는 로그/상태 확인

### 시나리오 5.2: 정족수 충족 및 가결(60% 이상) 확인
- **목적**: 정족수(10% 이상)와 찬성률(60% 이상) 동시 만족 시 규약 가결 처리
- **사전 조건**: 총 10,000 RWA 유통. `Wallet C`(찬성 1,000표, 10%) 투표 완료 후 기간 만료
- **Action**: 결과 확정(Finalize) 트랜잭션 전송
- **Expected Result**:
  - [ ] 투표 참여율 10%(1,000/10,000) 달성 확보 확인
  - [ ] 찬성률 100% (>60% 조건 초과) 달성 상황에서 제안 상태가 "Succeeded (가결)"로 기록됨

---

## 6. 클라이언트(UI) 연동 검증 (Client Integration)

### 시나리오 6.1: 거버넌스 UX/UI 정상 진입 및 상태 대응
- **목적**: 글로벌 방문자나 일반 사용자가 아닌 "RWA 보유자"를 중심으로 한 일관성 있는 투명한 노출
- **사전 조건**: 사용자 브라우저 접속 (각기 다른 지갑 연결 상태 준비)
- **Action**: `/invest/{id}` 상세 페이지 방문 후 [거버넌스] 탭 클릭
- **Expected Result**:
  - [ ] (공통) 404 에러나 White Screen 없이 거버넌스 탭이 렌더링됨
  - [ ] (`Wallet C`) 현재 사용자의 RWA 보유량 및 참여 가능한 활성 안건 숫자가 명확히 출력됨
  - [ ] (신규 사용자 방방객) "해당 프로젝트의 거버넌스 투표권(RWA)을 보유하고 있지 않습니다." 텍스트와 함께 **Empty State UI(깨짐 없음)** 표기 및 투자 유도 동선 제공

---

## 7. 투표 기간 경계값 (Voting Period Boundary)

### 시나리오 7.1: 투표 기간 만료 전 정상 투표 확인
- **목적**: 기본 투표 기간(7일, 604800초) 이내에 투표가 정상 처리됨을 확인
- **사전 조건**: 제안 생성 직후 (`Wallet C`) 연결
- **Action**: 제안 생성 후 1분 이내에 찬성 투표 트랜잭션 전송
- **Expected Result**:
  - [ ] 투표 트랜잭션 성공 및 찬성 가중치 온체인 누적 확인

### 시나리오 7.2: 투표 기간 만료 후 투표 시도 실패 확인
- **목적**: 투표 기간이 만료된 제안에 대해 투표가 차단됨을 확인
- **사전 조건**: Devnet에서 `maxVotingTime`을 짧게 설정한 테스트용 제안 생성 후 기간 경과
- **Action**: 기간 만료 후 `Wallet C`로 투표 트랜잭션 전송
- **Expected Result**:
  - [ ] 트랜잭션 실패 및 Voting Period Ended 에러 반환 확인
  - [ ] UI에서 \"투표 기간 종료\" 상태 표시 및 투표 버튼 비활성화 확인

---

## 8. 멀티시그 비상 통제 (Multisig Emergency Control)

### 시나리오 8.1: Multisig를 통한 Council Token 재발급 (대표 교체)
- **목적**: 마을 대표 교체 시 Multisig 제안을 통해 신규 Council Token을 발급하고 구 토큰을 회수할 수 있음을 검증
- **사전 조건**: Squads Multisig 셋업 완료, `Wallet B` (구 대표), `Wallet E` (신규 대표, 별도 테스트 지갑)
- **Action**:
  1. Squads에서 \"신규 Council Token 민팅 → Wallet E\" 트랜잭션 제안 생성
  2. M-of-N 서명자 중 필요 수 이상이 서명 완료
  3. 트랜잭션 실행
- **Expected Result**:
  - [ ] M-of-N 서명 미달 상태에서는 트랜잭션 실행 불가 확인
  - [ ] 서명 완료 후 `Wallet E` Council Token 잔액 1개 증가 확인
  - [ ] 단일 지갑(`Wallet A`)에서 직접 민팅 시도 시 여전히 실패 확인 (Authority 유지)

### 시나리오 8.2: Multisig를 통한 Treasury 자금 이동
- **목적**: 비상 상황 시 Multisig가 DAO Treasury 자금을 안전하게 이동할 수 있음을 검증
- **사전 조건**: DAO Treasury 계정에 테스트용 SOL 잔액 존재
- **Action**: Squads에서 Treasury → 지정 주소 SOL 전송 트랜잭션 제안 및 M-of-N 서명 완료 후 실행
- **Expected Result**:
  - [ ] M-of-N 서명 완료 후 Treasury 잔액 감소 및 수신 주소 잔액 증가 확인
  - [ ] 서명 미달 시 실행 불가 확인

---

## 9. 거버넌스·수익 배분 분리 검증 (Separation Verification)

### 시나리오 9.1: DAO 투표 결과가 배당 시스템에 영향을 미치지 않음을 확인
- **목적**: 거버넌스와 수익 배분이 완전히 분리되어 있음을 검증 (`13_DAO_IMPLEMENTATION_SPEC.md` Section 5 기준)
- **사전 조건**: DAO 제안 가결 처리 완료 (시나리오 5.2 이후 상태), 배당 풀 프로그램 별도 배포
- **Action**: 가결된 DAO 제안 실행 트랜잭션 전송 후, 배당 풀 프로그램의 상태(State) 조회
- **Expected Result**:
  - [ ] 배당 풀 프로그램의 배당 비율·잔액·수령 가능 금액이 DAO 투표 결과와 무관하게 변경되지 않음 확인
  - [ ] DAO 프로그램과 배당 풀 프로그램 사이에 공유 상태(Shared Account)가 존재하지 않음을 온체인 계정 구조로 확인

---

## 10. Related Documents

- **Concept_Design**: [18_DAO_GOVERNANCE_PLAN.md](../01_Concept_Design/18_DAO_GOVERNANCE_PLAN.md) - DAO 기획서
- **Technical_Specs**: [13_DAO_IMPLEMENTATION_SPEC.md](../03_Technical_Specs/13_DAO_IMPLEMENTATION_SPEC.md) - DAO 구현 명세서
