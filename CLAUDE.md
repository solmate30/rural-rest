# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rural Rest is an Airbnb-style platform for renovated abandoned houses in rural Korea, targeting global travelers seeking authentic experiences. The codebase is Korean-language dominant (UI strings, docs, commit messages).

## Repository Structure

This is a **split-root** project:
- **Root (`/`)** -- Management layer: Git, documentation (`docs/`), project-level config (`AGENTS.md`, `DESIGN.md`)
- **App (`/web/`)** -- Implementation layer: all source code, dependencies, build config
- **Anchor (`/anchor/`)** -- Solana on-chain program (RWA tokenization, USDC escrow, dividend distribution)

Git operations run from root. App commands (`npm run dev`, etc.) run from `web/`. Anchor commands run from `anchor/`.

## Anchor Program

온체인 RWA 프로그램 (`anchor/programs/rural-rest-rwa/src/lib.rs`).
- 개발 가이드 및 Critical Rules: `anchor/CLAUDE.md`
- 기술 명세 (PDA seeds, 수학, 에러코드, 테스트): `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md`
- 보안/CU 감사: `docs/03_Technical_Specs/10_ANCHOR_PROGRAM_AUDIT.md`

## Development Commands

All commands must be run from the `web/` directory:

```bash
npm run dev          # Start dev server (Vite HMR, port 5173)
npm run build        # Production build
npm run start        # Serve production build
npm run typecheck    # react-router typegen && tsc
```

No test runner or linter is currently configured. Type checking is the only verification step.

Database migrations use Drizzle Kit (config at `web/drizzle.config.ts`):
```bash
npx drizzle-kit generate   # Generate migration
npx drizzle-kit push        # Push schema to database
```

### Environment Variables

DB connection uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (not in `.env.example` but required for Turso). Without them, the app falls back to `file:./local.db`. See root `.env.example` for auth/OAuth/Cloudinary vars.

## Tech Stack

- **Framework**: React 19 + React Router 7 (SSR enabled, file-based routing)
- **Database**: Turso (libSQL/SQLite) via Drizzle ORM, falls back to `file:./local.db` for dev
- **Auth**: Better Auth (email/password + Google/Kakao/Twitter OAuth), Drizzle adapter
- **Styling**: Tailwind CSS 3 with custom design tokens, Radix UI primitives
- **Media**: Cloudinary (signed uploads via server-side API route)
- **AI**: LangChain + Google GenAI for concierge chat feature
- **Build**: Vite 7, TypeScript 5.9 (strict mode)

## Architecture

### Routing

Routes are explicitly defined in `app/routes.ts` (not filesystem-convention). Each route file uses React Router v7 loader/action pattern for data fetching and mutations.

Key routes:
- `/` -- Home with smart search and featured stays
- `/auth` -- Login/signup, `/auth/*` -- Better Auth API handler
- `/property/:id` -- Listing detail
- `/book/:id` -- Booking flow
- `/admin` -- Host dashboard, `/admin/edit/:id` -- Listing editor
- `/search` -- Search results with filters
- `/api/sign-cloudinary` -- Cloudinary upload signature endpoint
- `/api/chat/concierge` -- AI concierge chat (LangChain + Google GenAI)

### Auth Pattern

- **Server**: `requireUser(request, allowedRoles?)` in `app/lib/auth.server.ts` for protected routes
- **Client**: `signIn`, `signUp`, `signOut`, `useSession` from `app/lib/auth.client.ts`
- Roles: `guest`, `operator`, `admin`

### Role 정의

| role | 주체 | 설명 |
|------|------|------|
| `guest` | 여행자 / RWA 투자자 | 예약, 투자, DAO 투표 |
| `operator` | 마을운영자 | 현장 운영, 게스트 대면, 정산 수령. `listings.hostId`로 참조됨 |
| `admin` | 루랄레스트 (플랫폼) | 매물 등록, RWA 발행, 전체 관리. listings에 별도 필드 없음 |

### listings.hostId 규칙

`listings.hostId` = **마을운영자** (`operator` role) 계정 ID.
- 게스트가 메시지를 보내는 상대
- 숙소 상세 페이지에 표시되는 "호스트"
- 월 정산 수령자 (영업이익 30%)

admin(플랫폼)은 listings에 별도 필드 없이 role로만 구분. `operatorId` 컬럼은 존재하지 않음.

### Database Schema

Defined in `app/db/schema.ts`. Core tables: `user`, `session`, `account`, `verification` (Better Auth), `listings`, `bookings`, `reviews`, `activities`, `messages`, `transportRequests`.

### UI Components

Custom components live in `app/components/ui-mockup.tsx` (Button, Card, Input, Badge, Slider, Header, Footer). Radix-based components in `app/components/ui/`. Path alias `~/*` maps to `./app/*`.

## Component Guidelines

### Classification
- **UI primitives** (`app/components/ui/`): Single responsibility, controlled only via props, domain-agnostic.
  - Pure UI elements only: `Button`, `Input`, `Modal`, `Badge`, etc.
  - Compound components that require domain knowledge (e.g. `AddressSearch`) belong in domain components.
- **Domain components** (`app/components/{domain}/`): Components that know about specific domain data shapes.
  - Organized by domain subfolder: `listing/`, `booking/`, `investment/`, `village/`
  - e.g. `listing/ListingCard`, `booking/BookingForm`, `investment/PurchaseCard`
- **Route-local components**: UI used only within a single route stays inlined in the route file.
  - Move to one of the above the moment it is used in 2+ routes.

### Server / Client Boundary (React Router 7)
- **`.server.ts` files**: Server-only logic — DB, env, auth. The `@react-router/dev/vite` plugin blocks these from the client bundle at build time. This guarantee depends on the Vite plugin being present; accidentally importing a `.server.ts` file from client code will cause a build error or unintended bundling.
- **All components run on the client** — React Router 7 is not Next.js RSC. There is no `'use client'` directive.
- **Data fetching in loader/action only** — never call DB directly inside a component.
- **Always type loader/action return values**
  - `npm run typecheck` runs `react-router typegen`, which auto-generates `+types/` files.
  - Without `useLoaderData<typeof loader>()`, the inferred type falls back to `unknown`.
  ```ts
  // Good
  export async function loader(): Promise<{ listings: Listing[] }> { ... }
  const { listings } = useLoaderData<typeof loader>();
  ```
- **SSR + browser APIs**: SSR is on by default. Guard any `window`/`document` access:
  ```ts
  // Safe inside useEffect
  useEffect(() => { /* window access OK */ }, []);

  // Or explicit guard
  if (typeof window !== 'undefined') { ... }
  ```

### Custom Hook Extraction
- Extract to a `hooks/` file when component logic exceeds ~30 lines or is reusable.
- Location:
  - Domain-specific: `app/components/{domain}/hooks/`
  - General-purpose: `app/hooks/`
- Components own **rendering only**; hooks own **state, side effects, and API calls**.

### Rules
- If the same component appears in 2+ routes, extract it immediately.
- If a route file's component LOC exceeds 150, consider extraction.
- If props drilling reaches 3 levels, use Context or restructure components.

### Data

Currently uses deterministic mock data from `app/data/listings.ts` for development. Prices in KRW.

## Conventions (from AGENTS.md)

- **No emoji** in code or communication
- **Commit format**: `type(scope): subject` with Korean subject (e.g., `feat(login): 소셜 로그인 API 연동`)
- **Ask before modifying**: Report modification plan and get approval before changing code
- **Evidence-based answers**: Verify current state with tools before answering; no guessing
- **Anti-Rush**: Do not skip ahead or declare steps complete. Stay in the current phase until the user explicitly says to move on. Ask "more to refine?" instead of "shall we proceed?"
- **UI-First development order**: Concept_Design -> UI_Screens -> Technical_Specs -> Logic_Progress

## Design System ("Warm Heritage Minimalism")

Key values from `DESIGN.md`:
- Background: Warm Beige `#fcfaf7` (not white)
- Text: Deep Wood `#4a3b2c` (not black)
- Primary: Green `#17cf54` for actions
- Font: Plus Jakarta Sans
- Border radius: `rounded-xl` (buttons), `rounded-3xl` (cards), `rounded-2xl` (categories)
- Dark mode: class-based, Night Forest `#112116` background

## Documentation (5-Layer Structure)

```
docs/01_Concept_Design/   -- Vision, specs, UI design, roadmap (concept & design guide)
docs/02_UI_Screens/         -- UI prototypes, flow diagrams (page-by-page finished look)
docs/03_Technical_Specs/    -- DB schema, API specs, implementation guides
docs/04_Logic_Progress/   -- Backlog, business logic, state machines, algorithms
docs/05_QA_Validation/    -- Test scenarios, QA checklists (system validation)
docs/06_Pitch/            -- Pitch decks and presentation scripts
```

Files are numbered (e.g., `01_VISION.md`) and must include creation/update dates in `YYYY-MM-DD HH:mm` format.

### 개발 시 필독 문서

기능을 구현하거나 변경할 때 아래 문서를 참고한다:

- `docs/01_Concept_Design/16_BUSINESS_AND_SERVICE_OVERVIEW.md` — 비즈니스 구조, 핵심 5단계 플로우, 역할별 화면 구조
- `docs/01_Concept_Design/17_USER_JOURNEYS.md` — 역할별 유저 여정 (구현 대상이 어느 흐름에 속하는지 확인)

### 문서 업데이트 규칙

기능 구현 완료 후 **`docs/04_Logic_Progress/00_BACKLOG.md` 하나만** 업데이트한다:
1. 완료된 항목 `[ ]` → `[x]` 체크
2. "유저 여정별 미구현 항목" 표에서 해당 줄 제거
3. 새로 발견한 갭이 있으면 추가

비즈니스 구조나 유저 플로우가 바뀔 때만 `23`, `24` 문서를 수정한다.
