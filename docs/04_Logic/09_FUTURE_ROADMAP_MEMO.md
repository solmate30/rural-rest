# Future Roadmap & Feature Memos
> Created: 2026-02-08 03:35
> Last Updated: 2026-02-08 03:38

본 문서는 개발 과정에서 논의된 아이디어 및 향후 고도화 과제를 기록합니다.

## 1. 검색 인터페이스 (Search UI)
*   **홈 화면 (Home Page)**: 
    *   현재의 뱃지(Badge) 기반 UI가 브랜드 아이덴티티와 명확성 측면에서 우수하므로 이를 기본 유지함.
    *   단순 SVG 지도는 시각적 완성도가 낮아 보일 수 있으므로 사용하지 않기로 결정.

## 2. 프로퍼티 상세 페이지 (Property Detail)
*   **상용 지도 API 통합 (Kakao/Naver Map)**:
    *   **결정 사항**: 상세 페이지에서는 단순 그래픽 지도가 아닌 **카카오맵 또는 네이버 맵 API**를 정식으로 도입함.
    *   **핵심 기능**:
        1. 정확한 위치 핀 표시 및 로드뷰.
        2. 실시간 교통정보 연동 (숙소까지의 길찾기, 소요 시간).
        3. '교통 컨시어지' 기능과의 연계.
    *   **기술적 구현 가이드 (2024-2025 최신)**:
        *   **SDK**: React 환경에 최적화된 `react-kakao-maps-sdk` 사용 권장.
        *   **인증 및 보안**: `Kakao Developers`에서 JavaScript 키 발급 후 `.env`를 통한 환경 변수 관리 필수. 2024년 12월 이후 신규 앱은 플랫폼 내 '카카오맵 활성화' 설정이 필수임.
        *   **교통 정보 (Directions)**: `카카오 모빌리티 API (v1/directions)`를 연동하여 자동차/대중교통 길찾기 데이터 확보. (2025년 기준 대중교통 최신 데이터는 24시간 내 업데이트된 정보 제공).
        *   **사용자 경험**: 상세 페이지에서 '카카오맵 앱'으로 바로 연동되는 딥링크(Deep Link) 또는 인앱 로드뷰를 통해 실선 확인 기능 제공.

---

## 3. 관련 문서
- **Logic**: [Search & Filter Logic](./07_SEARCH_AND_FILTER_LOGIC.md)
- **Logic**: [Transport Concierge](./05_TRANSPORT_CONCIERGE_LOGIC.md)
- **Logic**: [AI Concierge Logic](./08_AI_CONCIERGE_LOGIC.md) - 교통·관광 정보 연동 에이전트
