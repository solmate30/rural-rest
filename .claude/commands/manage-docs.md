프로젝트 문서를 5-Layer 표준에 따라 생성 또는 수정한다. 사용자의 요청 내용: $ARGUMENTS

## 규칙

1. 이모지 금지. 전문적이고 명확한 텍스트로만 소통한다.
2. 문서를 독단적으로 작성하지 않는다. 초안 작성 전, 반드시 사용자에게 핵심 질문을 던지고 답변을 바탕으로 작성한다 (Ask before Write).
3. 기존 문서가 있으면 반드시 먼저 읽고, 컨텍스트와 스타일을 유지하며 업데이트한다. 덮어쓰지 않는다.

## 5-Layer 구조 (폴더명 · 역할)

| 순번 | 폴더명 | 역할 |
| :--- | :--- | :--- |
| 1 | `docs/01_Concept_Design/` | 컨셉·디자인 가이드. 기획, 비전, UI 디자인, 로드맵. |
| 2 | `docs/02_UI_Screens/` | UI 스크린. 페이지별 완성 모습·프로토타입 리뷰·화면 흐름. |
| 3 | `docs/03_Technical_Specs/` | 기술 명세. 데이터·API 약속, DB 스키마·구현 가이드. |
| 4 | `docs/04_Logic_Progress/` | 로직·진행. 백로그 + 비즈니스 로직·상태 관리·알고리즘. |
| 5 | `docs/05_QA_Validation/` | QA·검증. 테스트 시나리오, QA 체크리스트, 시스템 검증. |

## 레이어 판별 (어디에 둘지)

- 기획·UI 디자인·로드맵 → **01_Concept_Design**
- UI 프로토타입 결과·리뷰 → **02_UI_Screens**
- 상세 구현 명세 (DB, API) → **03_Technical_Specs**
- 비즈니스 로직·상태 머신·백로그 → **04_Logic_Progress**
- 테스트 계획·QA 보고 → **05_QA_Validation**

## 파일 작성 규칙

### 네이밍
파일명 앞에 2자리 순번을 붙인다: `01_VISION_CORE.md`, `02_API_SPECS.md`

### 메타데이터 (필수)
모든 문서 최상단:
```markdown
# [Document Title]
> Created: YYYY-MM-DD HH:mm
> Last Updated: YYYY-MM-DD HH:mm
```

### Related Documents 섹션 (필수)
모든 문서 끝에 관련 문서 링크를 포함한다. 상대 경로를 사용하고, 관계를 간략히 설명한다.

```markdown
## X. Related Documents
- **Layer Name**: [Document Title](./relative/path.md) - 관계 설명
```

링크 규칙:
- 같은 레이어: `./02_LEAN_CANVAS.md`
- 다른 레이어: `../01_Concept_Design/03_PRODUCT_SPECS.md`
- 특정 섹션 참조 시 Section 번호 명시

### 레이어별 필수 링크

- **Concept_Design**: 같은 레이어 문서들 + 관련 UI_Screens/Technical_Specs (있을 경우)
- **UI_Screens**: Concept_Design (Product Specs, UI Design) + 이전/다음 UI_Screens + Technical_Specs/Logic_Progress (있을 경우)
- **Technical_Specs**: Concept_Design + UI_Screens + 다른 Technical_Specs (DB ↔ API ↔ Storage) + Logic_Progress (있을 경우)
- **Logic_Progress**: Concept_Design + UI_Screens + Technical_Specs (DB, API) + QA_Validation (있을 경우)
- **QA_Validation**: 모든 상위 레이어 참조

## Interactive Process (Ask before Write)

### Foundation 문서 작성 전 질문 항목
1. Why: 핵심 문제와 목표
2. Who: 타겟 사용자와 페인포인트
3. What: 차별화된 가치 제안
4. How: MVP 범위, 플랫폼 제약
5. Distribution: 배포 형식, 호스팅, 도메인
6. Global Layout: Header/Footer 구성, AI/어시스턴트 진입점
7. Success: KPI, 리스크, 유지보수 계획

### Specs 문서 작성 전 질문 항목
1. Tech Stack: 프레임워크, DB, ORM
2. Data Models: 핵심 엔티티, 관계, 이미지 저장 방식
3. API Strategy: REST/GraphQL, 인증 방식
4. Edge Cases: 취소 정책, 다국어/다통화 로직

### Logic 문서 작성 전 질문 항목
1. Project Init: CLI 프리셋 vs 수동 설정
2. UI Theme: 기본 테마 vs 커스텀 브랜드
3. Folder Structure: 기능 기반 vs 타입 기반

## 실행 절차

1. 사용자 요청에서 대상 레이어를 판별한다
2. 해당 디렉터리의 기존 문서를 확인한다
3. 기존 문서가 있으면 읽어서 컨텍스트를 파악한다
4. 레이어에 맞는 질문을 사용자에게 던진다
5. 답변을 바탕으로 문서를 작성/수정한다
6. Related Documents 섹션을 반드시 포함한다
7. Last Updated 타임스탬프를 갱신한다
