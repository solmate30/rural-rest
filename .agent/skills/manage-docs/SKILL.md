---
name: manage-docs
description: Create and manage project documentation according to the 5-layer standard (Foundation, Prototype, Specs, Logic, Test). Use when the user asks to document features, update documentation, create spec files, or manage project docs.
---

# Documentation Management Skill

This skill helps you maintain the project's documentation structure, ensuring consistency and adherence to the **5-Layer Documentation Standard**.

## 1. Structure Overview

All documentation must reside in `docs/` and follow this hierarchy:

| Layer | Directory | Purpose | Examples |
| :--- | :--- | :--- | :--- |
| **Root (Mgmt)** | `/` | **Project Management.** Git, Specs, Rules. | `AGENTS.md`, `docs/`, `.git/` |
| **App (Impl)** | `/app-name/` | **Implementation.** Source Code, Build Config. | `src/`, `package.json`, `vite.config.ts` |
| **Foundation** | `docs/01_Foundation/` | **Planning, Purpose, UI Design.** The "Constitution". | `01_LEAN_CANVAS.md`, `02_PRODUCT_SPECS.md`, `03_ROADMAP.md` |
| **Prototype** | `docs/02_Prototype/` | **UI Results, Screen Flows.** The "Visual Proof". | `PROTOTYPE_REVIEW.md`, `SCREEN_FLOW.md` |
| **Specs** | `docs/03_Specs/` | Detailed feature specifications, API inputs/outputs. The "Blueprints". | `auth_flow.md`, `db_schema.md` |
| **Logic** | `docs/04_Logic/` | **Business Rules, Algorithms.** The "Brain". | `business_rules.md`, `state_management.md` |
| **Test** | `docs/05_Test/` | Test scenarios, checklists, bug reports. The "Audit Trails". | `release_checklist.md` | |

## 2. Usage Instructions

When the user asks to "document X" or "update documentation for X", follow these steps:

1.  **Identify the Layer**: Determine which of the 5 layers the document belongs to.
    *   Is it high-level planning or UI Design? -> **01_Foundation**
    *   Is it a result of UI prototyping? -> **02_Prototype**
    *   Is it a detailed implementation spec? -> **03_Specs**
    *   Is it business logic, state management, or algorithm design? -> **04_Logic**
    *   Is it a test plan or QA report? -> **05_Test**

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
        6.  **Success (Strategy & Metrics)**: What are the KPIs? What are the biggest risks? Maintenance plan?
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

## 3. Templates

### (A) Foundation Templates (`docs/01_Foundation/`)
Required Documents:
1.  **`01_LEAN_CANVAS.md`**: Problem, Solution, UVP, Metrics
2.  **`02_PRODUCT_SPECS.md`**: MVP Definition, Core Features
3.  **`03_ROADMAP.md`**: Now / Next / Later Strategy
4.  **`04_UI_DESIGN.md`**: Design Guidelines

```markdown
# [Title: Lean Canvas / Product Specs / Roadmap]
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]
...
```

### (B) Prototype Template (`docs/02_Prototype/`)
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
```

### (C) Specs Template (`docs/03_Specs/`)
Used for: Feature Specs, API Design, Database Schema

```markdown
# [Feature Name] Specification
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]
...
```

### (D) Logic Template (`docs/04_Logic/`)
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

## 2. Business Rules
- [ ] Rule 1: (e.g., Cancellation is free until 24 hours before)
- [ ] Rule 2: (e.g., Login required for payment)

## 3. Data Flow & State
(How does data move? State machine diagram if needed)

## 4. Algorithm / Pseudo-code
(Step-by-step logic description)
```

### (E) Test Template (`docs/05_Test/`)
Used for: Test Plans, Checklists, Bug Reports

```markdown
# Test Report / Plan: [Feature Name]
> Created: [YYYY-MM-DD HH:mm]
> Last Updated: [YYYY-MM-DD HH:mm]
...
```

## 4. Best Practices

- **Keep it minimal**: Don't write fluff. Be precise.
- **Link related docs**: A Spec should link back to its Foundation document if relevant.
- **Update the Map**: If you add a major new document, consider updating `docs/01_Foundation/03_ROADMAP.md` or a central index if one exists.
- **Preserve existing content**: When updating documents, read existing files first and maintain context and style. Do not overwrite unnecessarily.
- **Follow Interactive Process**: Always ask users key questions before creating Foundation or Specs documents. Never generate documents based solely on assumptions.
