# AI 컨시어지 문서 검토 보고서
> Created: 2026-02-08
> Last Updated: 2026-02-08

AI 컨시어지 관련 신규·수정 문서의 정합성 및 문서 간 맥락(참조)을 검토한 결과입니다.

---

## 1. 검토 대상

| 레이어 | 문서 | 비고 |
|--------|------|------|
| Foundation | 03_PRODUCT_SPECS.md (Section 2.2), 05_UI_DESIGN.md | 기획·UI |
| Specs | 04_AI_CONCIERGE_SPEC.md | 신규 |
| Logic | 08_AI_CONCIERGE_LOGIC.md, 09_FUTURE_ROADMAP_MEMO.md, 00_BACKLOG.md | 신규·수정 |
| Test | 03_AI_CONCIERGE_TEST_PLAN.md | 신규 |

---

## 2. 문서 흐름 정합성

*   **Foundation → Specs → Logic → Test** 순서가 유지됨.
*   **03_PRODUCT_SPECS** Section 2.2: AI Global Concierge 범위·기술·목표 정의. **04_AI_CONCIERGE_SPEC**이 이를 구체화.
*   **08_AI_CONCIERGE_LOGIC**: LangGraph 노드·엣지·상태 스키마. **04_AI_CONCIERGE_SPEC**의 도구 목록과 **05_TRANSPORT_CONCIERGE_LOGIC**을 참조.
*   **03_AI_CONCIERGE_TEST_PLAN**: SC-AI-001~003 시나리오가 Logic의 router·노드·도구와 대응됨.

---

## 3. 수정·보완 반영 사항

### 3.1. 잘못된 경로 수정
*   **08_AI_CONCIERGE_LOGIC.md** Related Documents: `./04_Logic/04_TRANSLATION_ENGINE.md` → `./04_TRANSLATION_ENGINE.md` (동일 레이어 내 상대 경로로 수정).

### 3.2. 누락된 참조 추가
*   **03_PRODUCT_SPECS.md** Related Documents: AI Concierge Spec, AI Concierge Logic, AI Concierge Test Plan 링크 추가 (Section 2.2와 연계).
*   **00_BACKLOG.md** Task 2.10, 2.11: AI Concierge Logic·Spec 문서 링크 추가.
*   **03_AI_CONCIERGE_TEST_PLAN.md** Related Documents: Product Specs(Section 2.2), AI Concierge Spec 링크 추가.
*   **09_FUTURE_ROADMAP_MEMO.md** 관련 문서: AI Concierge Logic 링크 추가 (교통·관광 연동 맥락).

### 3.3. UI Design 보강
*   **05_UI_DESIGN.md** Section **6.3. AI Concierge Entry Point (Ask AI)** 추가: 진입 위치(헤더/플로팅), 노출 페이지 정책, Spec·Logic 문서 참조. Related Documents에 AI Concierge Spec·Logic 링크 추가.

---

## 4. 참고 사항 (추가 권장 아님)

*   **04_AI_CONCIERGE_SPEC**에서 [API Specs](./02_API_SPECS.md)를 "외부 API (Kakao, KTO) 연동 명세"로 참조. 현재 02_API_SPECS에 Kakao/KTO 전용 섹션이 없을 수 있음. 추후 해당 API 명세가 생기면 동일 문서 내 섹션 번호로 링크 보강 권장.
*   **05_TRANSPORT_CONCIERGE_LOGIC**과 **08_AI_CONCIERGE_LOGIC** 간 상호 참조는 이미 양쪽 Related Documents에 포함됨.

---

## 5. 최종 확인

| 확인 항목 | 상태 |
|-----------|------|
| Foundation ↔ Specs ↔ Logic ↔ Test 상호 참조 | 보완 완료 |
| 08 Logic 내부 경로 오류 | 수정 완료 |
| BACKLOG 태스크와 AI 문서 연결 | 보완 완료 |
| UI Design에 AI 진입점 명시 | Section 6.3 추가 완료 |
| 09 Future Roadmap과 AI/교통 문서 연결 | 보완 완료 |

---

## 6. 관련 문서

- **Specs**: [AI Concierge Spec](../03_Specs/04_AI_CONCIERGE_SPEC.md)
- **Logic**: [AI Concierge Logic](../04_Logic/08_AI_CONCIERGE_LOGIC.md)
- **Test**: [AI Concierge Test Plan](./03_AI_CONCIERGE_TEST_PLAN.md)
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) Section 2.2
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) Section 6.3
