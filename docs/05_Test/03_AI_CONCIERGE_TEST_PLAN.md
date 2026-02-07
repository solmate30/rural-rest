# Test Plan: AI Global Concierge
> Created: 2026-02-08 04:02
> Last Updated: 2026-02-08 04:02

## 1. Test Objectives
AI 컨시어지가 서비스 데이터와 외부 여행 정보를 정확하게 결합하여 제공하는지, 그리고 LangGraph 상태 전이가 의도대로 발생하는지 검증합니다.

## 2. Test Scenarios (User Journey)

### SC-AI-001: 앱 내부 정보 조회 테스트
*   **User Input**: "이 숙소 체크아웃 시간이 언제인가요?"
*   **Expected Behavior**: 현재 사용자의 예약(Booking) 정보를 조회하여 `checkOutTime`을 정확히 답변함.
*   **Success Metric**: 정확한 시간(예: 11:00 AM) 언급 및 추가 정책(예: Late Check-out 불가) 안내 포함.

### SC-AI-002: 복합 추론 테스트 (교통 + 정책)
*   **User Input**: "서울역에서 숙소까지 셔틀을 타고 싶은데, 어떻게 예약하죠?"
*   **Expected Behavior**:
    1.  `transport_expert`를 통해 서울역-숙소 간 경로 및 셔틀 포인트 확인.
    2.  `app_logic_node`를 통해 해당 숙소의 셔틀 운영 정책과 예약 방법 안내.
*   **Success Metric**: 특정 셔틀 포인트 명칭(예: 용문역 1번 출구)과 예약 링크/버튼 안내.

### SC-AI-003: 한국 여행 정보 테스트
*   **User Input**: "근처에 한국 전통 음식을 먹을 수 있는 곳이 있나요?"
*   **Expected Behavior**: KTO API를 검색하여 숙소 반경 5km 내의 전통 음식점 추천.
*   **Success Metric**: 음식점 이름, 메뉴 설명, 그리고 한국의 좌식 문화 등에 대한 짧은 팁 제공.

## 3. Performance & Safety Baseline
*   **Gemini 2.5 Flash Latency**: 초기 응답(First Token) 1.5초 이내.
*   **Hallucination Rate**: 내부 데이터(Listing/Booking)에 대해서는 사실 무근인 정보를 0건 발생시켜야 함.
*   **Safety**: 한국 문화에 대해 편향되거나 잘못된 정보를 제공하지 않도록 모니터링.

## 4. Related Documents
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 사용자 페르소나 및 핵심 여정
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 2.2 AI 컨시어지 기획 근거
- **Specs**: [AI Concierge Spec](../03_Specs/04_AI_CONCIERGE_SPEC.md) - 도구·스코프 검증 기준
- **Logic**: [AI Concierge Logic](../04_Logic/08_AI_CONCIERGE_LOGIC.md) - 에이전트 추론 로직 설계
- **Test**: [QA Checklist](./02_QA_CHECKLIST.md) - 릴리스 전 최종 품질 기준
