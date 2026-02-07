# 02. API Specification (React Router v7 Pattern)
> Created: 2026-02-07 17:25
> Last Updated: 2026-02-07 17:25

## 1. Architecture Overview
*   **Framework**: React Router v7 (Serverless Functions via Vercel).
*   **Data Fetching**: Use `loader` for READ (GET). Parameters via `URLSearchParams`.
*   **Data Mutation**: Use `action` for WRITE (POST/PUT/DELETE). Form Data submission.
*   **Validation**: **Zod** for schema validation.
*   **Date Handling**: **Luxon** for timezone-aware date operations.
*   **File Storage**: **Cloudinary** for image optimization and delivery.

## 2. Shared Utilities (Server-Side)
These helper functions are used across multiple loaders and actions to ensure security and consistency.

### 2.1. `requireUser(request: Request)`
*   **Purpose**: Validates the session token from cookies/headers. Throws a redirect to `/login` if unauthorized.
*   **Returns**: `User` object (id, email, role).
*   **Usage**: Must be called at the start of any protected `loader` or `action`.

### 2.2. `getSupabaseServerClient(request: Request)`
*   **Purpose**: Returns an authenticated Supabase client instance for server-side DB operations.

## 3. Route Specifications

### 3.1. Landing Page (`/`)
*   **Loader (GET)**:
    *   **Purpose**: Fetch featured listings and popular categories.
    *   **Return Type**: `{ featuredListings: Listing[] }`
    *   **Caching**: Cache-Control: s-maxage=3600 (1 hour).

### 3.2. Search Results (`/search`)
*   **Loader (GET)**:
    *   **Query Params**:
        *   `location`: string (optional)
        *   `checkIn`: string (ISO Date)
        *   `checkOut`: string (ISO Date)
        *   `guests`: number (default: 1)
    *   **Logic**:
        1.  Parse params using **Zod**.
        2.  Query DB for listings matching location.
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

### 3.5. Admin Dashboard (`/host/dashboard`)
*   **Loader (GET)**:
    *   **Security**: `requireUser()` + Check `role === 'host'`.
    *   **Logic**:
        1.  Calculate total revenue (This Month).
        2.  Fetch upcoming bookings.
        3.  Get current occupancy rate.
    *   **Return Type**: `{ revenue: number, occupancy: number, recentBookings: Booking[], upcomingEvents: Activity[] }`

*   **Action (POST)**:
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

## 4. Error Handling
*   **401 Unauthorized**: Redirect to `/login`.
*   **404 Not Found**: Show custom `ErrorMessage` component.
*   **400 Bad Request**: Return `json({ error: ZodError })` to display form validation errors inline.

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - 사이트맵 및 사용자 플로우
- **Specs**: [Database Schema](./01_DB_SCHEMA.md) - 데이터베이스 스키마 명세
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 생성 및 승인 로직
- **Logic**: [Search Algorithm](../04_Logic/02_SEARCH_ALGORITHM.md) - 검색 및 필터링 알고리즘
- **Logic**: [Translation Engine](../04_Logic/04_TRANSLATION_ENGINE.md) - 번역 API 연동 로직
- **Logic**: [Transport Concierge](../04_Logic/05_TRANSPORT_CONCIERGE_LOGIC.md) - 교통 예약 서비스 로직
