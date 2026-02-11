# Development Principles
> Created: 2026-02-12 00:00
> Last Updated: 2026-02-12 00:00

본 문서는 Rural Rest 코드베이스의 개발 원칙을 정의한다. 코드 일관성, 유지보수성, 안전성을 보장하기 위한 기준이며, 모든 기여자(사람·AI 에이전트)가 따라야 한다.

> **[TODO]** 표시 항목은 현재 미구현이나 향후 적용할 원칙이다. 구현 시 태그를 제거한다.

---

## 1. Project Structure

### 1.1. Split-Root 규칙

```
/ (Root)           -- Git, docs/, 프로젝트 설정 (CLAUDE.md, DESIGN.md)
/web/ (App Root)   -- 모든 소스 코드, 의존성, 빌드 설정
```

- Git 명령은 루트(`/`)에서 실행한다.
- 앱 명령(`npm run dev`, `npx drizzle-kit` 등)은 `web/`에서 실행한다.
- 두 레이어를 혼합하지 않는다.

### 1.2. Git 제외 대상 (`.gitignore`)

아래 파일/디렉토리는 로컬 전용이며 Git에 커밋하지 않는다.

| 대상 | 사유 |
|:---|:---|
| `.agent/` | AI 에이전트 스킬 정의 (로컬 워크플로우 설정) |
| `.claude/` | Claude Code 커맨드 및 설정 (개인 환경) |
| `.vscode/` | VS Code 에디터 설정 (개인 환경) |
| `AGENTS.md` | AI 에이전트 행동 규칙 (로컬 전용) |
| `CLAUDE.md` | Claude Code 프로젝트 컨텍스트 (로컬 전용) |

> **DESIGN.md**와 **docs/** 디렉토리는 프로젝트 공유 자산이므로 Git에 포함한다.

### 1.3. App Directory 구조

```
web/app/
  components/      -- UI 컴포넌트 (ui-mockup.tsx, ui/, 기능별 컴포넌트)
  data/            -- Mock 데이터, 타입 정의
  db/              -- Drizzle ORM 설정, 스키마
  hooks/           -- 커스텀 React 훅
  lib/             -- 유틸리티, 서버 전용 로직
  routes/          -- React Router v7 라우트 핸들러
  services/        -- 비즈니스 로직 서비스 (AI 등)
```

**조직 원칙**: Type-based 최상위 구조 + 서비스별 하위 그룹핑.

### 1.4. 파일 네이밍

| 유형 | 패턴 | 예시 |
|:---|:---|:---|
| 서버 전용 | `*.server.ts` | `auth.server.ts`, `concierge.server.ts` |
| 클라이언트 전용 | `*.client.ts` | `auth.client.ts` |
| 컴포넌트 | PascalCase `.tsx` | `AiConcierge.tsx`, `PropertyMap.tsx` |
| 훅 | `use-*.ts` (kebab-case) | `use-cloudinary-upload.ts`, `use-toast.ts` |
| 유틸리티 | camelCase `.ts` | `utils.ts`, `listings.ts` |
| 라우트 | dot-notation `.tsx` | `admin.dashboard.tsx`, `api.chat.concierge.ts` |

---

## 2. Import Rules

### 2.1. Path Alias 통일

**규칙: `~/` 경로 별칭을 항상 사용한다. 상대 경로(`../`)를 사용하지 않는다.**

```typescript
// GOOD
import { Button } from "~/components/ui-mockup";
import { requireUser } from "~/lib/auth.server";
import { cn } from "~/lib/utils";

// BAD
import { Button } from "../components/ui-mockup";
import { requireUser } from "../lib/auth.server";
```

> 현재 코드베이스에 상대 경로가 혼용되어 있다. 해당 파일 수정 시 `~/`로 점진적 변환한다.

### 2.2. Import 순서

```typescript
// 1) React / React Router (프레임워크)
import { useState, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";

// 2) 외부 라이브러리
import { Search, Calendar } from "lucide-react";

// 3) 내부 모듈 (~/...)
import { Header, Button } from "~/components/ui-mockup";
import { requireUser } from "~/lib/auth.server";
import { cn } from "~/lib/utils";

// 4) 타입 (type-only import)
import type { Route } from "./+types/property";
import type { Listing } from "~/data/listings";
```

---

## 3. Server / Client Boundary

### 3.1. 분리 원칙

| 경계 | 접근 가능 | 접근 불가 |
|:---|:---|:---|
| `*.server.ts` | `loader()`, `action()`, 다른 `.server.ts` | 클라이언트 컴포넌트, 브라우저 API |
| `*.client.ts` | 클라이언트 컴포넌트, 브라우저 API | `loader()`, `action()` |
| 일반 `*.ts` | 양쪽 모두 | - |

### 3.2. 데이터 흐름

```
[Server]                          [Client]
loader() / action()  ---->  useLoaderData() / useActionData()
     |                              |
  DB 쿼리, 외부 API             useState, useEffect
  인증 검사                      UI 상태 관리
  env 변수 접근                  브라우저 API
```

- **DB 접근, 인증, 환경변수**: 반드시 `.server.ts` 또는 `loader()`/`action()` 내에서만.
- **브라우저 API (localStorage, window)**: 반드시 클라이언트 컴포넌트 또는 `.client.ts` 내에서만.

---

## 4. State Management

### 4.1. 원칙: Server-First

| 상태 유형 | 관리 방식 |
|:---|:---|
| 서버 데이터 (리스팅, 예약, 사용자) | `loader()` + `useLoaderData()` |
| 서버 뮤테이션 (예약 생성, 리뷰 작성) | `action()` + `useActionData()` |
| UI 상태 (모달, 필터, 입력) | `useState` (로컬) |
| 재사용 가능한 상태 로직 | 커스텀 훅 (`hooks/`) |

### 4.2. 금지 사항

- 전역 상태 라이브러리(Redux, Zustand) 도입 금지. React Router의 loader/action 패턴으로 충분하다.
- `useEffect`로 데이터 fetching 금지. `loader()`를 사용한다.
- 클라이언트에서 API를 직접 호출하여 서버 데이터를 변경하지 않는다. `action()`을 사용한다. (AI 컨시어지 채팅 등 스트리밍 인터랙션은 예외)

---

## 5. Component Patterns

### 5.1. 기본 규칙

- **함수형 컴포넌트만** 사용한다. Class 컴포넌트, HOC, render props 금지.
- **Props 타이핑**: 인라인 intersection 타입 또는 별도 interface. `any` 사용 금지.

```typescript
// GOOD: 인라인 intersection
export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
}) { ... }

// GOOD: 별도 interface (props가 3개 이상일 때)
interface PropertyCardProps {
  readonly listing: Listing;
  readonly onSelect?: (id: string) => void;
  readonly className?: string;
}
export function PropertyCard({ listing, onSelect, className }: PropertyCardProps) { ... }
```

### 5.2. 컴포넌트 계층

```
ui/                -- Radix UI 기반 프리미티브 (shadcn/ui 패턴)
ui-mockup.tsx      -- 커스텀 디자인 시스템 컴포넌트 (Button, Card 등)
[Feature].tsx      -- 기능별 컴포넌트 (AiConcierge, PropertyMap 등)
routes/*.tsx       -- 페이지 컴포넌트 (라우트 핸들러)
```

- `ui/`: 디자인 시스템의 원자(atom) 수준. `cn()` 유틸로 클래스 합성.
- `ui-mockup.tsx`: 프로젝트 고유 디자인 토큰 적용 컴포넌트.
- 기능 컴포넌트: 내부 상태와 로직 포함 가능.
- 라우트: `loader`/`action` + 페이지 레이아웃 조합.

---

## 6. Error Handling

### 6.1. Server-Side (Loader / Action)

**리소스 없음**: `throw new Response()`

```typescript
export async function loader({ params }: Route.LoaderArgs) {
  const listing = await getListingById(params.id);
  if (!listing) {
    throw new Response("Not Found", { status: 404 });
  }
  return { listing };
}
```

**유효성 검증 실패**: 에러 객체 반환 (throw 아님)

```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (!formData.get("checkIn")) {
    return { success: false as const, error: "체크인 날짜를 입력해 주세요." };
  }
  // ... 정상 처리
  return { success: true as const, data: booking };
}
```

**인증/인가 실패**: `requireUser()`가 자동 redirect 처리.

### 6.2. API Routes

**일관된 응답 형식**:

```typescript
// 성공
return Response.json({ data: result });

// 에러
return Response.json(
  { error: "에러 메시지" },
  { status: 400 | 401 | 403 | 500 }
);
```

**외부 서비스 호출 시 try-catch 필수**:

```typescript
try {
  const result = await externalService();
  return Response.json({ data: result });
} catch (error) {
  console.error("[ServiceName] error:", error);
  return Response.json(
    { error: "서비스 처리 중 오류가 발생했습니다." },
    { status: 500 }
  );
}
```

### 6.3. Client-Side

**커스텀 훅 에러 처리**: try-catch + 콜백 패턴.

```typescript
try {
  const res = await fetch("/api/...");
  if (!res.ok) throw new Error("요청에 실패했습니다.");
  // ...
} catch (err) {
  const message = err instanceof Error ? err.message : "알 수 없는 오류";
  options.onError?.(message);
}
```

### 6.4. [TODO] Error Boundary

- React Router의 `ErrorBoundary` export를 라우트별로 구현한다.
- 404, 500 등 상태 코드별 사용자 친화적 에러 페이지를 제공한다.
- `app/root.tsx`에 글로벌 에러 바운더리를 설정한다.

---

## 7. Type Safety

### 7.1. 엄격 모드

- `tsconfig.json`의 `strict: true` 유지.
- `as string`, `as any` 타입 단언 최소화. 불가피한 경우 주석으로 사유 명시.

### 7.2. Route Types

- React Router v7의 자동 생성 타입(`./+types/[route]`)을 사용한다.
- `npm run typecheck` (`react-router typegen && tsc`)로 검증한다.

```typescript
import type { Route } from "./+types/property";

export async function loader({ params }: Route.LoaderArgs) { ... }
export default function PropertyPage({ loaderData }: Route.ComponentProps) { ... }
```

### 7.3. [TODO] Environment Variable Validation

현재 `process.env.*`를 `as string` 단언으로 접근 중. Zod 스키마로 검증 계층을 추가한다.

```typescript
// [TODO] web/app/lib/env.server.ts
import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  TURSO_DATABASE_URL: z.string().url().optional().default("file:./local.db"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  // ...
});

export const env = envSchema.parse(process.env);
```

---

## 8. Database & ORM

### 8.1. Drizzle ORM 규칙

- 스키마 정의: `web/app/db/schema.ts` 단일 파일.
- DB 인스턴스: `web/app/db/index.server.ts` (서버 전용).
- 마이그레이션: `npx drizzle-kit generate` -> `npx drizzle-kit push`.

### 8.2. 쿼리 위치

| 쿼리 유형 | 위치 |
|:---|:---|
| 단순 조회 (1-2줄) | `loader()` 내 인라인 |
| 복잡한 쿼리 / 재사용 | `lib/*.server.ts` 함수로 분리 |
| AI 서비스 관련 | `services/ai/*.server.ts` |

```typescript
// 단순: loader 내 인라인
const listings = await db.select().from(listingsTable).where(eq(listingsTable.hostId, user.id));

// 복잡: 별도 함수
// lib/admin-dashboard.server.ts
export async function getDashboardStats(userId: string): Promise<DashboardStats> { ... }
```

### 8.3. 스키마 변경 절차

1. `web/app/db/schema.ts` 수정
2. `npx drizzle-kit generate` (마이그레이션 생성)
3. `npx drizzle-kit push` (DB 반영)
4. `docs/03_Technical_Specs/01_DB_SCHEMA.md` 문서 갱신
5. `npm run typecheck` (타입 검증)

---

## 9. Styling

### 9.1. Tailwind CSS 규칙

- **DESIGN.md를 따른다.** 임의의 색상값(`#ff0000`) 대신 디자인 토큰 사용.
- **클래스 합성**: `cn()` 유틸리티 사용 (clsx + tailwind-merge).

```typescript
import { cn } from "~/lib/utils";

<div className={cn("rounded-xl bg-background-light", className)} />
```

### 9.2. 디자인 토큰 (DESIGN.md 기반)

| 토큰 | 값 | 용도 |
|:---|:---|:---|
| `bg-background-light` | `#fcfaf7` | 메인 배경 (Warm Beige) |
| `text-deep-wood` | `#4a3b2c` | 주요 텍스트 |
| `bg-primary` | `#17cf54` | 액션 버튼, 활성 상태 |
| `text-warm-gray` | `#7a7267` | 보조 텍스트, 아이콘 |
| `bg-night-forest` | `#112116` | 다크 모드 배경 |

### 9.3. Border Radius 규칙

| 컴포넌트 | 클래스 |
|:---|:---|
| 버튼 | `rounded-xl` |
| 카드 | `rounded-3xl` |
| 카테고리 | `rounded-2xl` |
| 아이콘 버튼 | `rounded-full` |
| 입력 필드 | `rounded-xl` |

---

## 10. Authentication & Authorization

### 10.1. 서버 측 보호

모든 보호된 라우트의 `loader()`/`action()` 첫 줄에서 `requireUser()` 호출.

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);           // 로그인 필수
  // 또는
  const user = await requireUser(request, ["host"]); // 특정 역할 필수
  // ...
}
```

### 10.2. 역할 체계

| 역할 | 권한 |
|:---|:---|
| `guest` | 검색, 상세 조회, 예약, 리뷰 작성 |
| `host` | guest 권한 + 리스팅 관리, 대시보드 |
| `admin` | 전체 권한 |

### 10.3. 클라이언트 측

```typescript
import { signIn, signUp, signOut, useSession } from "~/lib/auth.client";
```

- `useSession()`으로 로그인 상태 확인.
- 민감한 데이터 접근은 반드시 서버 측(`requireUser()`)에서 검증. 클라이언트 체크는 UX 용도로만 사용.

---

## 11. Commit Convention

```
type(scope): 한국어 제목

type: feat | fix | refactor | docs | style | test | chore
scope: 변경 대상 모듈 (login, booking, admin, ai-concierge 등)
```

예시:
```
feat(booking): 예약 취소 기능 추가
fix(auth): 카카오 로그인 리다이렉트 오류 수정
refactor(search): 필터링 로직 분리
docs(specs): DB 스키마 문서 갱신
```

---

## 12. [TODO] Future Improvements

| 항목 | 우선순위 | 설명 |
|:---|:---:|:---|
| Error Boundary | High | 라우트별 에러 바운더리 + 글로벌 fallback |
| Env Validation | High | Zod 스키마 기반 환경변수 검증 (Section 7.3) |
| ESLint + Prettier | Medium | 코드 스타일 자동 검사/포맷팅 |
| Vitest 설정 | Medium | 유닛/통합 테스트 인프라 |
| API Response Wrapper | Low | 표준화된 `{ data, error, meta }` 응답 유틸 |
| Import 정리 | Low | 기존 상대 경로를 `~/` 별칭으로 일괄 변환 |

---

## 13. Related Documents

### Concept_Design
- **Concept_Design**: [Site Overview](../01_Concept_Design/00_SITE_OVERVIEW.md) - 사이트 아키텍처 및 기술 스택 개요
- **Concept_Design**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 명세 (구현 대상 정의)
- **Concept_Design**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 기준 (Section 9 근거)

### Technical_Specs (같은 레이어)
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 데이터베이스 스키마 명세 (Section 8 근거)
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - API 엔드포인트 명세 (Section 6.2 근거)
- **Technical_Specs**: [Storage Policy](./03_STORAGE_POLICY.md) - 이미지/파일 저장 정책
- **Technical_Specs**: [AI Concierge Spec](./04_AI_CONCIERGE_SPEC.md) - AI 서비스 아키텍처

### Logic_Progress
- **Logic_Progress**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - TODO 항목 추적 (Section 12 연동)
- **Logic_Progress**: [Auth & Session Logic](../04_Logic_Progress/06_AUTH_AND_SESSION_LOGIC.md) - 인증 로직 상세 (Section 10 근거)

### QA_Validation
- **QA_Validation**: [QA Checklist](../05_QA_Validation/02_QA_CHECKLIST.md) - 릴리스 기준 체크리스트

### Root-Level Config
- **CLAUDE.md** - AI 에이전트 프로젝트 맥락 (본 문서의 요약 포함)
- **DESIGN.md** - 디자인 시스템 토큰 원본 (Section 9 원천)
