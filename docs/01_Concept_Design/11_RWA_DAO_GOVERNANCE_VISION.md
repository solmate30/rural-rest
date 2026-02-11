# 11. RWA DAO Governance Vision
> Created: 2026-02-11 00:10
> Last Updated: 2026-02-11 00:10

## 1. Overview
'Rural Rest'의 RWA(Real World Asset) 투자는 단순한 수익 창출을 넘어, 투자자가 지역 사회의 의사결정에 참여하고 마을의 성장을 함께 이끄는 **DAO(탈중앙화 자율 조직) 기반 거버넌스**를 지향합니다. 본 문서는 공정한 투표 시스템, 지속 가능한 보상 체계, 그리고 마을 주민과의 상생 구조를 정의합니다.

## 2. 거버넌스 모델 (Governance Model)

### 2.1. 투표 방식: Quadratic Voting (제곱 투표)
자산 규모가 큰 특정 '고래'가 의사결정을 독점하는 것을 방지하고, 특정 안건에 대해 강력한 의지를 가진 소수 의견을 존중하기 위해 **Quadratic Voting(QV)** 방식을 도입합니다.

*   **원칙**: 투표권 행사 시 비용(Voice Credits)이 투표 수의 제곱에 비례하여 증가합니다.
    - 1표 = 1 Credit
    - 2표 = 4 Credits
    - 3표 = 9 Credits
    - 10표 = 100 Credits
*   **효과**: 
    - 자금력이 부족하더라도 특정 지역 숙소의 보존에 대해 강한 열망을 가진 투자자 집단이 의사결정에 영향력을 미칠 수 있음.
    - 고래 한 명이 전체 방향을 좌지우지하는 탈중앙화의 역설 해결.
*   **Voice Credit 획득**: 보유한 RWA 토큰 수와 보유 기간(Time-weighted)을 결합하여 정기적으로 배부.

### 2.2. 주요 의사결정 범위
*   **숙소 셀렉션**: 잠재적인 빈집 후보 중 우선적으로 리모델링할 대상지 선정.
*   **브랜드 가이드라인**: 특정 마을의 숙소들이 지향할 건축 전문성 및 서비스 테마 결정.
*   **기금 운용**: 수익금 중 '마을 발전 기금(Local Impact Fund)'으로 전환할 비율 결정.

## 3. 보상 체계 (Reward System)

### 3.1. 경제적 보상 (Financial Rewards)
*   **직접 배당**: 숙박 순수익의 67%를 토큰 보유 비율에 따라 USDC로 배당 (매월 실행).
*   **거버넌스 참여 보상**: 투표에 참여하거나 제안서를 제출하여 승인된 멤버에게 'Eco-Points' 또는 추가 거버넌스 토큰 지급.

### 3.2. 유틸리티 보상 (Utility Perks)
*   **공동 주인 혜택**: 보유한 토큰에 해당하는 숙소 예약 시 10~20% 할인을 제공하여 '내 집'과 같은 소속감 부여.
*   **우선 예약권**: 성수기 또는 한정판 테마 기간에 대한 우선 예약 슬롯 제공.
*   **NFT 배지**: 거버넌스 활동 이력을 기록한 SBT(Soulbound Token) 발행으로 커뮤니티 내 평판(Reputation) 구축.

## 4. 마을 주민과의 상생 구조 (Village Co-existence)

DAO는 단순히 외부 투자자만의 조직이 아니라, **마을 주민이 핵심 구성원으로 참여**하는 Win-Win 구조를 설계합니다.

### 4.1. 마을 발전 기금 (Local Impact Fund)
*   **적립**: 전체 매출의 3~5%를 마을 발전 기금으로 고정 할당.
*   **사용**: 마을 전체의 공공 인프라(가로등 설치, 마을회관 수리, 농업 용수 관리 등) 개선에 투입.
*   **결정**: 투자자 DAO와 마을 대표가 함께 참여하는 '마을 공동 거버넌스'에서 결정.

### 4.2. 일자리 창출 및 로컬 비즈니스 연동
*   **우선 고용 정책**: 숙소 청소, 관리, 조식 서비스 등 운영에 있어 마을 주민을 최우선 고용하고 공정한 임금 지급.
*   **로컬 제품 큐레이션**: 각 숙소 내에 마을 특산품(차, 공예품, 가공식품 등)을 전시 및 AI 컨시어지를 통해 홍보하여 마을 수익 증대.

### 4.3. 주민 거버넌스 참여 (Resident Incentives)
*   **주민 전담 지분**: 토큰 발행 시 일부(예: 5%)를 마을 공동체(또는 사회적 협동조합)에 무상으로 출연하여 주민들이 직접 임대 수익의 결실을 나누도록 함.
*   **거부권(Veto Rights)**: 마을의 정체성을 훼손하거나 주민들의 삶의 질을 현저히 낮추는 결정에 대해서는 마을 대표단에게 제한적인 거부권 부여.

## 5. 기술적 구현 방향 (Technical Implementation)
*   **Solana 기반 DAO**: Realms 등의 솔라나 DAO 툴킷을 활용하여 투명한 온체인 투표 및 제안 관리.
*   **스마트 컨트랙트 배당**: 오라클 데이터를 기반으로 매출 확정 시 자동으로 마을 기금과 투자자 지갑으로 수익 분배.

## 6. Related Documents
- **Concept_Design**: [Vision Core](./01_VISION_CORE.md) - 프로젝트 전체 비전
- **Concept_Design**: [Blockchain Vision](./08_BLOCKCHAIN_VISION.md) - RWA 및 블록체인 도입 전략
- **Concept_Design**: [AI & IoT Managed Infra](./10_AI_IOT_INFRA_VISION.md) - 자율 운영 인프라 비전
- **Logic_Progress**: [RWA Tokenization Logic](../04_Logic_Progress/12_RWA_TOKENIZATION_LOGIC.md) - 데이터 기반 배당 알고리즘 상세
- **Technical_Specs**: [Blockchain Infra Spec](../03_Technical_Specs/08_BLOCKCHAIN_INFRA_SPEC.md) - 온체인 거버넌스 인프라 기반
