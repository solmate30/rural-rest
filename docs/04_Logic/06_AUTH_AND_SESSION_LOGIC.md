# Auth and Session Logic (Better Auth)
> Created: 2026-02-07 23:45
> Last Updated: 2026-02-07 23:45

본 문서는 **Better Auth**를 활용한 Rural Rest 서비스의 인증 시스템과 세션 관리 로직을 정의합니다. 사용자 시나리오(민수, 엠마)에서 정의된 "빠르고 편리한 로그인" 경험을 구현하는 기술적 토대가 됩니다.

---

## 1. Context
사용자가 서비스의 핵심 기능(예약, 셔틀 신청, 호스트 관리)을 이용하기 위해 신원을 확인하고 권한을 부여받는 과정입니다.

**관련 UI**: [Landing Page] → [Auth Page (Login/Register)] → [Role-based Dashboard]

---

## 2. Technical Stack
*   **Auth Library**: Better Auth
*   **Social Providers**: Google, Kakao
*   **Session Strategy**: Database-backed Session + Cookie (Server-side)
    *   *Note*: Better Auth는 기본적으로 쿠키 기반 세션을 사용하며, 이는 모바일 앱(WebView 또는 Native)에서도 확장 가능하게 설계되어 있습니다. 향후 Native 앱 전용 API가 필요한 경우 JWT를 고려할 수 있으나, 현재 웹/PWA 환경에서는 보안성이 더 높은 쿠키 방식을 유지합니다.
*   **Database**: Drizzle ORM (linked with `users`, `sessions`, `accounts` tables)

---

## 3. Business Rules
- [ ] **가입 즉시 게스트**: 모든 소셜 로그인 사용자는 가입 즉시 `guest` 역할을 부여받습니다.
- [ ] **1인 1계정**: 동일한 이메일 주소로 다른 소셜 로그인을 시도할 경우, 기존 계정에 연결하거나 통합합니다.
- [ ] **호스트 권한 확장**: 호스트 기능을 사용하려는 게스트는 별도의 '호스트 등록' 프로세스를 거쳐야 하며, 이때 `role` 필드가 `host`로 업데이트됩니다.
- [ ] **세션 만료**: 보안을 위해 30일 동안 활동이 없을 경우 세션이 만료되며 재로그인이 필요합니다.

---

## 4. Implementation Details

### 4.1. Authentication Flow (Social Login)
1.  사용자가 Auth Page에서 'Google' 또는 'Kakao' 버튼 클릭.
2.  Better Auth 클라이언트가 해당 Provider의 OAuth 서버로 리다이렉트.
3.  인증 성공 후 서버 측 Callback 엔드포인트(`auth/callback/[provider]`)로 데이터 전달.
4.  서버 로직:
    *   신규 사용자라면: `users` 테이블에 레코드 생성 (role: 'guest').
    *   기존 사용자라면: 최근 로그인 시간 업데이트.
5.  DB 세션 생성 및 브라우저에 보안 쿠키(HTTP Only) 발급.
6.  홈 페이지 또는 이전 페이지로 리다이렉트.

### 4.2. Middleware & Role Protection (loader/action)
```typescript
// requireUser 유틸리티 예시
async function requireUser(request: Request, allowedRoles: string[] = ['guest', 'host']) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session) {
    throw redirect("/auth");
  }

  const user = session.user;
  if (!allowedRoles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}
```

---

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 사용자 인증 및 마이 페이지 기획
- **Foundation**: [Happy Path Scenarios](../01_Foundation/07_HAPPY_PATH_SCENARIOS.md) - 민수와 엠마의 빠른 로그인 경험
- **Prototype**: [Auth Page UI](../routes/auth.tsx) - 로그인 화면 UI 목업
- **Specs**: [Database Schema](../03_Specs/01_DB_SCHEMA.md) - `users`, `sessions`, `accounts` 테이블 정의
- **Specs**: [API Specs](../03_Specs/02_API_SPECS.md) - `requireUser` 및 인증 API 인터페이스
- **Test**: [Test Scenarios](../05_Test/01_TEST_SCENARIOS.md) - 로그인 및 권한 우회 시도 테스트 케이스
