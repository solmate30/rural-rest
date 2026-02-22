# Auth and Session Logic (Better Auth)
> Created: 2026-02-07 23:45
> Last Updated: 2026-02-08 00:20

본 문서는 **Better Auth**를 활용한 Rural Rest 서비스의 인증 시스템과 세션 관리 로직을 정의합니다. 사용자 시나리오(민수, 엠마)에서 정의된 "빠르고 편리한 로그인" 경험을 구현하는 기술적 토대가 됩니다.

---

## 1. Context
사용자가 서비스의 핵심 기능(예약, 셔틀 신청, 호스트 관리)을 이용하기 위해 신원을 확인하고 권한을 부여받는 과정입니다.

**관련 UI**: [Landing Page] → [Auth Page (Login/Register)] → [Role-based Dashboard]

---

## 2. Technical Stack
*   **Auth Library**: Better Auth
*   **Authentication Methods**:
    *   **Social Providers**: Google, Kakao (OAuth 2.0)
    *   **Email/Password**: 이메일과 비밀번호를 통한 전통적 인증 방식 (구현 완료)
*   **Session Strategy**: Database-backed Session + Cookie (Server-side)
    *   *Note*: Better Auth는 기본적으로 쿠키 기반 세션을 사용하며, 이는 모바일 앱(WebView 또는 Native)에서도 확장 가능하게 설계되어 있습니다. 향후 Native 앱 전용 API가 필요한 경우 JWT를 고려할 수 있으나, 현재 웹/PWA 환경에서는 보안성이 더 높은 쿠키 방식을 유지합니다.
*   **Database**: Drizzle ORM (linked with `users`, `sessions`, `accounts`, `verification` tables)
*   **User Additional Fields**:
    *   `role`: 사용자 역할 ('guest', 'host', 'admin') - 기본값: 'guest'
    *   `preferredLang`: 사용자 선호 언어 (기본값: 'en') - 자동 번역 채팅 기능에서 활용

---

## 3. Business Rules
- [x] **가입 즉시 게스트**: 모든 소셜 로그인 및 이메일/비밀번호 가입 사용자는 가입 즉시 `guest` 역할을 부여받습니다. (Better Auth `defaultValue: "guest"` 설정 완료)
- [x] **이메일/비밀번호 인증**: 전통적인 이메일과 비밀번호를 통한 회원가입 및 로그인 기능 구현 완료.
- [ ] **1인 1계정**: 동일한 이메일 주소로 다른 소셜 로그인을 시도할 경우, 기존 계정에 연결하거나 통합합니다. (Better Auth 기본 동작 확인 필요)
- [ ] **호스트 권한 확장**: 호스트 기능을 사용하려는 게스트는 별도의 '호스트 등록' 프로세스를 거쳐야 하며, 이때 `role` 필드가 `host`로 업데이트됩니다.
- [x] **세션 만료**: 보안을 위해 30일 동안 활동이 없을 경우 세션이 만료되며 재로그인이 필요합니다. (Better Auth 기본값 준수)
- [x] **권한 보호**: `requireUser` 유틸리티를 통한 라우트별 접근 제어 구현 완료. (Admin Dashboard 등에서 실제 사용 중)

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
7.  **사용자 피드백**: 리다이렉트 후 Toast로 "로그인되었습니다" 성공 메시지 표시 (shadcn/ui Toast 사용).
    *   **에러 처리**: OAuth 인증 실패 시 Toast로 "소셜 로그인에 실패했습니다. 다시 시도해주세요" 메시지 표시.

### 4.2. Authentication Flow (Email/Password)
1.  사용자가 Auth Page에서 '이메일로 로그인' 또는 '회원가입' 선택.
2.  폼 입력: 이메일, 비밀번호 (회원가입 시 이름 추가).
3.  클라이언트에서 `signIn.email()` 또는 `signUp.email()` 호출.
4.  서버 로직:
    *   로그인: 이메일/비밀번호 검증 후 세션 생성.
    *   회원가입: `users` 테이블에 레코드 생성 (role: 'guest', preferredLang: 'en').
5.  DB 세션 생성 및 브라우저에 보안 쿠키(HTTP Only) 발급.
6.  홈 페이지 또는 이전 페이지로 리다이렉트.
7.  **사용자 피드백**: 
    *   **성공 시**: Toast로 "로그인되었습니다" 또는 "회원가입이 완료되었습니다" 메시지 표시 (shadcn/ui Toast 사용).
    *   **에러 시**: Toast로 에러 메시지 표시 (예: "이메일 또는 비밀번호가 올바르지 않습니다", "이미 가입된 이메일입니다").

### 4.3. Middleware & Role Protection (loader/action)
```typescript
// requireUser 유틸리티 구현 (실제 코드)
export async function requireUser(
  request: Request, 
  allowedRoles: string[] = ["guest", "host", "admin"]
) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session) {
    throw redirect("/auth");
  }

  const user = session.user;
  // Better Auth는 additionalFields로 추가한 role을 user 객체에 포함시킴
  if (!allowedRoles.includes((user as any).role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

// getSession 헬퍼 (세션만 확인, 역할 검증 없음)
export async function getSession(request: Request) {
  return await auth.api.getSession({ headers: request.headers });
}
```

**사용 예시**:
```typescript
// Admin Dashboard - 호스트/관리자만 접근 가능
export async function loader({ request }: Route.LoaderArgs) {
  return await requireUser(request, ["host", "admin"]);
}

// 일반 예약 페이지 - 로그인한 모든 사용자 접근 가능
export async function loader({ request }: Route.LoaderArgs) {
  return await requireUser(request); // 기본값: ["guest", "host", "admin"]
}
```

### 4.4. User Feedback & Toast Messages

모든 인증 관련 액션은 shadcn/ui Toast 컴포넌트를 통해 사용자에게 피드백을 제공합니다.

#### 4.4.1. 로그인 성공/실패 Toast
```typescript
// 로그인 성공
toast({
  title: "로그인되었습니다",
  description: `${user.name}님, 환영합니다!`,
  variant: "default", // Success 스타일
});

// 로그인 실패
toast({
  title: "로그인 실패",
  description: error.message || "이메일 또는 비밀번호가 올바르지 않습니다.",
  variant: "destructive", // Error 스타일
});
```

#### 4.4.2. 회원가입 성공/실패 Toast
```typescript
// 회원가입 성공
toast({
  title: "회원가입 완료",
  description: "Rural Rest에 오신 것을 환영합니다!",
  variant: "default", // Success 스타일
});

// 회원가입 실패 (이메일 중복 등)
toast({
  title: "회원가입 실패",
  description: error.message || "이미 가입된 이메일입니다.",
  variant: "destructive", // Error 스타일
});
```

#### 4.4.3. 로그아웃 Toast
```typescript
// 로그아웃 성공
const handleSignOut = async () => {
  await signOut();
  toast({
    title: "로그아웃되었습니다",
    description: "다음에 또 만나요!",
    variant: "default", // Success 스타일
  });
  window.location.href = "/";
};
```

#### 4.4.4. 소셜 로그인 에러 처리
```typescript
// 소셜 로그인 실패 시 (OAuth 에러)
try {
  await signIn.social({ provider: "google", callbackURL: "/" });
} catch (error) {
  toast({
    title: "소셜 로그인 실패",
    description: "소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
    variant: "destructive",
  });
}
```

### 4.5. RWA Investor Authentication Flow (Web2 ➔ KYC ➔ Web3)
RWA(실물연계자산) 투자를 위해서는 일반적인 Web2 인증에 더하여 실명인증(KYC)과 Web3 암호화폐 지갑 연동이 필수적입니다. 사용자 편의성과 규제 준수를 위해 다음과 같은 흐름(Flow 1 방식)을 채택합니다.

1. **일반 로그인 (Web2)**: 사용자는 기존 예약 고객과 동일한 방식으로 이메일이나 소셜 로그인을 통해 가입 및 로그인을 완료합니다.
2. **KYC 진행 (본인 인증)**:
   - 사용자가 `/invest` (투자) 또는 `/my-investments` 등 특정 투자 관련 페이지에 접근하여 `Invest Now` 버튼을 클릭할 때 트리거됩니다.
   - 계정에 KYC 인증 정보가 없다면 **[실명 인증 진행]** 모달 혹은 전용 페이지로 유도하여 본인 인증을 완료합니다.
3. **지갑 연결 (Web3)**:
   - KYC가 승인된 사용자에게만 **[솔라나 지갑 연결(Connect Wallet)]** 버튼이 활성화됩니다.
   - 지갑 연결 완료 시 해당 `users` 데이터베이스 레코드에 `walletAddress` 등 Web3 정보가 최종적으로 매핑되어 저장됩니다.
4. **권한 확장 및 온체인 연동**: 이 절차가 모두 끝난 지갑 주소만 투자를 위한 스마트 컨트랙트 화이트리스트에 오르며, 정상적으로 지분 토큰 구매(Purchase) 액션이 가능해집니다.

---

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 사용자 인증 및 마이 페이지 기획
- **Foundation**: [Happy Path Scenarios](../01_Concept_Design/07_HAPPY_PATH_SCENARIOS.md) - 민수와 엠마의 빠른 로그인 경험
- **Prototype**: [Landing Page Review](../02_UI_Screens/00_LANDING_PAGE_REVIEW.md) - 로그인 진입점 UI (랜딩 페이지)
- **Specs**: [Database Schema](../03_Technical_Specs/01_DB_SCHEMA.md) - `users`, `sessions`, `accounts` 테이블 정의
- **Specs**: [API Specs](../03_Technical_Specs/02_API_SPECS.md) - `requireUser` 및 인증 API 인터페이스, 에러 핸들링 전략 (Section 4)
- **Foundation**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - Toast 컴포넌트 디자인 가이드라인 (Section 5.3)
- **Test**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 로그인 및 권한 우회 시도 테스트 케이스
