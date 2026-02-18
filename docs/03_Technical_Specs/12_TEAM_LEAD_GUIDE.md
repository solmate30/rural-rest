# 팀장 운영 가이드
> Created: 2026-02-18 00:00
> Last Updated: 2026-02-18 00:00

3인 팀 기준. 팀장(프로젝트 오너)의 권한과 책임, 반복 작업 절차를 정리한다.

---

## 1. 팀원 온보딩

### 1-1. GitHub 저장소 접근 권한 부여

```bash
# GitHub 웹: Settings → Collaborators → Add people
# 또는 GitHub CLI
gh api repos/solmate30/rural-rest/collaborators/팀원_github_ID \
  -X PUT -f permission=write
```

권한 레벨 기준:

| 레벨 | 부여 대상 | 가능한 작업 |
|---|---|---|
| `write` | 일반 팀원 | 브랜치 push, PR 생성·리뷰 |
| `admin` | 팀장 본인 | 설정 변경, 브랜치 보호 규칙 관리 |

### 1-2. 환경변수 공유

팀원에게 아래 값을 **안전한 채널**(카카오톡 비밀 채팅, Notion 비공개 페이지 등)로 전달한다.
절대 이메일·Slack 공개 채널·PR 코멘트에 붙여넣지 않는다.

```bash
# 현재 Turso 연결 정보 확인
turso db show rural-rest

# 토큰 신규 발급 (팀원별로 별도 발급 권장)
turso db tokens create rural-rest --expiration none
```

전달 목록:

| 변수 | 비고 |
|---|---|
| `TURSO_DATABASE_URL` | 공용 (모두 동일) |
| `TURSO_AUTH_TOKEN` | 팀원별 개별 발급 권장 |
| `BETTER_AUTH_SECRET` | 공용 (모두 동일값 필수) |
| `GOOGLE_CLIENT_ID/SECRET` | 공용 |
| `KAKAO_CLIENT_ID/SECRET` | 공용 |
| `CLOUDINARY_*` | 공용 |
| `VITE_GOOGLE_MAPS_API_KEY` | 공용 |

### 1-3. Vercel 팀 접근 (선택)

Vercel 대시보드에서 팀원을 초대하면 배포 로그·환경변수를 함께 볼 수 있다.

```
Vercel Dashboard → rural-rest → Settings → Members → Invite
```

---

## 2. 브랜치 보호 규칙 설정

`main` 브랜치에 실수로 직접 push 되지 않도록 보호 규칙을 설정한다.

```
GitHub → Settings → Branches → Add branch ruleset
  - Branch name pattern: main
  - ✅ Require a pull request before merging
  - ✅ Require approvals: 1
  - ✅ Require status checks to pass (typecheck 추가 시)
  - ✅ Block force pushes
```

---

## 3. PR 리뷰 절차

### 3-1. 리뷰 기준

| 항목 | 확인 내용 |
|---|---|
| 동작 | 로컬에서 직접 확인했는가 |
| 타입 | `npm run typecheck` 통과 여부 |
| 범위 | 요청된 작업 외의 불필요한 변경이 없는가 |
| 보안 | 시크릿·API 키가 코드에 하드코딩되지 않았는가 |
| 충돌 | `main`과 충돌이 없는가 |

### 3-2. 리뷰 커맨드

```bash
# PR 목록 확인
gh pr list

# PR 코드 로컬에서 체크아웃
gh pr checkout <번호>

# 승인
gh pr review <번호> --approve

# 변경 요청
gh pr review <번호> --request-changes --body "이유 작성"

# 병합 (Squash merge 권장 - 커밋 히스토리 간결 유지)
gh pr merge <번호> --squash --delete-branch
```

### 3-3. 병합 전략

**Squash merge** 사용을 권장한다.

- 작업 브랜치의 잡다한 커밋들이 `main`에 하나의 커밋으로 정리됨
- `git log --oneline`으로 기능 단위 히스토리 추적 가능

---

## 4. 배포 관리

### 4-1. 배포 흐름

```
feat/* 브랜치 push
  → Vercel Preview 자동 배포 (PR URL로 확인 가능)
  → PR 승인 후 main merge
  → Vercel Production 자동 배포
```

### 4-2. Vercel 환경변수 추가·수정

팀원이 새 기능에서 환경변수를 추가했다면, 배포 전 Vercel에도 등록한다.

```
Vercel Dashboard → rural-rest → Settings → Environment Variables
```

추가 후 `.env.example`도 함께 업데이트한다.

```bash
# .env.example 수정 후 커밋
git add .env.example
git commit -m "chore: 환경변수 NEW_VAR 추가"
```

### 4-3. 배포 실패 시 롤백

```bash
# Vercel CLI로 이전 배포로 롤백
vercel rollback

# 또는 GitHub에서 이전 커밋으로 revert PR 생성
git revert <문제 커밋 해시>
git push origin main
```

---

## 5. 데이터베이스 관리

### 5-1. 스키마 변경 시 절차

팀원이 `app/db/schema.ts`를 수정한 경우, 팀장이 직접 DB에 적용한다.

```bash
# 변경 내용 확인
git diff app/db/schema.ts

# Turso에 직접 적용 (drizzle-kit push가 안 될 경우)
turso db shell rural-rest "ALTER TABLE ..."

# 또는 migration 파일 생성 후 적용
cd web
npx drizzle-kit generate
turso db shell rural-rest < drizzle/새_마이그레이션.sql
```

### 5-2. 현재 테이블 상태 확인

```bash
turso db shell rural-rest "SELECT name FROM sqlite_master WHERE type='table';"
```

### 5-3. 운영 데이터 직접 조작 시 주의

```bash
# 반드시 SELECT로 먼저 확인 후 수정
turso db shell rural-rest "SELECT * FROM user WHERE email = 'xxx';"

# UPDATE/DELETE는 WHERE 조건 필수
turso db shell rural-rest "UPDATE listings SET status = 'inactive' WHERE id = 'xxx';"
```

---

## 6. 정기 유지보수 체크리스트

### 주간

- [ ] 열린 PR 확인 및 리뷰 처리
- [ ] Vercel 배포 로그에서 에러 없는지 확인
- [ ] 오래된 작업 브랜치 정리

```bash
# 병합 완료된 브랜치 원격에서 삭제
git fetch --prune
git branch -r --merged main | grep -v main | sed 's/origin\///' | xargs -I {} gh api repos/solmate30/rural-rest/git/refs/heads/{} -X DELETE
```

### 월간

- [ ] Turso 토큰 만료 여부 확인 및 재발급
- [ ] npm 패키지 취약점 점검

```bash
cd web && npm audit
```

- [ ] `.env.example`이 실제 사용 변수와 일치하는지 확인

---

## 7. 트러블슈팅 치트시트

| 상황 | 조치 |
|---|---|
| 팀원 `npm run dev` 안됨 | `web/.env.local` 누락 여부 확인 |
| Vercel 500 에러 | 환경변수 누락 확인 → Redeploy |
| DB 연결 실패 | `TURSO_AUTH_TOKEN` 만료 → 재발급 후 `.env.local` 및 Vercel 업데이트 |
| PR 충돌 | 팀원에게 `git rebase origin/main` 요청 |
| 배포 후 화면 깨짐 | Vercel 이전 배포로 롤백 후 원인 파악 |

---

## 관련 문서

- 팀원용 협업 가이드 → `11_COLLABORATION_GUIDE.md`
- 개발 원칙 → `00_DEVELOPMENT_PRINCIPLES.md`
- DB 스키마 → `01_DB_SCHEMA.md`
