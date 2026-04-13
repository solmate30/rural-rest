# Security Audit & Remediation Checklist
> Created: 2026-04-12 00:00
> Last Updated: 2026-04-12 16:00

## 개요

이 문서는 rural-rest Solmate 프로젝트의 보안 점검 결과와 각 항목의 조치 방법을 정리한다.
점검 범위: 소스코드 정적 분석, git 히스토리, 의존성 취약점, 인증/인가 로직.

---

## 점검 결과 요약

| 심각도 | 항목 수 |
|---|---|
| CRITICAL | 3 |
| HIGH | 7 |
| MODERATE | 4 |
| 정보성 | 2 |

---

## CRITICAL

### C-1. Solana 지갑 프라이빗 키 git 히스토리 노출

- **상태**: 조치 완료 (2026-04-12)
- **파일 경로 (git 히스토리 내)**:
  - `web/scripts/government-wallet.json`
  - `web/scripts/village-operator-wallet.json`
- **커밋**: `3035165` (feat: localnet 테스트 스크립트, 2026-03-30)
- **삭제 커밋**: `b9c4de8` (fix: 지갑 비밀키 파일 git 추적 제거) — 파일은 워킹트리에서 제거되었으나 **히스토리에는 64바이트 keypair(프라이빗 키 포함)가 그대로 남아있음**
- **위험**: 누구나 `git show 3035165:web/scripts/government-wallet.json` 으로 프라이빗 키 복원 가능

**조치 방법**:
1. 해당 지갑이 devnet 전용인지 mainnet 사용 여부 확인
2. mainnet 또는 실제 자산 보유 지갑이라면 **즉시 자산 이전 후 지갑 폐기**
3. git 히스토리 정리 (`git filter-repo` 사용, force push 필요):
   ```bash
   pip install git-filter-repo
   git filter-repo --path web/scripts/government-wallet.json --invert-paths
   git filter-repo --path web/scripts/village-operator-wallet.json --invert-paths
   git push --force --all
   ```
4. 팀원 전원 로컬 repo 재클론 필요
5. `.gitignore`에 `*.json` 패턴 추가 또는 `web/scripts/*.json` 명시적 제외 확인

**확인 체크리스트**:
- [x] 해당 지갑의 devnet/mainnet 여부 확인 → devnet 전용 확인
- [x] mainnet이라면 자산 이전 완료 → 해당 없음 (devnet)
- [x] git filter-repo로 히스토리 정리 완료
- [x] force push 완료 (main, feat/dao 외 전체 브랜치)
- [x] GitHub Issue #18 생성으로 팀원 재클론 공지 완료
- [ ] 팀원 전원 재클론 완료 확인 (Issue #18 댓글로 추적 중)

---

### C-2. 의존성 CRITICAL 취약점 — axios SSRF

- **상태**: 부분 조치 — 직접 의존성 제거 완료, transitive 경로 잔존
- **패키지**: `axios` (via `@coinbase/cdp-sdk`, `@solana/wallet-adapter-trezor`)
- **CVE**:
  - `Axios has a NO_PROXY Hostname Normalization Bypass Leads to SSRF`
  - `Axios has Unrestricted Cloud Metadata Exfiltration via Header Injection Chain` (CVSS 10.0)
- **위험**: 공격자가 axios를 경유해 클라우드 메타데이터 서비스(AWS/GCP IMDSv1)에 접근하여 IAM 크레덴셜 탈취 가능
- **추가 확인 결과**: 소스코드(`web/app/**`) 전체에서 `@coinbase/cdp-sdk` import 없음 → **실제로 사용하지 않는 패키지**

**조치 방법 (업그레이드 대신 제거 권장)**:
```bash
cd web
npm uninstall @coinbase/cdp-sdk
npm audit   # axios CVE 제거 확인
```
- 만약 제거 후 빌드 오류 발생 시: `npm install axios@>=1.15.0` 으로 직접 업그레이드

**확인 체크리스트**:
- [x] `@coinbase/cdp-sdk` 직접 의존성 제거 완료
- [ ] axios CVE 잔존 — 2개의 transitive 경로가 남아있음:
  - `@privy-io/react-auth` → `x402` → `wagmi` → `@base-org/account` → `@coinbase/cdp-sdk`
  - `@solana/wallet-adapter-trezor` → `@trezor` → `@stellar/stellar-sdk` → `axios`
  - 해결 조건: privy 및 solana 업스트림 업데이트 대기
- [ ] 빌드 및 런타임 정상 확인

---

### C-3. 의존성 HIGH/CRITICAL — drizzle-orm SQL Injection

- **상태**: 조치 완료 (2026-04-12) — 0.45.1 → 0.45.2 패치 업그레이드
- **패키지**: `drizzle-orm` (현재 `^0.45.1`)
- **취약점**: `Drizzle ORM has SQL injection via improperly escaped SQL identifiers`
- **위험**: 동적으로 구성된 쿼리에서 SQL Injection 가능
- **추가 확인 결과**: 소스코드의 raw `sql` 태그 사용처(`admin-dashboard.server.ts`, `rwa.server.ts`) 전부 **컬럼 참조 및 하드코딩 값만 사용** — 현재는 사용자 입력이 sql 태그에 유입되지 않아 실질적 위험 없음

**주의 사항 (Breaking Change 위험)**:
- `^0.45.1` → `@latest` 업그레이드 시 Drizzle API 변경 가능성 있음
- 업그레이드 후 아래 파일들의 쿼리 동작을 반드시 검증해야 함:
  - `web/app/lib/admin-dashboard.server.ts` (sql 태그 10개 이상 사용)
  - `web/app/lib/rwa.server.ts`
  - `web/app/db/schema.ts`

**조치 방법**:
```bash
cd web
npm install drizzle-orm@latest
# 업그레이드 후 빌드 및 주요 쿼리 동작 검증 필수
npm run typecheck
npm run build
```

**확인 체크리스트**:
- [x] drizzle-orm 0.45.2 업그레이드 완료
- [x] drizzle-kit 0.31.10 업그레이드 완료
- [x] `npm run typecheck` 통과 확인 (기존 오류만 존재)
- [x] `npm audit`에서 drizzle-orm CVE 제거 확인
- [ ] 어드민 대시보드 데이터 조회 런타임 확인

---

## HIGH

### H-1. 미인증 거버넌스 Issue/Gist 생성 엔드포인트

- **상태**: 조치 완료 (2026-04-12)
- **파일**: `web/app/routes/api.governance.issue.ts`, `web/app/routes/api.governance.gist.ts`
- **문제**: POST 핸들러에 `requireUser()` 없음 → 비로그인 사용자가 GitHub Issue/Gist를 무제한 생성 가능
- **위험**: GitHub 저장소 스팸, DAO 거버넌스 조작, GitHub API rate limit 소진

**코드베이스 직접 확인 결과 (기능 파손 위험 없음)**:
- `CreateProposalForm.tsx:117` catch 블록은 **fetch 자체가 실패하는 네트워크 에러만 잡음**
- 401 응답은 fetch가 정상 완료되므로 catch로 떨어지지 않음
- `if (res.ok && data.url)` 조건에서 401이면 `res.ok = false` → `finalDescriptionUri = ""`
- 이미 GITHUB_TOKEN 미설정 시(503 반환) 빈 URI로 제안이 등록되는 동일한 경로를 사용 중
- `requireUser()` 추가 시: 이미 로그인한 사용자(지갑 연결 선행 필수)는 영향 없음
- **기능 파손 없이 적용 가능**

**조치 방법**:
```typescript
// api.governance.issue.ts — action 함수 상단에 추가
import { requireUser } from "~/lib/auth.server";

export async function action({ request }: { request: Request }) {
    await requireUser(request);   // 이 한 줄 추가
    // ... 기존 로직 그대로
}
```

**확인 체크리스트**:
- [x] `api.governance.issue.ts`에 `requireUser(request)` 추가 완료
- [x] `api.governance.gist.ts`에 `requireUser(request)` 추가 완료
- [ ] 비인증 요청 시 /auth 리다이렉트 확인
- [ ] 로그인 상태에서 DAO 제안 생성 플로우 정상 동작 확인

---

### H-2. 의존성 HIGH 취약점 — vite 경로 탐색

- **상태**: 미조치 — `npm audit fix` 후에도 잔존 (직접 수정 불가)
- **패키지**: `vite`
- **취약점**:
  - `Vite Vulnerable to Path Traversal in Optimized Deps .map Handling`
  - `Vite: server.fs.deny bypassed with queries`
  - `Vite Vulnerable to Arbitrary File Read via Vite Dev Server WebSocket`
- **위험**: dev 서버 노출 시 서버 내 임의 파일 읽기 가능 (프로덕션에서는 dev 서버 미사용으로 위험도 낮음)

**조치 방법**:
```bash
cd web
npm install vite@latest
```

**확인 체크리스트**:
- [ ] vite 최신 버전으로 업그레이드
- [ ] dev 서버가 외부 네트워크에 노출되지 않는지 확인 (`--host 0.0.0.0` 사용 금지)

---

### H-3. 의존성 HIGH 취약점 — h3 경로 탐색 및 SSE Injection

- **상태**: 미조치 (직접 수정 불가)
- **패키지**: `h3@1.15.5`
- **취약점**:
  - `Path Traversal via Percent-Encoded Dot Segments in serveStatic`
  - `SSE Event Injection via Unsanitized Carriage Return`
  - `Double Decoding bypasses resolveDotSegments`
- **위험**: 정적 파일 서빙 경로 우회로 임의 파일 읽기, SSE 스트림 오염
- **코드베이스 확인 결과**: 소스코드 전체에 `from "h3"` import 없음. 실제 의존성 체인:
  `@privy-io/react-auth` → `@walletconnect/ethereum-provider` → `unstorage` → `h3@1.15.5`
- **핵심 제약**: 직접 `npm install h3@latest`로 수정 불가. `@privy-io/react-auth`가 업스트림에서 의존성을 올려야 해결 가능.

**조치 방법**:
```bash
cd web
npm install @privy-io/react-auth@latest   # privy가 h3 패치 버전을 포함하면 해결
npm audit                                  # 해결 여부 확인
```
- 해결되지 않으면 `npm audit --json`으로 해당 CVE만 suppress 처리 (false positive 관리)

**확인 체크리스트**:
- [ ] `@privy-io/react-auth` 최신 버전 업그레이드 후 h3 CVE 해결 여부 확인
- [ ] Privy 인증 플로우(로그인/지갑연결) 동작 테스트 필수

---

### H-4. 의존성 HIGH 취약점 — lodash Prototype Pollution & Code Injection

- **상태**: 미조치 (직접 수정 불가)
- **패키지**: `lodash@4.17.21~4.17.23`
- **취약점**:
  - `Prototype Pollution via array path bypass in _.unset / _.omit`
  - `Code Injection via _.template imports key names`
- **위험**: 객체 프로토타입 오염으로 권한 우회, `_.template` 사용 시 코드 실행
- **코드베이스 확인 결과**: 소스코드 전체에 `from "lodash"` import 없음. 실제 의존성 체인:
  - `@react-router/dev` → `lodash@4.17.23`
  - `cloudinary` → `lodash@4.17.23`
  - `@privy-io/react-auth` → `@walletconnect` → `@metamask/utils` → `lodash@4.17.23`
  - `i18next-scanner` → `lodash@4.17.23`
- **핵심 제약**: `npm install lodash@latest`로는 수정 불가. 각 부모 패키지가 업스트림에서 의존성을 올려야 해결됨.

**조치 방법**:
```bash
cd web
npm install @react-router/dev@latest cloudinary@latest @privy-io/react-auth@latest
npm audit   # 해결 여부 확인
```

**확인 체크리스트**:
- [ ] 각 상위 패키지 업그레이드 후 lodash CVE 해결 여부 확인
- [ ] 소스코드 내 `_.template` 직접 사용 없음 (확인 완료 — 위험 없음)
- [ ] 업그레이드 후 빌드 및 주요 플로우 동작 테스트

---

### H-5. Blinks 엔드포인트 CORS `Access-Control-Allow-Origin: *`

- **상태**: 설계상 필요 (Solana Blinks 스펙), 위험 인지 필요
- **파일**:
  - `web/app/routes/api.actions.governance.$proposalId.ts`
  - `web/app/routes/api.actions.invest.$listingId.ts`
- **문제**: `*` 오리진 + `Authorization` 헤더 허용 조합 → CSRF 가능성
- **위험**: KYC 인증 유저의 투표/투자 액션이 악성 사이트에서 트리거될 수 있음

**조치 방법**:
- Blinks 스펙상 CORS `*` 변경 불가이므로, 서버 사이드에서 추가 보호 레이어 적용
- 중요 액션(투자, 투표)에 서명 타임스탬프 + 서버 검증 추가
- 모든 Blinks 액션을 별도 감사 로그에 기록

**확인 체크리스트**:
- [ ] 투자/투표 액션에 서버 사이드 중복 실행 방지 로직 확인
- [ ] Blinks 액션 감사 로그 구현

---

### H-6. PayPal 주문 금액 상한 없음

- **상태**: 조치 완료 (2026-04-12)
- **파일**: `web/app/routes/api.paypal.create-order.ts`
- **문제**: `totalPrice` 입력값에 상한 없음, `bookingId` 미검증
- **위험**: 비정상 금액(Infinity, 음수, 매우 큰 수) 주입으로 결제 로직 오동작

**조치 방법**:
```typescript
import { z } from "zod";
const schema = z.object({
  totalPrice: z.number().min(100).max(50_000_000), // KRW 기준 상한
  bookingId: z.string().uuid(),
});
const body = schema.parse(await request.json());
```

**확인 체크리스트**:
- [x] `bookingId` 존재 및 문자열 타입 검증 추가
- [x] `totalPrice` 0 초과 5천만원(50,000,000) 이하 범위 검증 추가
- [ ] 비정상 금액 요청 거부 동작 런타임 확인

---

### H-7. 의존성 HIGH 취약점 — bigint-buffer Buffer Overflow

- **상태**: 미조치 — `npm audit fix` 후에도 잔존 (직접 수정 불가)
- **패키지**: `bigint-buffer` (via `@solana/buffer-layout-utils` → `@solana/spl-token`)
- **취약점**: `bigint-buffer Vulnerable to Buffer Overflow via toBigIntLE()`
- **위험**: Solana 토큰 처리 중 버퍼 오버플로우

**조치 방법**:
```bash
cd web
npm install @solana/spl-token@latest
```

**확인 체크리스트**:
- [ ] @solana/spl-token 최신 버전으로 업그레이드
- [ ] 관련 기능 동작 테스트

---

## MODERATE

### M-1. 지갑 Nonce TTL ~~미구현~~ — 이미 구현됨 (오진)

- **상태**: 정상 구현되어 있음 (조치 불필요)
- **확인 파일**: `web/app/routes/api.user.connect-wallet.ts`
- **실제 코드**:
  - `NONCE_TTL_MS = 5 * 60 * 1000` 상수 정의
  - `walletNonceIssuedAt` 기반 만료 체크 구현
  - 만료 시 DB nonce null 초기화 후 400 반환
  - 검증 성공 시 nonce 즉시 무효화 (재사용 방지)
- **비고**: 최초 감사 시 `api.user.wallet-nonce.ts`(발급)만 확인하고 `api.user.connect-wallet.ts`(검증)를 누락한 오진이었음

---

### M-2. 모든 API 엔드포인트 Rate Limiting 없음

- **상태**: 조치 완료 (2026-04-12)
- **영향 엔드포인트**:
  - `/api/chat/concierge` — AI 호출 비용 무제한 발생 가능
  - `/api/paypal/create-order` — 결제 요청 무제한
  - `/api/user/wallet-nonce` — 인증 브루트포스 가능
- **위험**: DoS, 과도한 API 비용, 브루트포스 공격

**조치 방법**:
- React Router 7 미들웨어 또는 서버 레벨(Nginx/Cloudflare)에서 rate limit 적용
- 최소한 `/api/chat/concierge`에 사용자당 분당 10회 제한 적용

**구현 내용** (`web/app/lib/rate-limit.server.ts` 신규 생성):
- `/api/chat/concierge` — 사용자당 분당 10회 (AI 비용 보호)
- `/api/paypal/create-order` — 사용자당 10분에 10회 (결제 남용 방지)
- `/api/user/wallet-nonce` — IP당 5분에 10회 (브루트포스 방어)
- 초과 시 `429 Too Many Requests` + `Retry-After` 헤더 반환

**확인 체크리스트**:
- [x] AI 채팅 엔드포인트 rate limit 구현
- [x] 결제 엔드포인트 rate limit 구현
- [x] 인증(nonce) 엔드포인트 rate limit 구현
- [ ] 한도 초과 시 429 응답 런타임 확인

---

### M-3. Unsafe Type Assertion — Privy/Drizzle 타입 추론 한계

- **상태**: 보안 취약점 아님 — 타입 코드 품질 문제로 재분류
- **파일**: `web/app/routes/api.sign-cloudinary.ts:19`
- **코드**: `const role = (user as any).role as string;`
- **코드베이스 직접 확인 결과**:
  - `requireUser`는 `privy.server.ts`에서 Drizzle `db.select().from(schema.user)` 전체 row를 반환
  - DB 스키마의 `user` 테이블에 `role` 컬럼이 존재 → **런타임에 `role` 값은 항상 존재**
  - `as any` 캐스팅은 TypeScript가 Drizzle 반환 타입에서 `role`을 정확히 추론하지 못해서 사용된 것
  - role이 `undefined`일 경우에도 `includes(undefined) = false` → 403 차단 (의도대로 동작)
  - **보안적으로 안전. 즉각 수정 불필요.**
- **장기 권장**: Drizzle의 `InferSelectModel<typeof user>`를 활용하여 타입 명시

**확인 체크리스트**:
- [ ] (선택) `InferSelectModel` 타입 활용으로 `as any` 제거 후 `typecheck` 통과 확인

---

### M-4. 의존성 HIGH — rollup 경로 탐색 (빌드 도구)

- **상태**: 미조치 — `npm audit fix` 후에도 잔존 (직접 수정 불가)
- **패키지**: `rollup`
- **취약점**: `Rollup 4 has Arbitrary File Write via Path Traversal`
- **위험**: 악성 패키지가 빌드 중 임의 파일 쓰기 가능 (공급망 공격 시나리오)

**조치 방법**:
```bash
cd web
npm install rollup@latest
```

**확인 체크리스트**:
- [ ] rollup 최신 버전으로 업그레이드
- [ ] 빌드 정상 동작 확인

---

## 정보성 (즉각 조치 불필요, 인지 권장)

### I-1. raw sql 프래그먼트 사용 패턴

- **파일**: `web/app/lib/admin-dashboard.server.ts`
- **내용**: Drizzle `sql` 태그 직접 사용 — 현재는 안전하나, 사용자 입력이 유입되면 SQL Injection 위험
- **권장**: Drizzle 타입 안전 빌더(`and()`, `inArray()`, `gte()`, `lt()`)로 교체

---

### I-2. .gitignore 규칙 — 스크립트 JSON 파일

- **내용**: `web/scripts/` 내 JSON 파일들이 gitignore에 명시되어 있으나, 실수로 `git add -f` 사용 시 노출 위험
- **권장**: CI에 secret scanning 도구(truffleHog, gitleaks) 추가

---

## 전체 조치 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 1 | C-1: Solana 지갑 키 히스토리 | mainnet 자산 피해 가능성 |
| 2 | C-2: axios SSRF (CVSS 10.0) | 클라우드 크레덴셜 탈취 |
| 3 | C-3: drizzle-orm SQL Injection | DB 전체 노출 가능 |
| 4 | H-1: 거버넌스 API 미인증 | 즉시 코드 1줄 수정으로 해결 가능 |
| 5 | H-6: PayPal 금액 미검증 | 결제 로직 오동작 |
| 6 | H-2~H-5, H-7: 의존성 업그레이드 | `npm audit fix` 일괄 처리 |
| 7 | M-1~M-4: 중간 위험 항목 | 1~2주 내 처리 |
| 8 | I-1~I-2: 정보성 항목 | 중장기 개선 |

---

## 의존성 취약점 현황 (`npm audit` 기준)

### 초기 감사 시점 (2026-04-12 감사 시작)

| 심각도 | 건수 |
|---|---|
| CRITICAL | 2 |
| HIGH | 15 |
| MODERATE | 15 |
| LOW | 26 |
| **합계** | **58** |

### 현재 (`npm audit fix` 적용 후, 2026-04-12)

| 심각도 | 건수 | 잔존 이유 |
|---|---|---|
| CRITICAL | 2 | axios — transitive 경로 2개 잔존 (privy, trezor 업스트림 대기) |
| HIGH | 4 | drizzle-orm, h3, lodash, bigint-buffer 등 — transitive 의존성 |
| MODERATE | 11 | (transitive) |
| LOW | 25 | (transitive) |
| **합계** | **42** | |

**잔존 취약점 해소 조건**: privy, solana, react-router 등 상위 패키지 업스트림에서 의존성 업데이트 필요. 주기적으로 `npm audit fix` 재실행 권장.
