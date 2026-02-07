# Antigravity Global Standards & Communication Rules

## 1. 커뮤니케이션 및 승인 원칙
- **이모지 금지**: 사용자와의 모든 대화에서 이모지(Emoji) 및 이모티콘 사용을 전면 금지한다. 전문적이고 명확한 텍스트로만 소통한다.
- **선 답변 후 작업**: 질문이나 설명 요청 시, 파일 수정이나 명령 실행을 금지하고 상세한 텍스트 답변을 최우선으로 제공한다.
- **수정 승인 필수**: 코드를 수정하기 전에 반드시 수정 계획을 보고하고 명시적 승인을 얻어야 한다.
- **명확한 목적 제시**: 코드 수정을 시작할 때는 반드시 "OOO 기능을 수정하겠습니다"라고 목적을 명확히 밝힌다.
- **근거 기반 답변**: "아마도 그럴 것이다" 식의 추측을 금지하고, 반드시 도구(Tool)로 현재 상태를 검증한 후 답변한다.

## 2. 문서 관리 표준 (5-Layer Structure)
개발 문서는 다음 **순번이 매겨진 5단계 구조**를 엄격히 준수한다.

### 2.1. `docs/01_Foundation` (기획 & 디자인)
- 프로젝트의 **기획, 목적, 개요, UI 디자인, 기능 설명**을 포함하는 문서들이다.
- **포함 내용**: `VISION.md`, `OVERVIEW.md`, `UI_DESIGN.md`

### 2.2. `docs/02_Prototype` (UI 프로토타이핑)
- **UI-First 전략**에 따라 제작된 프로토타입의 결과물(스크린샷, 흐름도)이나 리뷰를 기록한다.
- **포함 내용**: `PROTOTYPE_REVIEW.md`, `SCREEN_FLOW.md`

### 2.3. `docs/03_Specs` (상세 명세 & 구현 가이드)
- 실제 코드를 작성하기 위해 **개발자가 참고해야 할 구체적인 지시서**이다.
- **포함 내용**: `login_spec.md`, `api_endpoints.md`, `db_schema.md`

### 2.4. `docs/04_Logic` (비즈니스 로직 & 설계)
- UI와 데이터(DB/API)를 연결하는 **비즈니스 로직, 상태 관리, 알고리즘** 등을 설계한다.
- **포함 내용**: `business_rules.md`, `state_management.md`, `algorithm_design.md`

### 2.5. `docs/05_Test` (테스트 & 검증)
- 구현된 기능이 의도대로 동작하는지 **검증하는 문서**이다.
- **포함 내용**: `test_scenarios.md`, `qa_reports.md`

### 2.5. 문서 작성 표준 (Metadata & Naming)
- **날짜 기록 필수**: 모든 문서의 최상단에는 **작성 일시(Created Date)**와 **최종 수정 일시(Last Updated Date)**를 반드시 명시한다.
- **날짜 형식**: `YYYY-MM-DD HH:mm` 포맷을 사용한다.
- **파일 네이밍**: 모든 파일명 앞에는 `01_`과 같은 **순번(Numbering)**을 반드시 붙여 생성 순서와 계층을 명확히 한다. (예: `01_VISION.md`, `02_UI_DESIGN.md`)
- **Interactive Process**: 문서를 작성할 때 AI가 독단적으로 내용을 채우지 않는다. 초안 작성 전, **반드시 사용자에게 핵심 질문을 던지고 답변을 바탕으로 문서를 작성(Ask before Write)**한다.

## 3. 개발 표준 및 품질
- **UI 중심 개발 전략 (UI-First)**: Foundation -> Prototype -> Specs -> Logic 순서를 따른다.
- **git commit 필수**: 중요 작업 전 반드시 git commit을 수행한다.
- **커밋 메시지 형식**: `type(scope): subject` 포맷을 따른다.
  - **Type**: `feat`(기능), `fix`(버그), `docs`(문서), `style`(포맷), `refactor`(리팩토링), `test`(테스트), `chore`(기타)
  - **Subject**: 한글로 명확하게 요약한다. (예: `feat(login): 소셜 로그인 API 연동`)

### 3.1. 프로젝트 구조 표준 (Monorepo Strategy)
- **Root Directory (`/`)**: 프로젝트의 **관리(Management)** 영역이다. Git, 문서(docs), 설정(AGENTS.md)을 포함한다.
- **App Directory (`/rural-rest-v2`)**: 실제 **구현(Implementation)** 영역이다. 소스 코드, 빌드 설정, 의존성(package.json)을 포함한다.
- **Git 관리**: 반드시 **Root Directory**에서 수행하여 문서와 코드를 통합 관리한다.
- **배포 설정**: 배포 서비스의 Root Directory를 **App Directory**로 지정한다.
