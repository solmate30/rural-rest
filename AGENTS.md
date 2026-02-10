# Antigravity Global Standards & Communication Rules

## 1. 커뮤니케이션 및 승인 원칙
- **이모지 금지**: 사용자와의 모든 대화에서 이모지(Emoji) 및 이모티콘 사용을 전면 금지한다. 전문적이고 명확한 텍스트로만 소통한다.
- **선 답변 후 작업**: 질문이나 설명 요청 시, 파일 수정이나 명령 실행을 금지하고 상세한 텍스트 답변을 최우선으로 제공한다.
- **수정 승인 필수**: 코드를 수정하기 전에 반드시 수정 계획을 보고하고 명시적 승인을 얻어야 한다.
- **명확한 목적 제시**: 코드 수정을 시작할 때는 반드시 "OOO 기능을 수정하겠습니다"라고 목적을 명확히 밝힌다.
- **근거 기반 답변**: "아마도 그럴 것이다" 식의 추측을 금지하고, 반드시 도구(Tool)로 현재 상태를 검증한 후 답변한다.

## 2. 문서 관리 표준 (5-Layer Structure)
개발 문서는 다음 **폴더명과 역할**을 갖는 5단계 구조를 엄격히 준수한다.

| 순번 | 폴더명 | 역할 |
| :--- | :--- | :--- |
| 1 | `docs/01_Concept_Design/` | 컨셉과 디자인 가이드. 기획, 비전, 개요, UI 디자인, 기능 설명. |
| 2 | `docs/02_UI_Screens/` | UI 스크린. 페이지별 완성된 모습·프로토타입 리뷰·화면 흐름 확인. |
| 3 | `docs/03_Technical_Specs/` | 기술 명세. 데이터·API 등 기술적 약속, DB 스키마·구현 가이드. |
| 4 | `docs/04_Logic_Progress/` | 로직과 진행. 백로그(진행 상태) + 비즈니스 로직·상태 관리·알고리즘. |
| 5 | `docs/05_QA_Validation/` | QA와 검증. 테스트 시나리오·QA 체크리스트·시스템 검증. |

### 2.1. `docs/01_Concept_Design` — 컨셉·디자인
- **역할**: 프로젝트의 기획, 목적, 개요, UI 디자인, 기능 설명을 담는 컨셉·디자인 가이드.
- **포함 예**: `VISION.md`, `OVERVIEW.md`, `UI_DESIGN.md`, `ROADMAP.md`

### 2.2. `docs/02_UI_Screens` — UI 스크린
- **역할**: UI-First 전략에 따른 프로토타입 결과물(스크린샷, 흐름도) 및 리뷰. 페이지별 완성 모습 확인.
- **포함 예**: `PROTOTYPE_REVIEW.md`, `SCREEN_FLOW.md`, 페이지별 리뷰 문서

### 2.3. `docs/03_Technical_Specs` — 기술 명세
- **역할**: 개발자가 참고하는 구체적 지시서. 데이터·API 등 기술적 약속.
- **포함 예**: `DB_SCHEMA.md`, `API_SPECS.md`, `STORAGE_POLICY.md`, 구현 가이드

### 2.4. `docs/04_Logic_Progress` — 로직·진행
- **역할**: 백로그(진행 상태)와 비즈니스 로직·상태 관리·알고리즘 결합. UI와 데이터(DB/API) 연결 설계.
- **포함 예**: `00_BACKLOG.md`, `00_ARCHIVE/`, 상태 머신·알고리즘 설계 문서

### 2.5. `docs/05_QA_Validation` — QA·검증
- **역할**: 구현 기능의 검증. 단순 테스트를 넘어 시스템 검증.
- **포함 예**: `test_scenarios.md`, `qa_checklist.md`, 리뷰·감사 문서

### 2.6. 문서 작성 표준 (Metadata & Naming)
- **날짜 기록 필수**: 모든 문서의 최상단에는 **작성 일시(Created Date)**와 **최종 수정 일시(Last Updated Date)**를 반드시 명시한다.
- **날짜 형식**: `YYYY-MM-DD HH:mm` 포맷을 사용한다.
- **파일 네이밍**: 모든 파일명 앞에는 `01_`과 같은 **순번(Numbering)**을 반드시 붙여 생성 순서와 계층을 명확히 한다. (예: `01_VISION.md`, `02_UI_DESIGN.md`)
- **Interactive Process**: 문서를 작성할 때 AI가 독단적으로 내용을 채우지 않는다. 초안 작성 전, **반드시 사용자에게 핵심 질문을 던지고 답변을 바탕으로 문서를 작성(Ask before Write)**한다.

## 3. 개발 표준 및 품질
- **UI 중심 개발 전략 (UI-First)**: Concept_Design -> UI_Screens -> Technical_Specs -> Logic_Progress 순서를 따른다.
- **git commit 필수**: 중요 작업 전 반드시 git commit을 수행한다.
- **커밋 메시지 형식**: `type(scope): subject` 포맷을 따른다.
  - **Type**: `feat`(기능), `fix`(버그), `docs`(문서), `style`(포맷), `refactor`(리팩토링), `test`(테스트), `chore`(기타)
  - **Subject**: 한글로 명확하게 요약한다. (예: `feat(login): 소셜 로그인 API 연동`)

### 3.1. 프로젝트 구조 표준 (Monorepo Strategy)
- **Root Directory (`/`)**: 프로젝트의 **관리(Management)** 영역이다. Git, 문서(docs), 설정(AGENTS.md)을 포함한다.
- **App Directory (`/web`)**: 실제 **구현(Implementation)** 영역이다. 소스 코드, 빌드 설정, 의존성(package.json)을 포함한다.
- **Git 관리**: 반드시 **Root Directory**에서 수행하여 문서와 코드를 통합 관리한다.
- **배포 설정**: 배포 서비스의 Root Directory를 **App Directory**로 지정한다.
