# AI Global Concierge Specification
> Created: 2026-02-08 03:55
> Last Updated: 2026-02-10 15:00

## 1. Overview
Rural Rest의 AI 컨시어지는 단순한 챗봇이 아닌, 서비스 전반의 데이터와 외부 여행 정보를 결합하여 게스트에게 개인화된 가이드를 제공하는 지능형 에이전트입니다. **Gemini 2.0 Flash**의 고속 추론 능력과 **LangGraph**의 상태 관리 아키텍처를 기반으로, 5노드(router -> experts -> synthesizer) 그래프로 구성됩니다.

## 2. Technical Stack
*   **LLM**: Gemini 2.0 Flash (Google AI Studio)
*   **Orchestration**: LangGraph (JS/TS SDK) - 5노드 StateGraph
*   **State Management**: SQLite (Turso/libSQL) + `aiChatThreads`/`aiChatMessages` 테이블
*   **Memory**: Thread-based conversation context (DB 기반)

## 3. Scope of Intelligence
### 3.1. Intra-App Intelligence (서비스 내부 정보)
*   **Listing Data**: 숙소 위치, 어메니티, 호스트 히스토리, 체크인/아웃 정책.
*   **Booking Status**: 특정 예약에 대한 상태, 셔틀 가용 시간, 호스트 연락처.
*   **Support Policies**: 취소 환불 규정, 이용 수칙, 보증금 정책.

### 3.2. Extra-App Intelligence (외부 여행 정보)
*   **Transport**: 카카오 모빌리티 연동을 통한 실시간 대중교통/택시 경로 및 예상 비용.
*   **Tourism**: 한국관광공사(KTO) 국문/영문 API 연동을 통한 주변 관광지 정보.
*   **Cultural Context**: 한국 여행 에티켓, 농촌 지역의 특색 있는 제철 음식 설명.

## 4. System Architecture
### 4.1. 5-Node Graph Architecture
```
[START] -> [router] -> [app_logic / transport / korea_travel] -> [synthesizer] -> [END]
```

*   **router**: LLM structured output으로 의도 분류 및 전문가 노드 활성화 결정
*   **app_logic**: 서비스 정책, 숙소 데이터, FAQ 조회 전문가
*   **transport**: 교통 경로 계산, 셔틀 안내 전문가
*   **korea_travel**: 맛집, 관광지, 문화 안내 전문가
*   **synthesizer**: 전문가 결과 통합 -> 최종 자연어 응답 생성

### 4.2. Tool Definition (Function Calling)
AI 에이전트가 실행할 수 있는 도구 목록:
1.  `get_listing_details(id)`: 숙소 상세 정보 조회 (hostId 등 민감 필드 제외). **[구현 완료]**
2.  `check_shuttle_status(listingId, date)`: 셔틀 예약 가용 대기 시간 조회. **[구현 완료 - 시뮬레이션]**
3.  `calculate_route_simulator(origin, destination)`: 경로 계산 시뮬레이터 (Kakao API 대체). **[구현 완료 - 시뮬레이션]**
4.  `search_tourism_simulator(location, category)`: 관광 정보 검색 시뮬레이터 (KTO API 대체). **[구현 완료 - 시뮬레이션]**
5.  `faq_lookup(topic)`: 서비스 정책 FAQ 조회 (cancellation, checkin, rules, deposit). **[구현 완료]**

### 4.3. Tool Grouping by Expert
| Expert Node | Tools |
|---|---|
| `app_logic` | `get_listing_details`, `check_shuttle_status`, `faq_lookup` |
| `transport` | `calculate_route_simulator` |
| `korea_travel` | `search_tourism_simulator` |

### 4.4. Security & Constraints
*   **Personal Data**: `hostId` 등 민감 필드는 도구 응답에서 제외.
*   **Safety Filter**: 인종차별, 혐오 표현 및 불법적인 활동 제안 차단 (Gemini 내장 필터 활용).
*   **Error Handling**: API 레벨 try-catch + 클라이언트 에러 UI 피드백.

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 2.2 AI Global Concierge 기획 근거
- **Specs**: [API Specs](./02_API_SPECS.md) - 외부 API (Kakao, KTO) 연동 명세
- **Logic**: [AI Concierge Logic](../04_Logic/08_AI_CONCIERGE_LOGIC.md) - LangGraph 5노드 그래프 설계
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 관련 기초 비즈니스 룰
- **Test**: [AI Concierge Test Plan](../05_Test/03_AI_CONCIERGE_TEST_PLAN.md) - 시나리오 기반 검증 계획
