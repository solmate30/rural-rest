---
name: manage-docs
description: Create and manage project documentation according to the 5-layer standard (01_Concept_Design, 02_UI_Screens, 03_Technical_Specs, 04_Logic_Progress, 05_QA_Validation) with mandatory cross-layer context linking. Use when the user asks to document features, update documentation, create spec files, or manage project docs. Always include "Related Documents" sections to maintain context continuity across layers.
---

# Documentation Management Skill

This skill helps you maintain the project's documentation structure, ensuring consistency and adherence to the **5-Layer Documentation Standard**.

## 1. Structure Overview

All documentation must reside in `docs/` and follow this hierarchy. **폴더명과 역할**은 아래와 같다.

| 순번 | 폴더명 | 역할 |
| :--- | :--- | :--- |
| 1 | `docs/01_Concept_Design/` | 컨셉·디자인 가이드. 기획, 비전, UI 디자인, 로드맵. |
| 2 | `docs/02_UI_Screens/` | UI 스크린. 페이지별 완성 모습·프로토타입 리뷰·화면 흐름. |
| 3 | `docs/03_Technical_Specs/` | 기술 명세. 데이터·API 약속, DB 스키마·구현 가이드. |
| 4 | `docs/04_Logic_Progress/` | 로직·진행. 백로그 + 비즈니스 로직·상태 관리·알고리즘. |
| 5 | `docs/05_QA_Validation/` | QA·검증. 테스트 시나리오, QA 체크리스트, 시스템 검증. |

| Layer | Directory | Purpose (EN) | Examples |
| :--- | :--- | :--- | :--- |
| Concept_Design | `docs/01_Concept_Design/` | Planning, Purpose, UI Design. | `01_VISION_CORE.md`, `05_UI_DESIGN.md`, `04_ROADMAP.md` |
| UI_Screens | `docs/02_UI_Screens/` | UI results, screen flows. | `00_LANDING_PAGE_REVIEW.md`, `01_DETAIL_PAGE_REVIEW.md` |
| Technical_Specs | `docs/03_Technical_Specs/` | Data, API, implementation specs. | `01_DB_SCHEMA.md`, `02_API_SPECS.md` |
| Logic_Progress | `docs/04_Logic_Progress/` | Backlog + business rules, algorithms. | `00_BACKLOG.md`, `01_BOOKING_STATE_MACHINE.md` |
| QA_Validation | `docs/05_QA_Validation/` | Test scenarios, QA checklists, validation. | `01_TEST_SCENARIOS.md`, `02_QA_CHECKLIST.md` |

### 1.1. Layer Roles & Context Flow

Each layer has a specific role and maintains context continuity with adjacent layers:

**Concept & Design (01_Concept_Design/)**: 
- **Role**: 프로젝트의 비전, 목적, 전략, 디자인 원칙 정의
- **Context Flow**: Concept_Design → UI_Screens (디자인 가이드라인 제공), Concept_Design → Technical_Specs (기능 명세 기반 제공)

**UI Screens (02_UI_Screens/)**:
- **Role**: UI 프로토타입 리뷰 및 사용자 플로우 검증 (페이지별 완성된 모습 확인)
- **Context Flow**: UI_Screens ← Concept_Design (디자인 시스템 참조), UI_Screens → Technical_Specs (구현 명세 요구사항 도출)

**Technical Specs (03_Technical_Specs/)**:
- **Role**: 기술 명세 및 구현 가이드라인 정의 (데이터, API 등 기술적 약속)
- **Context Flow**: Technical_Specs ← Concept_Design (기능 명세 기반), Technical_Specs ← UI_Screens (UI 요구사항 반영), Technical_Specs → Logic_Progress (비즈니스 로직 설계 기반)

**Logic & Progress (04_Logic_Progress/)**:
- **Role**: 백로그(진행 상태)와 비즈니스 로직, 상태 관리, 알고리즘 설계
- **Context Flow**: Logic_Progress ← Technical_Specs (데이터 모델 및 API 명세 참조), Logic_Progress ← UI_Screens (UI 인터랙션 요구사항 반영), Logic_Progress → QA_Validation (테스트 시나리오 기반)

**QA & Validation (05_QA_Validation/)**:
- **Role**: 테스트 케이스 및 QA 기준 정의 (시스템 검증)
- **Context Flow**: QA_Validation ← 모든 상위 레이어 (Concept_Design, UI_Screens, Technical_Specs, Logic_Progress 참조하여 테스트 시나리오 작성)

## 2. Usage Instructions

When the user asks to "document X" or "update documentation for X", follow these steps:

1.  **Identify the Layer**: Determine which of the 5 layers the document belongs to.
    *   Is it high-level planning or UI Design? -> **01_Concept_Design**
    *   Is it a result of UI prototyping? -> **02_UI_Screens**
    *   Is it a detailed implementation spec? -> **03_Technical_Specs**
    *   Is it business logic, state management, backlog, or algorithm design? -> **04_Logic_Progress**
    *   Is it a test plan or QA report? -> **05_QA_Validation**

2.  **Check Existing Docs**:
    *   Use `list_dir` to check if a relevant file already exists in the target directory.
    *   If it exists, **read it first** to maintain context and style. Do not overwrite if you can update.

3.  **Ask & Verify (Interactive Process)**:
    *   **CRITICAL**: Do NOT generate a full document based on assumptions.
    *   **Foundation Phase**: Ask the following questions before creating `01_VISION.md` or `02_OVERVIEW.md`:
        1.  **Why (Problem & Goal)**: What is the core problem? How does the world change if we succeed? What are short/long-term goals?
        2.  **Who (Target User)**: Who is the core customer? What are their pain points? How do they solve this now?
        3.  **What (Value & Differentiation)**: What is our Unique Value Proposition? Why would they pay/use us over competitors?
        4.  **How (Feasibility)**: What must be in MVP (v1.0)? Platform constraints (Web/Mobile)? Legal/Security concerns?
        5.  **Distribution Strategy**: Output format (Responsive Web/PWA/App)? Hosting Platform (Vercel/Netlify)? Domain strategy?
        6.  **Global Layout & Brand Consistency**: Discuss the standard **Header and Footer** early. What links, logo, and legal information must be present on every page? If the product will offer an **AI / assistant** (e.g. "Ask AI" or concierge), where should the entry point live (floating button, header icon, dedicated screen, sidebar panel) and on which pages?
        7.  **Success (Strategy & Metrics)**: What are the KPIs? What are the biggest risks? Maintenance plan?
    *   **Specs Phase**: Ask the following questions before creating `01_DB_SCHEMA.md` or `02_API_SPECS.md`:
        1.  **Tech Stack & Architecture**: Which Framework (Next.js/React)? Which DB (Supabase/Postgres/MySQL)? ORM (Prisma/Drizzle)?
        2.  **Data Models**: Which entities are core? (e.g., Users, Listings, Bookings). Key relationships? (1:N, N:M). Store images in DB or Storage (S3)?
        3.  **API Strategy**: REST or GraphQL? Auth method (NextAuth/Clerk/Supabase Auth)?
        4.  **Edge Cases**: How to handle cancellations? Multi-currency logic (Store in KRW/USD)?
    *   **Logic Phase (Project Setup)**: Ask the following questions before starting `00_BACKLOG.md` or coding:
        1.  **Project Initialization**: Use CLI presets (e.g., `shadcn@latest create`) or manual setup?
        2.  **UI Theme Strategy**: Pre-defined theme (Neutral/Zinc) vs Custom Brand Colors? Font choice (Inter/Geist)?
        3.  **Folder Structure**: Feature-based vs Type-based? (e.g., `features/auth` vs `components/ui`)
    *   Only proceed to draft the document after receiving user input.

4.  **Create/Update File**:
    *   Use the appropriate template structure (defined below).
    *   **File Naming**: Must start with a 2-digit number followed by an underscore (e.g., `01_vision.md`, `02_auth-spec.md`).
    *   **Mandatory Metadata**: Every file MUST start with the following header:
        ```markdown
        # [Document Title]
        > Created: [YYYY-MM-DD HH:mm]
        > Last Updated: [YYYY-MM-DD HH:mm]
        ```
    *   **Mandatory Context Linking**: Every document MUST include a "Related Documents" section at the end (see Section 5 for details).

## 3. Templates

### (A) Concept & Design Templates (`docs/01_Concept_Design/`)
Required Documents:
1.  **`01_LEAN_CANVAS.md`**: Problem, Solution, UVP, Metrics
2.  **`02_PRODUCT_SPECS.md`**: MVP Definition, Core Features
3.  **`03_ROADMAP.md`**: Now / Next / Later Strategy
4.  **`04_UI_DESIGN.md`**: Design Guidelines

```markdown
# [Title: Lean Canvas / Product Specs / Roadmap]
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]

[Document content...]

## X. Related Documents
- **Foundation**: [Vision & Core Values](./01_VISION_CORE.md) - 프로젝트 비전 및 타겟 오디언스
- **Foundation**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 수익 구조
- **Foundation**: [Roadmap](./04_ROADMAP.md) - 단계별 실행 계획
```

### (B) UI Screens Template (`docs/02_UI_Screens/`)
Used for: Prototype Review, Screen Flow, UI Feedback

```markdown
# [Prototype Name] Review
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]

## 1. Prototype Link/Screenshot
(Attach image or link to the working prototype)

## 2. Key User Flows
(Describe the flow demonstrated in this prototype)

## 3. Feedback & Improvements
(What needs to be changed before implementation?)

## 4. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 해당 페이지 사이트맵 및 사용자 플로우
- **Concept_Design**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트 가이드라인
- **Prototype**: [Previous/Next Prototype](./XX_PREVIOUS_REVIEW.md) - 이전/다음 단계 프로토타입
```

### (C) Technical Specs Template (`docs/03_Technical_Specs/`)
Used for: Feature Specs, API Design, Database Schema

```markdown
# [Feature Name] Specification
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]

[Document content...]

## X. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 기능 명세 및 사이트맵
- **UI_Screens**: [Related UI Review](../02_UI_Screens/XX_REVIEW.md) - 관련 UI 프로토타입
- **Technical_Specs**: [Database Schema](./01_DB_SCHEMA.md) - 데이터 모델 설계
- **Logic_Progress**: [Related Logic Design](../04_Logic_Progress/XX_LOGIC.md) - 비즈니스 로직 설계
```

### (D) Logic & Progress Template (`docs/04_Logic_Progress/`)
Used for: Business Rules, State Management, Algorithm Design

Required Documents:
1.  **`00_BACKLOG.md`**: Kanban Board (Current, Upcoming, Completed).
2.  **`00_ARCHIVE/`**: Directory for finished tasks.
3.  **Specific Logic Docs**: (e.g., `BookingStateMachine.md`, `SearchAlgorithm.md`, `business_rules.md`, `state_management.md`)

```markdown
# [Logic Name] Design
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]

## 1. Context
(Why is this logic needed? Which UI interacts with it?)

**관련 UI**: [UI Component Name] → [Next Component] → [Final Component]

## 2. Business Rules
- [ ] Rule 1: (e.g., Cancellation is free until 24 hours before)
- [ ] Rule 2: (e.g., Login required for payment)

## 3. Data Flow & State
(How does data move? State machine diagram if needed)

## 4. Algorithm / Pseudo-code
(Step-by-step logic description)

## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 관련 기능 명세
- **UI_Screens**: [Related UI Review](../02_UI_Screens/XX_REVIEW.md) - 관련 UI 프로토타입
- **Technical_Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 데이터 모델 참조
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 참조
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 관련 테스트 케이스
```

### (E) QA & Validation Template (`docs/05_QA_Validation/`)
Used for: Test Plans, Checklists, Bug Reports

```markdown
# Test Report / Plan: [Feature Name]
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]

[Document content...]

## X. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 테스트 대상 기능 명세
- **UI_Screens**: [Related UI Review](../02_UI_Screens/XX_REVIEW.md) - 테스트 대상 UI 프로토타입
- **Technical_Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 데이터베이스 테스트 참조
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 테스트 참조
- **Logic_Progress**: [Related Logic Design](../04_Logic_Progress/XX_LOGIC.md) - 비즈니스 로직 테스트 참조
- **QA_Validation**: [QA Checklist](./02_QA_CHECKLIST.md) - 릴리스 기준 및 체크리스트
```

## 4. Context Linking & Cross-References

**CRITICAL**: Every document MUST maintain context continuity with related documents across layers. This ensures that developers can trace requirements from vision to implementation to testing.

### 4.1. Related Documents Section (Mandatory)

Every document MUST include a "Related Documents" section at the end, before any appendices or additional resources. This section links to documents that:
- **Provide context**: Documents that this document builds upon or references
- **Are implemented by**: Documents that implement or detail this document's concepts
- **Are tested by**: Documents that test this document's functionality

**Format**:
```markdown
## X. Related Documents
- **Layer Name**: [Document Title](./relative/path/to/document.md) - Brief description of relationship
```

### 4.2. Linking Rules by Layer

#### Foundation Layer Documents
**Must link to**:
- Other Foundation documents (Vision → Lean Canvas → Product Specs → Roadmap → UI Design 순서)
- Prototype documents that implement the designs (if exist)
- Specs documents that detail the features (if exist)

**Example**:
```markdown
## 7. Related Documents
- **Foundation**: [Lean Canvas](./02_LEAN_CANVAS.md) - 비즈니스 모델 및 수익 구조
- **Foundation**: [Product Specs](./03_PRODUCT_SPECS.md) - MVP 기능 명세 및 사이트맵
- **Foundation**: [Roadmap](./04_ROADMAP.md) - 단계별 실행 전략
```

#### Prototype Layer Documents
**Must link to**:
- Foundation documents (Product Specs, UI Design) that define the requirements
- Previous/Next Prototype documents (if sequential)
- Specs documents that detail the implementation (if exist)
- Logic documents that implement the business rules (if exist)

**Example**:
```markdown
## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 랜딩 페이지 사이트맵 및 사용자 플로우 (Section 3.A.1)
- **Concept_Design**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 및 컴포넌트 가이드라인
- **Prototype**: [Property Detail Page Review](./01_DETAIL_PAGE_REVIEW.md) - 다음 단계 프로토타입
```

#### Specs Layer Documents
**Must link to**:
- Foundation documents (Product Specs, UI Design) that define the requirements
- Prototype documents that demonstrate the UI (if exist)
- Logic documents that implement the business rules (if exist)
- Other Specs documents (DB Schema ↔ API Specs ↔ Storage Policy)

**Example**:
```markdown
## 5. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 명세 및 사이트맵
- **Concept_Design**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 가이드라인
- **UI_Screens**: [Property Detail Review](../02_UI_Screens/01_DETAIL_PAGE_REVIEW.md) - 프로토타입 리뷰
- **Technical_Specs**: [Database Schema](./01_DB_SCHEMA.md) - 데이터베이스 스키마 명세
- **Logic_Progress**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
```

#### Logic Layer Documents
**Must link to**:
- Foundation documents (Product Specs) that define the requirements
- Prototype documents that show the UI interactions
- Specs documents (DB Schema, API Specs) that define the data models and endpoints
- Test documents that test this logic (if exist)
- Other Logic documents (if related)

**Example**:
```markdown
## 6. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 예약 플로우 사이트맵 (Section 3.A.4)
- **UI_Screens**: [Booking Page Review](../02_UI_Screens/02_BOOKING_PAGE_REVIEW.md) - 예약 페이지 UI 프로토타입
- **Technical_Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - `bookings` 테이블 구조 및 상태 필드
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - Booking Process API 엔드포인트 (Section 3.4)
- **QA_Validation**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 예약 관련 테스트 케이스 (Section 2.2)
```

#### Test Layer Documents
**Must link to**:
- Foundation documents (Product Specs, Roadmap) that define what to test
- Prototype documents that show what UI to test
- Specs documents (DB Schema, API Specs) that define what to test
- Logic documents that define the business rules to test
- Other Test documents (Test Scenarios ↔ QA Checklist)

**Example**:
```markdown
## 10. Related Documents
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 사용자 플로우 및 사이트맵 (테스트 시나리오 기반)
- **UI_Screens**: [Landing Page Review](../02_UI_Screens/00_LANDING_PAGE_REVIEW.md) - 랜딩 페이지 테스트 대상
- **Technical_Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - 데이터베이스 통합 테스트 참조
- **Technical_Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - API 엔드포인트 테스트 참조
- **Logic_Progress**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직 테스트 참조
```

### 4.3. Link Path Format

- **Use relative paths**: Always use relative paths from the current document
- **Be specific**: Include section references when linking to specific parts (e.g., "Section 3.A.1")
- **Describe relationship**: Always include a brief description of why the link is relevant

**Path Examples**:
- Same layer: `./02_LEAN_CANVAS.md`
- Parent layer: `../01_Concept_Design/03_PRODUCT_SPECS.md`
- Child layer: `../02_UI_Screens/00_LANDING_PAGE_REVIEW.md`
- Sibling layer: `../03_Technical_Specs/01_DB_SCHEMA.md`

### 4.4. Context Continuity Checklist

When creating or updating a document, verify:
- [ ] All relevant Foundation documents are linked (if applicable)
- [ ] Related Prototype documents are linked (if exist)
- [ ] Related Specs documents are linked (if exist)
- [ ] Related Logic documents are linked (if exist)
- [ ] Related Test documents are linked (if exist)
- [ ] Links use relative paths correctly
- [ ] Each link includes a brief description of the relationship
- [ ] Section references are included when linking to specific parts

## 5. Best Practices

- **Keep it minimal**: Don't write fluff. Be precise.
- **Maintain context continuity**: Always include "Related Documents" section to link across layers.
- **Update the Map**: If you add a major new document, consider updating `docs/01_Concept_Design/04_ROADMAP.md` or a central index if one exists.
- **Preserve existing content**: When updating documents, read existing files first and maintain context and style. Do not overwrite unnecessarily.
- **Follow Interactive Process**: Always ask users key questions before creating Concept_Design or Technical_Specs documents. Never generate documents based solely on assumptions.
- **Update Last Updated date**: When modifying a document, update the "Last Updated" timestamp in the metadata header.
