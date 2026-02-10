# 02. API Specification (React Router v7 Pattern)
> Created: 2026-02-07 17:25
> Last Updated: 2026-02-11 12:00

## 1. Architecture Overview
*   **Framework**: React Router v7 (Serverless Functions via Vercel).
*   **Data Fetching**: Use `loader` for READ (GET). Parameters via `URLSearchParams`.
*   **Data Mutation**: Use `action` for WRITE (POST/PUT/DELETE). Form Data submission.
*   **Validation**: **Zod** for schema validation.
*   **Date Handling**: **Luxon** for timezone-aware date operations.
*   **File Storage**: **Cloudinary** for image optimization and delivery.
*   **UI Component Library**: **shadcn/ui** (Radix UI 기반, Tailwind CSS 스타일링)
    *   **Toast Component**: 사용자 피드백 및 에러 메시지 표시 (`@radix-ui/react-toast`)
    *   **Alert Component**: 중요한 메시지 표시 (에러 바운더리 등)

## 2. Shared Utilities (Server-Side)
These helper functions are used across multiple loaders and actions to ensure security and consistency.

### 2.1. `requireUser(request: Request, allowedRoles?: string[])`
*   **Purpose**: Validates the session token from cookies/headers and checks user role. Throws a redirect to `/auth` if unauthorized.
*   **Parameters**:
    *   `request: Request` - HTTP request object
    *   `allowedRoles?: string[]` - 허용된 역할 배열 (기본값: `["guest", "host", "admin"]`)
*   **Returns**: `User` object (id, email, role, preferredLang).
*   **Throws**: 
    *   `redirect("/auth")` - 세션이 없을 경우
    *   `Response("Forbidden", { status: 403 })` - 허용되지 않은 역할일 경우
*   **Usage**: Must be called at the start of any protected `loader` or `action`.
*   **Example**:
    ```typescript
    // 호스트/관리자만 접근 가능
    export async function loader({ request }: Route.LoaderArgs) {
      return await requireUser(request, ["host", "admin"]);
    }
    
    // 모든 로그인 사용자 접근 가능 (기본값 사용)
    export async function loader({ request }: Route.LoaderArgs) {
      return await requireUser(request);
    }
    ```

### 2.2. `getSupabaseServerClient(request: Request)`
*   **Purpose**: Returns an authenticated Supabase client instance for server-side DB operations.

## 3. Route Specifications

### 3.1. Landing Page (`/`)
*   **Loader (GET)**:
    *   **Purpose**: Fetch featured listings for the home page. Used by Smart Search + Featured Stays real-time filtering (location, maxPrice).
    *   **Return Type**: `{ featuredListings: Listing[] }`  
        *   **권장 개수**: 홈 Featured Stays 실시간 필터용으로 약 50건 (또는 서비스 정책에 따른 상한).
        *   **Listing 필수 필드**: `id`, `location` (거점 값, e.g. `seoul-suburbs`, `busan-suburbs`, `gyeongju`, `incheon`, `jeju`), `pricePerNight` (숙박 단가). 그 외 제목, 이미지, 지역명 등 표시용 필드.
    *   **Caching**: Cache-Control: s-maxage=3600 (1 hour).
    *   **참조**: [Search & Filter Logic](../04_Logic_Progress/07_SEARCH_AND_FILTER_LOGIC.md) Section 3.4 - 클라이언트에서 `location`/`pricePerNight` 기준 필터링.

### 3.2. Search Results (`/search`)
*   **Loader (GET)**:
    *   **Query Params**:
        *   `location`: string (optional) - e.g., `seoul-suburbs`, `busan-suburbs`
        *   `maxPrice`: number (optional) - 최대 숙박 예산
        *   `checkIn`: string (ISO Date)
        *   `checkOut`: string (ISO Date)
        *   `guests`: number (default: 1)
    *   **Logic**:
        1.  Parse params using **Zod**.
        2.  Query DB for listings matching location and price range (`pricePerNight <= maxPrice`).
        3.  Filter out listings booked during the requested date range (using **Luxon** interval check).
    *   **Return Type**: `{ listings: Listing[], totalCount: number }`

### 3.3. Property Details (`/rooms/:id`)
*   **Loader (GET)**:
    *   **Params**: `id` (Listing ID)
    *   **Logic**: Fetch listing details + associated amenities + host profile.
    *   **Return Type**: `{ listing: Listing, host: User, reviews: Review[] }`

### 3.4. Booking Process (`/book/:listingId`)
*   **Loader (GET)**:
    *   **Purpose**: Show booking confirmation screen.
    *   **Security**: `requireUser()` required.
    *   **Return Type**: `{ listing: Listing, user: User }`

*   **Action (POST)**:
    *   **Purpose**: Create a new booking reservation.
    *   **Form Data**:
        *   `checkIn`: string
        *   `checkOut`: string
        *   `guests`: number
        *   `addOns`: string[] (Activity IDs)
    *   **Logic**:
        1.  Validate input with **Zod**.
        2.  Check availability one last time (Race condition prevention).
        3.  Create `booking` record with status `pending`.
        4.  (Optional) Trigger Payment Gateway.
    *   **Redirect**: `/trips` or `/payment/success`

### 3.5. Admin Dashboard (`/admin`)
*   **경로**: 호스트 대시보드는 `/admin` 단일 경로만 사용 (중복 route id 방지를 위해 `/admin/dashboard` 별도 라우트 없음).
*   **구현 상태**: Loader 및 대시보드 UI 연동 완료. Action(예약 승인/거절)은 미구현.
*   **Loader (GET)**:
    *   **Security**: `requireUser(request, ["host", "admin"])`.
    *   **Logic**:
        1.  Total revenue (This Month): `bookings.totalPrice` 합계 (status confirmed/completed, checkIn 기준 당월).
        2.  Active listings count, Pending bookings count, Today's check-ins count.
        3.  Occupancy rate: 최근 30일 예약 박수 / (숙소 수 × 30) × 100.
        4.  Host listings: 해당 호스트 소유 `listings` 목록 (id, title, location, pricePerNight, 대표 이미지).
    *   **Return Type**: `{ user, stats, hostListings }`  
        *   `stats`: `{ totalRevenueThisMonth, activeListings, pendingBookings, occupancyRatePercent, todayCheckIns }`  
        *   `hostListings`: `{ id, title, location, pricePerNight, image }[]`
    *   **참조**: `app/lib/admin-dashboard.server.ts`, `app/routes/admin.dashboard.tsx`

*   **Action (POST)** (미구현):
    *   **Purpose**: Approve/Reject booking requests.
    *   **Form Data**: `bookingId`, `status` ('confirmed' | 'rejected').

### 3.6. Chat & Translation (`/api/chat/translate`)
*   **Action (POST)**:
    *   **Purpose**: Real-time message translation.
    *   **Payload**: `{ text: string, targetLang: string }`
    *   **Integration**: DeepL/Google Translation API.
    *   **Return Type**: `{ translatedText: string }`

### 3.7. Transport Concierge (`/api/trips/:id/transport`)
*   **Action (POST)**:
    *   **Purpose**: Request or update shuttle service.
    *   **Payload**: `{ pickupPoint: string, arrivalTime: number }`
    *   **Logic**: Updates `transport_requests` table and notifies host.
    *   **Return Type**: `{ success: boolean, requestId: string }`

## 4. Error Handling & User Feedback

### 4.1. HTTP Error Responses
모든 API 에러는 적절한 HTTP 상태 코드와 함께 응답을 반환하며, 에러 유형에 따라 ErrorBoundary(페이지 레벨) 또는 Toast(데이터 레벨)를 통해 사용자에게 표시됩니다.

*   **401 Unauthorized**: 
    *   서버 응답: `throw redirect("/auth")` (React Router 리다이렉트)
    *   클라이언트 처리: 리다이렉트 후 Toast로 "로그인이 필요합니다" 메시지 표시 (선택적)
*   **403 Forbidden**: 
    *   서버 응답: `throw new Response("Forbidden", { status: 403 })`
    *   클라이언트 처리: Toast로 "접근 권한이 없습니다" 메시지 표시
*   **404 Not Found**: 
    *   **페이지 레벨 404** (라우트가 존재하지 않음):
        *   서버 응답: `throw new Response("Not Found", { status: 404 })` (loader/action에서)
        *   클라이언트 처리: ErrorBoundary에서 전체 페이지를 에러 페이지로 대체
        *   메시지: "404 - 페이지를 찾을 수 없습니다" (한글)
        *   UI: 에러 페이지 전체 표시 (홈으로 돌아가기 버튼 포함)
    *   **API 리소스 404** (데이터가 존재하지 않음):
        *   서버 응답: `json({ error: "Resource not found" })` 또는 `throw new Response("Not Found", { status: 404 })`
        *   클라이언트 처리: Toast로 "요청한 리소스를 찾을 수 없습니다" 메시지 표시
        *   예시: 존재하지 않는 property ID (`/property/999`), 존재하지 않는 booking ID 등
*   **400 Bad Request**: 
    *   서버 응답: `json({ error: ZodError })` 또는 `json({ error: string })`
    *   클라이언트 처리: 
        *   폼 유효성 검사 에러: 인라인 에러 메시지 (FormField의 FormMessage)
        *   비즈니스 로직 에러: Toast로 에러 메시지 표시
*   **500 Internal Server Error**: 
    *   서버 응답: `throw new Response("Internal Server Error", { status: 500 })`
    *   클라이언트 처리: Toast로 "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요" 메시지 표시

### 4.2. Toast Notification Strategy
**에러 메시지 표시 원칙**:
*   **즉시성**: API 에러 발생 시 즉시 Toast 표시
*   **명확성**: 사용자가 이해할 수 있는 한글 메시지 제공
*   **액션 가능성**: 가능한 경우 재시도 버튼 또는 관련 링크 제공
*   **지속성**: 에러 Toast는 사용자가 수동으로 닫을 때까지 유지 (성공 메시지는 자동 닫기)

**Toast 사용 예시**:
```typescript
// API 에러 처리
if (error) {
  toast({
    title: "오류 발생",
    description: error.message || "요청을 처리하는 중 오류가 발생했습니다.",
    variant: "destructive", // 에러 스타일
  });
}

// 성공 메시지 (예약 완료)
toast({
  title: "예약 완료",
  description: "예약이 성공적으로 완료되었습니다.",
  variant: "default", // 성공 스타일
});

// 로그인 성공
toast({
  title: "로그인되었습니다",
  description: `${user.name}님, 환영합니다!`,
  variant: "default",
});

// 로그인 실패
toast({
  title: "로그인 실패",
  description: "이메일 또는 비밀번호가 올바르지 않습니다.",
  variant: "destructive",
});

// 로그아웃 성공
toast({
  title: "로그아웃되었습니다",
  description: "다음에 또 만나요!",
  variant: "default",
});

// 회원가입 성공
toast({
  title: "회원가입 완료",
  description: "Rural Rest에 오신 것을 환영합니다!",
  variant: "default",
});
```

### 4.3. Form Validation Error Display
*   **인라인 에러**: Zod 유효성 검사 실패 시 각 필드 아래에 에러 메시지 표시 (shadcn/ui FormMessage)
*   **Toast 에러**: 서버 측 유효성 검사 실패 또는 비즈니스 로직 에러는 Toast로 표시

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - 사이트맵 및 사용자 플로우
- **Foundation**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - Toast 컴포넌트 디자인 가이드라인 (Section 5.3)
- **Prototype**: [Admin Dashboard Review](../02_UI_Screens/03_ADMIN_DASHBOARD_REVIEW.md) - Admin Dashboard UI 및 Loader 구현 상태
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - 데이터베이스 스키마 명세
- **Specs**: [Admin Management Spec](./04_ADMIN_MANAGEMENT_SPEC.md) - 호스트 관리 명세 및 구현 상태 (Section 1.1)
- **Logic**: [Backlog](../04_Logic_Progress/00_BACKLOG.md) - Admin Dashboard 데이터 연동 완료, Listing Create/Update 및 예약 승인 미구현 (Section 2)
- **Logic**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 생성 및 승인 로직 (에러 처리 포함)
- **Logic**: [Search Algorithm](../04_Logic_Progress/02_SEARCH_ALGORITHM.md) - 상세 검색 필터링 알고리즘
- **Logic**: [Search & Filter UI Logic](../04_Logic_Progress/07_SEARCH_AND_FILTER_LOGIC.md) - 스마트 검색 바 작동 원리
- **Logic**: [Translation Engine](../04_Logic_Progress/04_TRANSLATION_ENGINE.md) - 번역 API 연동 로직
- **Logic**: [Transport Concierge](../04_Logic_Progress/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 예약 서비스 로직
- **Logic**: [Auth & Session](../04_Logic_Progress/06_AUTH_AND_SESSION_LOGIC.md) - 인증 및 세션 관리 로직
- **Test**: [Test Scenarios](../05_QA_Validation/01_TEST_SCENARIOS.md) - 에러 핸들링 테스트 케이스 (Section 4)
