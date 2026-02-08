# Rural Rest

프리미엄 예약 플랫폼으로, 한국 시골의 리모델링된 빈집(한옥·농가주택)과 글로벌 여행자를 연결합니다. "Warm Minimalist" 톤으로 전통과 현대 편의를 결합한 숙소 큐레이션과 예약 경험을 제공합니다.

**슬로건:** 빈집의 재탄생, 연결의 부활 (Rebirth of Empty Houses, Revival of Connections)

---

## 주요 기능

- **디스커버리:** 한옥·모던·농가 등 큐레이션된 숙소 목록 및 홈 피드
- **검색·필터:** 지역·가격 기준 실시간 필터, 검색 결과 페이지
- **숙소 상세:** 스토리·갤러리·편의시설·예약 위젯
- **예약 플로우:** 일정 선택 및 결제 요약
- **인증:** Better Auth 기반 이메일·Google·Kakao·Twitter 로그인
- **관리자:** 호스트 대시보드·숙소 편집·Cloudinary 미디어 관리

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트/풀스택 | React 19, React Router 7, TypeScript, Tailwind CSS |
| DB | Turso (libSQL), Drizzle ORM |
| 인증 | Better Auth |
| 미디어 | Cloudinary |
| 기타 | Luxon(날짜/시간), Zod(스키마 검증), Vite 7 |

---

## 저장소 구조 (Monorepo)

- **루트 (`/`)**: 프로젝트 관리·문서·설정
  - `docs/`: 5단계 문서 구조 (Foundation, Prototype, Specs, Logic, Test)
  - `AGENTS.md`, `CLAUDE.md`: AI·개발 규칙 및 컨벤션
  - `.env.example`: 환경 변수 템플릿 (실제 값은 커밋하지 않음)
- **앱 (`/rural-rest-v2`)**: 구현 코드
  - React Router SPA/SSR, 라우트·컴포넌트·API·DB 스키마·스타일

배포 시 루트가 아닌 **앱 디렉터리(`rural-rest-v2`)를 루트로** 사용하는 것을 권장합니다.

---

## 시작하기

### 요구 사항

- Node.js 18+
- npm (또는 호환 패키지 매니저)

### 설치 및 실행

1. 저장소 클론 후 앱 디렉터리로 이동:

   ```bash
   cd rural-rest-v2
   ```

2. 의존성 설치:

   ```bash
   npm install
   ```

3. 환경 변수 설정:
   - 프로젝트 **루트**의 `.env.example`을 참고하여 `rural-rest-v2/` 또는 루트에 `.env` 또는 `.env.local` 생성
   - Better Auth, OAuth(Google/Kakao/Twitter), Cloudinary, Turso 등 필요한 값만 채워도 됨

4. 개발 서버 실행:

   ```bash
   npm run dev
   ```

   기본 주소: `http://localhost:5173`

### 프로덕션 빌드

```bash
cd rural-rest-v2
npm run build
npm run start
```

Docker 사용 시 `rural-rest-v2/Dockerfile` 및 해당 디렉터리의 `README.md`를 참고하세요.

---

## 문서

상세 기획·명세·비즈니스 로직은 `docs/` 아래 5단계 구조로 정리되어 있습니다.

| 계층 | 경로 | 내용 |
|------|------|------|
| 1. Foundation | `docs/01_Foundation/` | 비전, 린 캔버스, 제품 명세, UI 디자인, 로드맵 |
| 2. Prototype | `docs/02_Prototype/` | 랜딩·상세·예약·관리자 등 프로토타입 리뷰 |
| 3. Specs | `docs/03_Specs/` | DB 스키마, API, 스토리지, 검색/상세 구현 가이드 |
| 4. Logic | `docs/04_Logic/` | 예약 상태, 검색·필터, 인증·세션, AI 컨시어지 등 로직 |
| 5. Test | `docs/05_Test/` | 테스트 시나리오, QA 체크리스트, 리뷰 문서 |

새 기능 구현 전에는 해당 계층 문서를 먼저 확인하는 것을 권장합니다.

---

## 스크립트 (rural-rest-v2)

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (HMR) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과물 서빙 |
| `npm run typecheck` | 타입 생성 및 TypeScript 검사 |

---

## Git 및 환경 변수

- 커밋 메시지: `type(scope): 한글 설명` (Conventional Commits, 상세 내용은 `-` 로 3줄 이상 권장)
- `.env*` 파일은 Git에 커밋하지 않으며, `.env.example`만 템플릿으로 관리합니다.

---

## 라이선스

Private. 사용·배포 조건은 저장소 소유자에게 문의하세요.
