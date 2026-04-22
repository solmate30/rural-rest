# Antigravity Global Standards & Communication Rules

## 1. 커뮤니케이션 및 승인 원칙
- **이모지 금지**: 사용자와의 모든 대화에서 이모지 및 이모티콘 사용을 전면 금지하고, 전문적이고 명확한 텍스트로만 소통한다.
- **선 답변 후 작업**: 질문이나 설명 요청 시, 파일 수정이나 명령 실행을 금지하고 상세한 텍스트 답변을 최우선으로 제공한다.
- **수정 승인 필수**: 코드를 수정하기 전에 반드시 수정 계획을 보고하고 명시적 승인을 얻어야 한다.
- **명확한 목적 제시**: "OOO 기능을 수정하겠습니다"라고 목적을 명확히 밝힌다.
- **근거 기반 답변**: 추측을 금지하고, 반드시 도구로 현재 상태를 검증한 후 답변한다.
- **충분한 논의 및 완료 지연 금지(Anti-Rush)**: 사용자가 "이제 코딩을 시작하자"고 말하거나 "더 이상 보완할 점이 없다"고 확언할 때까지 현재 단계에 머물며 더 깊은 질문과 논의를 지속한다.
- **Self-Reflection Check**: 코드 수정 도구 호출 전 필수 질문에 답변한다:
  - 사용자에게 설명했는가?
  - 사용자의 명시적 승인이 있는가?
  - 기존 시스템에 영향을 주지 않는 근거가 있는가?
  - 코드 시작 전 사용자에게 충분한 질문과 의견교환을 했는가?

## 2. 문서 관리 표준(5-Layer Structure)

| 폴더 | 역할 |
|------|------|
| `docs/01_Concept_Design/` | 컨셉과 디자인 가이드(기획, 비전, UI 디자인, 기능 설명) |
| `docs/02_UI_Screens/` | UI 스크린(페이지별 완성된 모습, 프로토타입, 화면 흐름) |
| `docs/03_Technical_Specs/` | 기술 명세(데이터, API, DB 스키마, 구현 가이드) |
| `docs/04_Logic_Progress/` | 로직과 진행(백로그, 비즈니스 로직, 상태 관리) |
| `docs/05_QA_Validation/` | QA와 검증(테스트 시나리오, 체크리스트, 시스템 검증) |

### 2.1 Concept_Design
컨셉과 디자인 가이드로 프로젝트의 기획, 목적, 개요를 담는다.
예: `VISION.md`, `OVERVIEW.md`, `UI_DESIGN.md`, `ROADMAP.md`

### 2.2 UI_Screens
UI-First 전략에 따른 프로토타입 결과물 및 리뷰, 페이지별 완성 모습 확인.
예: `PROTOTYPE_REVIEW.md`, `SCREEN_FLOW.md`

### 2.3 Technical_Specs
개발자용 지시서로 데이터·API 등 기술적 약속을 정의한다.
예: `DB_SCHEMA.md`, `API_SPECS.md`, `STORAGE_POLICY.md`

### 2.4 Logic_Progress
백로그, 로드맵, 실행 계획, 비즈니스 로직을 관리한다.
**필수**: 모든 구현 일정과 백로그는 이 폴더에서만 관리한다.
표준 파일명:
- `00_BACKLOG.md`: 작업 목록 및 진행 상태(ToDo/Doing/Done)
- `01_ROADMAP.md`: 마일스톤 및 주요 단계별 일정
- `02_EXECUTION_PLAN.md`: 구체적 기술 전략 및 타임라인

### 2.5 QA_Validation
구현 기능의 검증 및 시스템 검증.
예: `test_scenarios.md`, `qa_checklist.md`

### 2.6 문서 작성 표준
- **날짜 기록 필수**: 모든 문서의 최상단에 작성 일시와 최종 수정 일시 명시
- **날짜 형식**: `YYYY-MM-DD HH:mm`
- **파일 네이밍**: `01_VISION.md` 식으로 순번 붙임
- **Interactive Process**: 초안 작성 전 사용자에게 핵심 질문을 던지고 답변을 바탕으로 작성

## 3. 개발 표준 및 품질
- **UI-First 전략**: Concept_Design → UI_Screens → Technical_Specs → Logic_Progress
- **git commit 필수**: 중요 작업 전 반드시 수행
- **커밋 메시지 형식**: `type(scope): subject`
  - Type: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Subject: 한글로 명확하게(예: `feat(login): 소셜 로그인 API 연동`)

### 3.1 프로젝트 구조 표준(Monorepo)
- **Root Directory**: 관리 영역(Git, 문서, 설정, 루트 package.json)
- **App Directory(`/web`)**: 구현 영역(소스 코드, 빌드 설정, 의존성)
- **Git 관리**: Root Directory에서 수행
- **배포 설정**: App Directory를 Root로 지정하거나 Build Command 설정

## 4. Skills & AI Capabilities
AI 에이전트는 24개 스킬을 활용하여 작업을 수행한다.

| 카테고리 | 스킬명 | 주요 역할 |
|---------|--------|---------|
| 운영·거버넌스 | `role-team-member` | 팀원 협업 표준 준수 |
| | `role-team-lead` | 프로젝트 관리 책임 |
| | `manage-collaboration` | 협업 표준 강제 |
| | `manage-decisions` | 대화 기반 의사결정 |
| | `rules-docs` | 5단계 문서 구조 관리 |
| | `manage-skills` | 검증 스킬 유지보수 |
| | `rules-workflow` | 18단계 워크플로우 가이드 |
| 문서 작성 | `docs-plan` | Layer 1-2 기획·UI 문서 |
| | `docs-dev` | Layer 3-5 기술·진행·QA 문서 |
| | `docs-pitch` | 피치덱 작성 |
| | `docs-business` | 사업계획서 작성 |
| QA 검증 | `verify-implementation` | 통합 순차 실행 및 보고 |
| | `verify-docs` | 문서 정합성 검증 |
| | `verify-drizzle-schema` | Drizzle 스키마 검증 |
| | `verify-security` | OWASP Top 10 보안 점검 |
| | `verify-performance` | Lighthouse·Core Web Vitals 점검 |
| | `verify-code` | 코드 품질 리뷰 |
| 개발·설계 | `rules-dev` | 코딩 표준 확인 |
| | `rules-react` | UI 컴포넌트 표준 |
| | `rules-product` | 전체 파이프라인 오케스트레이션 |
| 특수 도구 | `tools-shadcn` | shadcn/ui 활용 |
| | `tools-obsidian` | Obsidian 동기화 |
| 외부 확장 | `ext-awesome-design` | 프리미엄 디자인 시스템 |
| | `ext-k-skill` | 한국 특화 스킬 |

## 5. 스킬 능동 제안 원칙
AI는 아래 상황을 감지하면 관련 스킬을 먼저 제안한다(강제 아님).

| 감지 상황 | 제안 스킬 | 예시 문구 |
|----------|---------|---------|
| 기술 선택·DB/API 설계 논의 | `manage-decisions` | "결정이 필요합니다. `/manage-decisions`로 진행할까요?" |
| 보안·인증·환경변수 관련 작업 | `verify-security` | "보안 점검이 필요합니다. `/verify-security` 실행할까요?" |
| 성능·렌더링·이미지 관련 작업 | `verify-performance` | "성능 점검이 필요합니다. `/verify-performance` 실행할까요?" |
| PR 생성 전 코드 변경 완료 | `verify-code`, `verify-implementation` | "최종 점검입니다. `/verify-implementation` 실행할까요?" |
| 기획·UI 문서 작성 요청 | `docs-plan` | "Layer 1-2는 `/docs-plan`을 사용하세요." |
| DB·API·백로그 작성 요청 | `docs-dev` | "Layer 3-5는 `/docs-dev`를 사용하세요." |
| Drizzle 스키마 수정 | `verify-drizzle-schema` | "스키마 변경 후 `/verify-drizzle-schema` 실행하세요." |
| 기능 구현 시작 전 | `rules-workflow` | "기능 구현은 `/rules-workflow` 18단계로 진행하세요." |
| 새 프로젝트·단계 전환 | `rules-product` | "현재 단계 진단은 `/rules-product` 실행하세요." |

**제안 방식**:
- 현재 맥락에서 상황을 감지하면 작업 진행 전 한 줄로 제안
- 사용자가 거절하거나 이미 실행 중이면 생략
- 동일 대화에서 중복 제안 금지

## 6. 최종 약속
AI 에이전트는 본 **AGENTS.md**를 모든 판단의 최우선 근거로 삼는다. 문서에 정의되지 않은 작업을 수행할 경우, 반드시 사용자에게 구현 전 문서 업데이트 필요성을 먼저 확인한다.
