# Test Plan: AI Global Concierge
> Created: 2026-02-08 04:02
> Last Updated: 2026-02-10 15:00

## 1. Test Objectives
AI 컨시어지의 5노드 그래프(router -> experts -> synthesizer)가 의도 분류 기반으로 올바른 전문가를 활성화하고, 도구 호출 결과를 통합하여 정확한 응답을 생성하는지 검증합니다.

## 2. Test Scenarios (User Journey)

### SC-AI-001: 단일 도메인 - 앱 내부 정보 조회
*   **User Input**: "이 숙소 체크아웃 시간이 언제인가요?"
*   **Expected Behavior**:
    1. `router`가 intent를 `service_policy`로 분류, `activatedExperts: ["app_logic"]` 결정.
    2. `app_logic` 노드에서 `faq_lookup("checkin")` 또는 `get_listing_details()` 도구 호출.
    3. `routeAfterExpert` -> `synthesizer`로 직행 (전문가 1개만 활성화).
    4. `synthesizer`가 최종 답변 생성.
*   **Success Metric**: 정확한 시간(오후 3시/오전 11시) 언급 및 추가 정책 안내 포함.

### SC-AI-002: 복합 추론 - 교통 + 정책
*   **User Input**: "서울역에서 숙소까지 셔틀을 타고 싶은데, 어떻게 예약하죠?"
*   **Expected Behavior**:
    1. `router`가 intent를 `complex`로 분류, `activatedExperts: ["app_logic", "transport"]` 결정.
    2. `routeAfterRouter` -> `app_logic` (첫 번째 전문가).
    3. `app_logic` 노드에서 `check_shuttle_status()` 호출하여 셔틀 정책 확인.
    4. `routeAfterExpert` -> `transport` (다음 미완료 전문가).
    5. `transport` 노드에서 `calculate_route_simulator()` 호출하여 서울역-숙소 경로 계산.
    6. `routeAfterExpert` -> `synthesizer` (모든 전문가 완료).
    7. `synthesizer`가 셔틀 정책 + 경로 정보를 통합한 답변 생성.
*   **Success Metric**: 셔틀 가용 여부와 경로/요금 정보가 하나의 자연스러운 답변으로 통합.

### SC-AI-003: 단일 도메인 - 한국 여행 정보
*   **User Input**: "근처에 한국 전통 음식을 먹을 수 있는 곳이 있나요?"
*   **Expected Behavior**:
    1. `router`가 intent를 `tourism`으로 분류, `activatedExperts: ["korea_travel"]` 결정.
    2. `korea_travel` 노드에서 `search_tourism_simulator()` 도구 호출.
    3. `synthesizer`가 외국인 게스트가 이해하기 쉬운 형태로 답변 생성.
*   **Success Metric**: 음식점 이름, 메뉴 설명, 문화 팁 포함.

### SC-AI-004: 에러 핸들링
*   **Scenario**: GEMINI_API_KEY를 잘못 설정한 상태에서 요청.
*   **Expected Behavior**:
    1. API 레벨에서 try-catch로 에러 포착.
    2. 서버 응답: `{ response: "죄송합니다. 잠시 후 다시 시도해주세요." }` (status 500).
    3. 클라이언트: 에러 메시지가 채팅 UI에 표시.
*   **Success Metric**: 사용자에게 에러 상황이 명확히 전달되고, 앱이 크래시하지 않음.

## 3. Performance & Safety Baseline
*   **LLM**: Gemini 2.0 Flash (안정 버전, exp 아님).
*   **Tool**: 시뮬레이션 도구 사용 중 (실제 Kakao/KTO API 미연동).
*   **Expert Loop**: 각 전문가 노드 내 도구 호출 최대 3회 반복 제한.
*   **Latency Target**: 단일 전문가 경로 3초 이내, 복합 경로 7초 이내 (네트워크 상태 정상 기준).
*   **Hallucination**: 내부 데이터(Listing/Booking)에 대해 사실 무근 정보 0건.
*   **Safety**: 한국 문화에 대해 편향되거나 잘못된 정보를 제공하지 않도록 모니터링.

## 4. Related Documents
- **Foundation**: [Happy Path Scenarios](../01_Concept_Design/07_HAPPY_PATH_SCENARIOS.md) - 사용자 페르소나 및 핵심 여정
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - Section 2.2 AI 컨시어지 기획 근거
- **Specs**: [AI Concierge Spec](../03_Technical_Specs/04_AI_CONCIERGE_SPEC.md) - 도구/스코프 검증 기준, 5노드 아키텍처
- **Logic**: [AI Concierge Logic](../04_Logic_Progress/08_AI_CONCIERGE_LOGIC.md) - 에이전트 추론 로직 및 State Schema
- **Test**: [QA Checklist](./02_QA_CHECKLIST.md) - 릴리스 전 최종 품질 기준
