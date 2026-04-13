# Rural Rest

**Airbnb-style platform for renovated abandoned houses in rural Korea**

Connecting global travelers with authentic hanok and farmhouse stays — curated experiences that blend traditional heritage with modern comfort.

---

## What It Does

Browse and book one-of-a-kind rural Korean stays, and invest in the properties you love:

1. **Discover** curated hanok, farmhouse, and modern-rural listings with rich stories and galleries
2. **Book** with USDC escrow on Solana — funds held securely until check-in confirmed
3. **Invest** via on-chain RWA tokenization — own a fractional share, earn dividends
4. **Host** — local operators manage listings, approve bookings, and track settlements
5. **Concierge** — AI assistant (LangChain + Google GenAI) answers guest questions in real time

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend / Fullstack | React 19, React Router 7 (SSR), TypeScript, Tailwind CSS |
| Database | Turso (libSQL), Drizzle ORM |
| Auth | Better Auth — email/password + Google / Kakao / Twitter OAuth |
| Media | Cloudinary (signed uploads) |
| Blockchain | Solana, Anchor, USDC (SPL Token), Solana Pay / Blinks |
| AI | LangChain, Google GenAI |
| Utilities | Luxon, Zod, Vite 7 |

---

## Architecture

```
/                    # Project root — Git, docs, config
├── docs/            # 5-layer documentation
├── web/             # React Router 7 application (SSR)
│   ├── app/routes/  # Loader/action-based file routing
│   ├── app/db/      # Drizzle schema + Turso client
│   └── app/lib/     # Auth, constants, utilities
└── anchor/          # Solana on-chain program (RWA, USDC escrow)
```

**Core flow:** Guest searches → books with USDC escrow → host approves → escrow releases (90% host / 10% treasury) → review

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/solmate30/rural-rest.git
cd rural-rest/web
npm install
cp ../.env.example .env   # fill in required values
npm run dev
# http://localhost:5173
```

### Database

```bash
npx drizzle-kit generate   # Generate migration
npx drizzle-kit push       # Push schema to Turso
```

### Production Build

```bash
npm run build
npm run start
```

---

## Scripts (`web/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with HMR (port 5173) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run typecheck` | react-router typegen + TypeScript check |

---

## Anchor Program (`anchor/`)

On-chain RWA program handling tokenization, USDC escrow, and dividend distribution.

```bash
cd anchor
anchor build
anchor test
```

See `anchor/CLAUDE.md` and `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` for full spec.

---
---

# Rural Rest (한국어)

**한국 시골 빈집 리모델링 숙소 예약 플랫폼**

한옥·농가주택을 글로벌 여행자와 연결합니다. 전통과 현대 편의를 결합한 "Warm Heritage Minimalism" 큐레이션 숙소 경험.

---

## 주요 기능

숙소 예약부터 온체인 투자까지:

1. **디스커버리** — 한옥·농가·모던 카테고리 큐레이션 피드, 스토리·갤러리 상세 페이지
2. **예약** — Solana USDC 에스크로 결제, 체크인 확정 전 자금 안전 보관
3. **투자** — 온체인 RWA 토큰화로 지분 보유 및 배당 수익
4. **호스트** — 숙소 관리, 예약 승인, 정산 내역 조회
5. **AI 컨시어지** — LangChain + Google GenAI 기반 게스트 실시간 질의응답

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트/풀스택 | React 19, React Router 7 (SSR), TypeScript, Tailwind CSS |
| DB | Turso (libSQL), Drizzle ORM |
| 인증 | Better Auth — 이메일/비밀번호 + Google / Kakao / Twitter OAuth |
| 미디어 | Cloudinary (서명된 업로드) |
| 블록체인 | Solana, Anchor, USDC (SPL Token), Solana Pay / Blinks |
| AI | LangChain, Google GenAI |
| 유틸리티 | Luxon, Zod, Vite 7 |

---

## 아키텍처

```
/                    # 프로젝트 루트 — Git, 문서, 설정
├── docs/            # 5단계 문서 구조
├── web/             # React Router 7 앱 (SSR)
│   ├── app/routes/  # Loader/action 기반 라우팅
│   ├── app/db/      # Drizzle 스키마 + Turso 클라이언트
│   └── app/lib/     # 인증, 상수, 유틸리티
└── anchor/          # Solana 온체인 프로그램 (RWA, USDC 에스크로)
```

**핵심 플로우:** 게스트 검색 → USDC 에스크로 결제 → 호스트 승인 → 에스크로 릴리즈 (90% 호스트 / 10% 트레저리) → 리뷰

---

## 시작하기

### 요구 사항

- Node.js 18+
- npm

### 설치 및 실행

```bash
git clone https://github.com/solmate30/rural-rest.git
cd rural-rest/web
npm install
cp ../.env.example .env   # 필요한 값 입력
npm run dev
# http://localhost:5173
```

### 데이터베이스

```bash
npx drizzle-kit generate   # 마이그레이션 생성
npx drizzle-kit push       # Turso에 스키마 반영
```

### 프로덕션 빌드

```bash
npm run build
npm run start
```

---

## 스크립트 (`web/`)

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (HMR, 포트 5173) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과물 서빙 |
| `npm run typecheck` | 타입 생성 및 TypeScript 검사 |

---

## Anchor 프로그램 (`anchor/`)

RWA 토큰화, USDC 에스크로, 배당 분배를 처리하는 온체인 프로그램.

```bash
cd anchor
anchor build
anchor test
```

상세 명세는 `anchor/CLAUDE.md` 및 `docs/03_Technical_Specs/11_ANCHOR_PROGRAM_SPEC.md` 참고.
