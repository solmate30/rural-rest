# Rural Rest - Pitch Deck (3-Minute Storytelling)
> Created: 2026-02-08 00:00
> Last Updated: 2026-02-11 23:30

본 문서는 **365 Principle** (3 Investor Lenses, 6 Rubrics, 5 Documentation Layers) 및 문서 스킬의 Phase 2(Business Model), Phase 3(Pitch & Strategy) 원칙에 따라 작성된 투자·경쟁 제출용 피치 요약이다. 3분 내 팀/문제/타겟/비전/검증을 전달할 수 있도록 구성하였다.

---

## 1. One-Liner (Hook)

**"빈집을 글로벌 핫플레이스로, Local Hosts를 Smart Nodes로."**  
Rural Rest는 한국 농촌의 빈집을 리모델링해 글로벌 여행자에게 ‘진짜 한국’ 경험을 제공하는 프리미엄 예약 플랫폼이며, AI·IoT 기반 자율 운영 인프라(**localhost**)로 확장 가능한 숙박·경험 생태계를 지향한다.

---

## 2. Problem & Opportunity (The "Why Now")

| 구분 | 내용 |
|-----|------|
| **문제 1** | 글로벌 여행자는 서울/부산 관광에 피로하고 "Real Korea"를 원하나, 시골 정보·교통·언어 장벽으로 접근이 어렵다. |
| **문제 2** | 농촌 빈집은 방치되어 흉물이 되고, 문화 자산으로서의 가치가 사라진다. |
| **기회** | 빈집 재생 + 진정성 있는 시골 숙박·체험 수요가 맞닿아 있으며, AI·IoT로 무인·자율 운영이 가능해져 단위 경제가 개선된다. |

**TAM -> SAM -> SOM**

| 단계 | 규모 | 산출 근거 |
|:---|:---|:---|
| **TAM** | 빈집 약 151만 채 (2024 행안부 통계) | 전국 농촌·읍면 지역 빈집 전체. 글로벌 농촌 체험 숙박 시장 연 $12B+ 성장 추세. |
| **SAM** | 약 8,000~15,000채 | 관광 접근성(KTX 2시간 내), 리모델링 가능 구조, 지자체 재생 사업 대상 지역(전남 순천·담양, 경북 안동·영주, 강원 원주·횡성, 제주 중산간) 내 빈집. |
| **SOM** | Year 1: 5개 노드 / Year 2: 50개 노드 | 파일럿: 2~3개 권역(전남·경북)에서 지자체 협약 기반 직접 계약. Year 2: 검증된 모델 복제로 10개 권역 확장. |

---

## 3. Solution & Product (What We Do)

- **커머스**: 빈집 리모델링 숙소(한옥·농가·모던) 큐레이션, 예약·결제(다중 통화, PayPal/Stripe/네이버·카카오페이), 액티비티·교통 애드온.
- **경험**: "Local Connect" 프로그램(불멍, 김치 담그기, 마을 투어), AI 글로벌 컨시어지(교통·예약·정보), 자동 번역 채팅.
- **인프라**: **localhost** — 노드 식별체계(`localhost://0001`), AI 하우스 매니저(디지털 키·웰컴 시나리오), (Phase 2+) Edge AI CCTV·예측 정비, OpenClaw 스타일 IoT 통합.

**MVP 범위**  
- 파일럿 숙소 5개 오픈, 검색·상세·예약·결제 플로우, 호스트 대시보드, AI 컨시어지(교통·정보), 자동 번역 채팅.

---

## 4. Global Rubric (6 Core Criteria) — 승리 전략 매핑

문서 스킬 원칙: 6개 루브릭 중 **최소 4개 이상**을 승리 전략으로 명시한다.

| # | 기준 (Criterion) | Rural Rest 대응 (승리 전략) |
|:-:|------------------|----------------------------|
| 1 | **Functionality** (실제 작동·코드 품질) | 풀스택 구현 완료(React Router 7 + Turso DB + Better Auth). 구현 항목: 검색·필터링, 숙소 상세, 예약 플로우, 호스트 대시보드, AI 컨시어지(LangGraph 5-node), 자동 번역 채팅. Demo: `[TBD - 데모 URL 입력]` |
| 2 | **Potential Impact** (TAM·생태계 기여) | 빈집 150만 채 + 글로벌/국내 시골 수요. 지자체·마을 협력으로 독점 인벤토리 확보, 재방문율·외국인 예약 비중 KPI. |
| 3 | **Novelty** (참신함·차별점) | 빈집 전용 큐레이션, localhost 노드 브랜딩, "숙박만"이 아닌 교통·체험·커뮤니티 통합 여정. AI·IoT 무인 운영으로 비용·규모 확장성. |
| 4 | **UX** (체감 성능·반응성) | 다국어·자동번역, AI 컨시어지(빠른 응답), 다중 통화·원클릭 결제, 디지털 키·웰컴 시나리오로 "무인 ≠ 무관심" 경험. |
| 5 | **Open-source / Composability** | OpenClaw 스타일 IoT·표준 프로토콜(MQTT 등) 지향, 문서화된 5-Layer 스펙·API로 다른 빌더/에이전트 연동 가능. |
| 6 | **Business Plan** (수익·지속성) | 수수료(예약 10–15%), 체험·교통 애드온 마진, 컨시어지 수수료. 장기: RWA·블록체인 연동 시 운영 효율화로 수익률 개선(법적 검토 선행). |

**요약**: Functionality(MVP), Potential Impact(TAM·빈집), Novelty(통합 여정·localhost), UX(다국어·AI·무인 경험), Business Plan(수수료·애드온) 5개를 명시적 승리 전략으로 강조 가능.

---

## 5. Unit Economics (노드 1개 기준 월간 시뮬레이션)

> 아래 수치는 한국 농촌 체험 숙박 시장 데이터 기반 합리적 가정이다. 파일럿 운영 후 실측치로 교체한다.

### 5.1. 매출 구조

| 항목 | 가정 | 금액 (KRW) |
|:---|:---|---:|
| 1박 평균 단가 (ADR) | 한옥·리모델링 농가 기준 | 150,000 |
| 월 평균 예약일수 | 가동률 50% (비수기 포함) | 15일 |
| **월 숙박 매출 (GMV)** | 150,000 x 15 | **2,250,000** |
| 체험·교통 애드온 | 게스트 30%가 평균 35,000원 구매 | 157,500 |
| **노드 총 GMV** | | **2,407,500** |

### 5.2. 플랫폼 수익

| 수익원 | 요율 | 월 수익 (KRW) |
|:---|:---|---:|
| 숙박 수수료 | GMV의 12% | 270,000 |
| 애드온 마진 | 애드온 매출의 25% | 39,375 |
| AI 컨시어지 수수료 | 건당 500원 x 월 20건 | 10,000 |
| **노드당 플랫폼 월 수익** | | **319,375** |

### 5.3. 플랫폼 운영 비용 (노드당 배분)

| 항목 | 월 비용 (KRW) |
|:---|---:|
| 인프라 (서버·DB·AI API) | 60,000 |
| 결제 수수료 (PG 3.5%) | 78,750 |
| CS·운영 지원 (배분) | 30,000 |
| **노드당 플랫폼 월 비용** | **168,750** |

### 5.4. 손익 요약

| 지표 | 값 |
|:---|:---|
| **노드당 월 순이익** | 150,625 KRW |
| **노드당 월 마진율** | 47.2% |
| **파일럿 5노드 월 순이익** | 753,125 KRW |
| **손익분기 가동률** | 약 27% (월 8일 예약) |
| **Year 2 (50노드) 연 순이익 전망** | 약 90M KRW |

> **핵심 메시지**: 가동률 27%만 넘으면 흑자. AI·IoT로 무인 운영 비율이 올라갈수록 CS·운영 비용 하락 -> 마진율 개선.

---

## 6. Business Model Deep-Dive (Phase 2 대응)

### 6.1. User Spending Path (Moment of Truth)

- **결정적 순간**: "이 숙소 + 이 체험 + 교통까지 한 번에 결제한다"는 결심.
- **경로**: 검색 -> 상세(스토리·사진·체험 목록) -> 날짜/객실 선택 -> 애드온(불멍 키트, 셔틀) -> 결제(다중 통화·간편 결제).
- **보호**: 결제 레일(PayPal/Stripe 등) 분리, 개인정보 최소 수집·동의 흐름 명시.

### 6.2. Privacy as TAM Expander

- 게스트가 "진실된 리뷰·이야기"를 남기려면 신뢰가 필요.
- AI·IoT 운영 시 CCTV·센서 범위·보관 기간을 사전 고지·동의하고, "사람이 상시 영상을 보지 않고 AI가 이벤트 시에만 활용"하는 구조를 원칙으로 하여 프라이버시를 TAM 확장 요소로 활용.

### 6.3. Company-like Infrastructure

- **localhost** 노드 체계로 단일 숙소가 아닌 "네트워크"로 관리.
- 향후: 다른 빌더·에이전트가 예약·결제·IoT 이벤트에 연동할 수 있는 API·프로토콜 설계(Open-source/Composability와 연결).

### 6.4. Action-to-Transaction Flow

- 검색·상세·날짜 선택이 곧바로 "예약 가능·가격 표시"로 이어지고, 애드온 선택 후 결제까지 단일 플로우.
- 고속·저수수료 결제망 활용으로 해외 게스트 결제 허들 최소화.

### 6.5. Technical Necessity ("Why This Stack?")

- **AI 컨시어지**: LangGraph + Gemini 2.0 Flash -- 복잡한 대화·교통·예약 도움에 상태 유지·멀티모달이 필수.
- **IoT/무인 운영**: 농촌 저대역·순단 환경을 전제로 엣지 캐시·로컬 제어로 출입·알림은 유지, 복구 후 동기화.
- **다국어·번역**: 글로벌 게스트 확보에 필수이므로 번역 API·UX가 핵심 기능.

---

## 7. Traction & Validation (현재)

- **단계**: 파일럿 준비 단계.  
- **목표 지표**: 파일럿 숙소 5개 오픈, 재방문율·외국인 예약 비중·NPS 측정.  
- **검증 포인트**: "빈집 재생률", "호스트 물리적 출동 감소율"(AI·IoT 도입 시), "디지털 키 체크인 성공률".

---

## 8. Long-Term Vision vs. Incremental Execution (Phase 3)

- **지금**: "한 곳에서 끝내주게 작동하는 한 가지 경로" — 예약부터 체크인·체험까지 원스톱.  
- **6개월**: 파일럿 5개 노드 안정화, AI 컨시어지·번역·디지털 키 검증.  
- **1–2년**: 전국 100개 마을 네트워크, Edge AI·CCTV·예측 정비 단계적 도입.  
- **2년+**: IoT 로그 온체인·RWA 연동(법적 검토 후), 다른 빌더·에이전트가 플랫폼 위에서 활동하는 생태계.

---

## 9. Aesthetics & First Impression ("있어보이니즘")

- **비주얼**: 빈집 외관(빈티지)·내부(현대적) 대비, 에디토리얼 스타일 상세 페이지, 시즌·카테고리 큐레이션.  
- **톤**: "투박함·정겨움·뜻밖의 환대" — 대량 숙박이 아닌 소규모 노드·스토리 중심.  
- **완성도**: 반응형 웹, 명확한 CTA, 다국어·다중 통화로 첫 인상에서 "글로벌·프리미엄" 인지.

---

## 10. The 3 Investor Lenses (Scale & Moat)

| 렌즈 | 질문 | Rural Rest 대응 |
|------|------|-----------------|
| **Leverage** | 커질 때 생태계도 함께 커지는가? | 지자체·마을 협력으로 인벤토리 확대 → 더 많은 빈집 재생 → 지역 활성화·스토리 증가 → 재방문·입소문. AI·IoT로 노드당 운영 비용 하락 시 확장성 증가. |
| **Realistic Money Flow** | "어떻게 돈 벌어?" | 노드당 월 순이익 15만원(마진 47%), 손익분기 가동률 27%. 수익원: 숙박 수수료 12% + 애드온 마진 25% + 컨시어지 건당 수수료. 단일 문장: "예약·체험·교통에서 수수료와 마진으로 수익, 가동률 27%에 흑자." |
| **Defensibility** | 시간이 갈수록 따라오기 힘든 해자? | 독점 인벤토리(지자체·마을 직접 계약), localhost 브랜드·노드 네트워크, AI·IoT·다국어 통합 여정 데이터와 운영 노하우. |

---

## 11. The Future Weapon (6–18 Months)

- **6개월**: 파일럿 5노드 수익·만족도 검증, AI 컨시어지·디지털 키 일상화.  
- **12개월**: Edge AI CCTV·이상 감지, 호스트 출동 50% 감소 목표.  
- **18개월**: OpenClaw 스타일 IoT·예측 정비, 100개 노드 네트워크 초입.  
- **무기**: "한국 농촌 = Rural Rest + localhost" 인식 고착화, 해외 유입 채널(파트너·콘텐츠)과 결합.

---

## 12. Pitch Readiness Checklist (3-Minute Story)

- [ ] **팀**: 누가 왜 이 문제를 풀 수 있는지 1문장.  
- [ ] **문제**: 빈집 방치 + 글로벌 "Real Korea" 수요 불일치.  
- [ ] **타겟**: 글로벌 여행자, 디지털 노마드, 국내 촌캉스.  
- [ ] **비전**: 빈집 재생 + localhost 네트워크 + AI·IoT 자율 운영.  
- [ ] **검증**: 파일럿 5개, 재방문율·외국인 비중·NPS.  
- [ ] **Unit Economics**: 노드당 손익 시뮬레이션 포함, 손익분기 가동률 27% 명시.
- [ ] **6대 루브릭**: 위 5개(Functionality, Impact, Novelty, UX, Business Plan) 승리 전략으로 포함됨.

---

## 13. Related Documents

### Concept_Design (같은 레이어)
- **Concept_Design**: [Site Overview](./00_SITE_OVERVIEW.md) - 사이트 비전 및 현재 아키텍처
- **Concept_Design**: [Vision & Core Values](./01_VISION_CORE.md) - 프로젝트 정체성 및 미션
- **Concept_Design**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 수익 구조 (Unit Economics 근거)
- **Concept_Design**: [Product Specs](./03_PRODUCT_SPECS.md) - MVP 기능 명세 및 사이트맵
- **Concept_Design**: [Roadmap](./04_ROADMAP.md) - 단계별 실행 전략 (Section 7, 8 타임라인 근거)
- **Concept_Design**: [Admin Strategy](./06_ADMIN_STRATEGY.md) - 호스트 운영 및 수익 구조
- **Concept_Design**: [Happy Path Scenarios](./07_HAPPY_PATH_SCENARIOS.md) - 핵심 사용자 여정
- **Concept_Design**: [AI & IoT Infra Vision](./10_AI_IOT_INFRA_VISION.md) - 자율 운영 인프라 및 OpenClaw
- **Concept_Design**: [RWA & DAO Governance Vision](./11_RWA_DAO_GOVERNANCE_VISION.md) - 블록체인·RWA 장기 비전
- **Concept_Design**: [Guest Acquisition Channels](./13_GUEST_ACQUISITION_CHANNELS.md) - 글로벌 투숙객 유치 채널 및 실행 우선순위

### Technical_Specs (기술 구현 근거)
- **Technical_Specs**: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - bookings·listings 테이블 구조 (Unit Economics 데이터 모델)
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - 예약·결제 API 엔드포인트
- **Technical_Specs**: [AI Concierge Spec](../03_Technical_Specs/04_AI_CONCIERGE_SPEC.md) - LangGraph 5-node 아키텍처 (Section 6.5 근거)

### Logic_Progress (비즈니스 로직)
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - 현재 개발 진행 상태
- **Logic_Progress**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 (수수료 정산 로직)
- **Logic_Progress**: [AI Concierge Logic](../04_Logic_Progress/08_AI_CONCIERGE_LOGIC.md) - AI 컨시어지 비즈니스 로직

### QA_Validation (검증)
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - MVP 기능 테스트 시나리오
- **QA_Validation**: [QA Checklist](../05_QA_Validation/02_QA_CHECKLIST.md) - 릴리스 기준 체크리스트
