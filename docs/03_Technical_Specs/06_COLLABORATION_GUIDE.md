# 협업 가이드 (팀원용)
> Created: 2026-02-18 00:00
> Last Updated: 2026-02-18 00:00

3인 팀 기준의 GitHub 협업 플로우. 프로젝트 클론부터 PR 병합까지의 전 과정을 다룬다.

---

## 0. 사전 준비

아래 도구가 설치되어 있어야 한다.

| 도구 | 버전 | 확인 |
|---|---|---|
| Node.js | 20 이상 | `node -v` |
| Git | 최신 | `git --version` |
| Turso CLI | 최신 | `turso --version` |
| GitHub CLI (선택) | 최신 | `gh --version` |

---

## 1. 초기 세팅

### 1-1. 저장소 클론

```bash
git clone https://github.com/solmate30/rural-rest.git
cd rural-rest
```

### 1-2. 의존성 설치

```bash
cd web
npm install
```

### 1-3. 환경변수 파일 생성

루트의 `.env.example`을 참고해 `web/.env.local`을 직접 생성한다.

```bash
# web/ 디렉토리 안에서 실행
cp ../.env.example .env.local
```

이후 아래 표를 참고해 값을 채운다.

| 변수 | 발급처 | 비고 |
|---|---|---|
| `TURSO_DATABASE_URL` | 팀 리드에게 요청 | 공용 DB |
| `TURSO_AUTH_TOKEN` | 팀 리드에게 요청 | 공용 DB |
| `BETTER_AUTH_SECRET` | 팀 리드에게 요청 | 세션 서명 키, 동일 값 사용 필수 |
| `BETTER_AUTH_URL` | `http://localhost:5173` | 로컬 개발 시 고정 |
| `GOOGLE_CLIENT_ID` | 팀 리드에게 요청 | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | 팀 리드에게 요청 | Google OAuth |
| `KAKAO_CLIENT_ID` | 팀 리드에게 요청 | Kakao OAuth |
| `KAKAO_CLIENT_SECRET` | 팀 리드에게 요청 | Kakao OAuth |
| `CLOUDINARY_*` | 팀 리드에게 요청 | 이미지 업로드 |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) | 개인 발급 가능 |
| `VITE_GOOGLE_MAPS_API_KEY` | 팀 리드에게 요청 | 지도 표시 |
| `LANGSMITH_API_KEY` | [smith.langchain.com](https://smith.langchain.com/) | 선택, 없어도 실행됨 |

### 1-4. 개발 서버 실행

```bash
# web/ 디렉토리 안에서 실행
npm run dev
# → http://localhost:5173
```

---

## 2. 브랜치 전략

```
main ──────────────────────────── 배포 브랜치 (직접 push 금지)
  └── feat/기능명    ─── PR → main
  └── fix/버그명     ─── PR → main
  └── chore/작업명   ─── PR → main
```

### 브랜치 명명 규칙

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feat/` | 새 기능 | `feat/booking-flow` |
| `fix/` | 버그 수정 | `fix/login-redirect` |
| `chore/` | 설정·의존성·문서 | `chore/update-deps` |
| `refactor/` | 리팩토링 | `refactor/auth-module` |

---

## 3. 개발 플로우

### 3-1. 작업 브랜치 생성

항상 최신 `main`에서 분기한다.

```bash
git checkout main
git pull origin main
git checkout -b feat/기능명
```

### 3-2. 커밋

커밋 메시지 형식: `type(scope): 한국어 설명`

```bash
git add 파일명          # git add -A 대신 파일 지정 권장
git commit -m "feat(booking): 날짜 선택 UI 구현"
```

**type 목록**

| type | 설명 |
|---|---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `chore` | 빌드·설정·의존성 변경 |
| `refactor` | 동작 변경 없는 코드 정리 |
| `docs` | 문서 수정 |
| `style` | 포맷·CSS 변경 |

### 3-3. 타입 체크 (커밋 전 권장)

```bash
# web/ 디렉토리 안에서 실행
npm run typecheck
```

### 3-4. 원격 브랜치 push

```bash
git push origin feat/기능명
```

---

## 4. PR (Pull Request)

### 4-1. PR 생성

GitHub 웹 또는 CLI로 생성한다.

```bash
# GitHub CLI 사용 시
gh pr create --base main --title "feat(booking): 예약 흐름 구현" --body "## 변경 사항
- 날짜 선택 UI 추가
- 가격 계산 로직 연결

## 체크리스트
- [ ] typecheck 통과
- [ ] 로컬에서 동작 확인"
```

### 4-2. PR 규칙

- `main` 브랜치에 직접 push 하지 않는다.
- PR은 최소 **1명의 리뷰 승인** 후 병합한다.
- 병합 후 작업 브랜치는 삭제한다.
- 리뷰어는 코드 확인 후 Approve 또는 변경 요청(Request changes)으로 응답한다.

### 4-3. 충돌 해결

```bash
git checkout feat/기능명
git fetch origin
git rebase origin/main   # merge 대신 rebase 권장
# 충돌 해결 후
git rebase --continue
git push origin feat/기능명 --force-with-lease
```

---

## 5. 자주 쓰는 명령 모음

```bash
# 현재 브랜치 확인
git branch

# 원격 브랜치 포함 전체 확인
git branch -a

# 최신 main 반영
git fetch origin && git rebase origin/main

# 스테이징 전 변경사항 확인
git diff

# PR 목록 확인
gh pr list

# 특정 PR 리뷰
gh pr view <번호>
```

---

## 6. 프로젝트 구조 요약

```
rural-rest/
├── web/                  ← 앱 소스 (npm 명령은 여기서)
│   ├── app/
│   │   ├── routes/       ← 페이지 파일
│   │   ├── components/   ← UI 컴포넌트
│   │   ├── db/           ← Drizzle ORM 스키마·클라이언트
│   │   ├── lib/          ← 서버 유틸 (auth, cloudinary 등)
│   │   └── services/     ← AI 등 외부 서비스
│   └── .env.local        ← 환경변수 (git 제외, 직접 생성)
├── docs/                 ← 프로젝트 문서
└── .env.example          ← 환경변수 템플릿 (git 포함)
```

더 자세한 내용은 `docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md` 참고.
