# AI Global Concierge Specification
> Created: 2026-02-08 03:55
> Last Updated: 2026-02-08 03:55

## 1. Overview
Rural Rest의 AI 컨시어지는 단순한 챗봇이 아닌, 서비스 전반의 데이터와 외부 여행 정보를 결합하여 게스트에게 개인화된 가이드를 제공하는 지능형 에이전트입니다. **Gemini 2.5 Flash**의 고속 추론 능력과 **LangGraph**의 상태 관리 아키텍처를 기반으로 합니다.

## 2. Technical Stack
*   **LLM**: Gemini 2.5 Flash (Google Vertex AI / AI Studio)
*   **Orchestration**: LangGraph (JS/TS SDK)
*   **State Management**: Postgres Checkpointer (for durable conversation history)
*   **Memory**: Thread-based conversation context + User Profile Vector Memory

## 3. Scope of Intelligence
### 3.1. Intra-App Intelligence (서비스 내부 정보)
*   **Listing Data**: 숙소 위치, 어메니티, 호스트 히스토리, 체크인/아웃 정책.
*   **Booking Status**: 특정 예약에 대한 상태, 셔틀 가용 시간, 호스트 연락처.
*   **Support Policies**: 취소 환불 규정, 이용 수칙.

### 3.2. Extra-App Intelligence (외부 여행 정보)
*   **Transport**: 카카오 모빌리티 연동을 통한 실시간 대중교통/택시 경로 및 예상 비용.
*   **Tourism**: 한국관광공사(KTO) 국문/영문 API 연동을 통한 주변 관광지 정보.
*   **Cultural Context**: 한국 여행 에티켓, 농촌 지역의 특색 있는 제철 음식 설명.

## 4. System Architecture
### 4.1. Tool Definition (Function Calling)
AI 에이전트가 실행할 수 있는 도구 목록:
1.  `get_listing_details(id)`: 숙소 상세 정보 조회.
2.  `check_shuttle_status(listing_id, date)`: 셔틀 예약 가용 대기 시간 조회.
3.  `calculate_route(origin, destination)`: Kakao API 연동 경로 계산.
4.  `search_korea_travel_info(keyword)`: KTO API 기반 관광 정보 검색.
5.  `faq_lookup(topic)`: 서비스 정책 FAQ 조회.

### 4.2. Security & Constraints
*   **Personal Data**: 사용자의 예약 비밀번호나 민감한 개인정보는 에이전트에게 전달하지 않음.
*   **Safety Filter**: 인종차별, 혐오 표현 및 불법적인 활동 제안 차단 (Gemini 내장 필터 활용).

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - Section 2.2 AI Global Concierge 기획 근거
- **Specs**: [API Specs](./02_API_SPECS.md) - 외부 API (Kakao, KTO) 연동 명세
- **Logic**: [AI Concierge Logic](../04_Logic/08_AI_CONCIERGE_LOGIC.md) - LangGraph 노드 및 엣지 설계
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 관련 기초 비즈니스 룰
