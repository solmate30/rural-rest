# 01. Database Schema Specification (Turso + Drizzle ORM)
> Created: 2026-02-07 17:15
> Last Updated: 2026-02-08 00:00

## 1. Technology Stack
*   **Database**: **Turso** (Build on libSQL, SQLite compatible Edge DB).
*   **ORM**: **Drizzle ORM** (`drizzle-orm/sqlite-core`).
*   **Hosting**: **Vercel** (Serverless).
*   **Framework**: **React Router v7** (Loader/Action).

## 2. Core Entities (ERD Overview)
The schema is designed for speed and simplicity, leveraging SQLite's JSON capabilities for flexibility.

### 2.1. `users` Table (Better Auth)
Stores authentication and profile information. Better Auth 기본 스키마를 확장하여 사용.
*   **id**: Text (UUID v4) [Primary Key]
*   **email**: Text [Unique, Not Null]
*   **name**: Text [Not Null] (Display Name)
*   **email_verified**: Integer (Boolean) [Default: false]
*   **image**: Text [Nullable] (Avatar URL)
*   **role**: Text ('guest', 'host', 'admin') [Default: 'guest'] - 추가 필드 (Better Auth `additionalFields`)
*   **preferred_lang**: Text [Default: 'en'] - 추가 필드 (자동 번역 채팅 기능에서 활용)
*   **created_at**: Integer (Timestamp) [Not Null]
*   **updated_at**: Integer (Timestamp) [Not Null]
*   **Note**: `password_hash`는 Better Auth의 `accounts` 테이블에 저장됨 (이메일/비밀번호 인증 시)

### 2.2. `sessions` Table (Better Auth)
Stores active user sessions for authentication.
*   **id**: Text (UUID v4) [Primary Key]
*   **expires_at**: Integer (Timestamp) [Not Null]
*   **token**: Text [Unique, Not Null]
*   **created_at**: Integer (Timestamp) [Not Null]
*   **updated_at**: Integer (Timestamp) [Not Null]
*   **ip_address**: Text [Nullable]
*   **user_agent**: Text [Nullable]
*   **user_id**: Text [Foreign Key -> users.id, Not Null]

### 2.3. `accounts` Table (Better Auth)
Stores OAuth provider accounts and email/password credentials.
*   **id**: Text (UUID v4) [Primary Key]
*   **account_id**: Text [Not Null] (Provider-specific user ID)
*   **provider_id**: Text [Not Null] ('google', 'kakao', 'credential')
*   **user_id**: Text [Foreign Key -> users.id, Not Null]
*   **access_token**: Text [Nullable]
*   **refresh_token**: Text [Nullable]
*   **id_token**: Text [Nullable]
*   **access_token_expires_at**: Integer (Timestamp) [Nullable]
*   **refresh_token_expires_at**: Integer (Timestamp) [Nullable]
*   **scope**: Text [Nullable]
*   **password**: Text [Nullable] (Hashed password for email/password auth)
*   **created_at**: Integer (Timestamp) [Not Null]
*   **updated_at**: Integer (Timestamp) [Not Null]

### 2.4. `verification` Table (Better Auth)
Stores email verification tokens and password reset tokens.
*   **id**: Text (UUID v4) [Primary Key]
*   **identifier**: Text [Not Null] (Email address)
*   **value**: Text [Not Null] (Verification token)
*   **expires_at**: Integer (Timestamp) [Not Null]
*   **created_at**: Integer (Timestamp) [Nullable]
*   **updated_at**: Integer (Timestamp) [Nullable]


### 2.6. `listings` Table
Stores rural accommodation details.
*   **id**: Text (UUID v4) [Primary Key]
*   **host_id**: Text [Foreign Key -> users.id]
*   **title**: Text [Not Null]
*   **description**: Text [Not Null]
*   **price_per_night**: Integer [Not Null] (Currency: USD/KRW based on locale settings, stored as integer cents/won)
*   **max_guests**: Integer [Not Null]
*   **location**: Text [Not Null] (Village Name / Address)
*   **amenities**: Text (JSON String) [Default: '[]'] (Flexibility for WiFi, BBQ, etc.)
*   **images**: Text (JSON Array of URLs) [Default: '[]']
*   **transport_support**: Integer (Boolean 0/1) [Default: 0]
*   **smart_lock_enabled**: Integer (Boolean 0/1) [Default: 0]
*   **created_at**: Integer (Timestamp)

### 2.7. `bookings` Table
Manages reservations and payments.
*   **id**: Text (UUID v4) [Primary Key]
*   **listing_id**: Text [Foreign Key -> listings.id]
*   **guest_id**: Text [Foreign Key -> users.id]
*   **check_in**: Integer (Timestamp/Date) [Not Null]
*   **check_out**: Integer (Timestamp/Date) [Not Null]
*   **total_price**: Integer [Not Null]
*   **status**: Text ('pending', 'confirmed', 'cancelled', 'completed') [Default: 'pending']
*   **payment_intent_id**: Text [Nullable] (Stripe/PayPal Transaction ID)
*   **qr_code_token**: Text [Nullable] (Digital Key)
*   **qr_code_expires_at**: Integer [Nullable]
*   **created_at**: Integer (Timestamp)

### 2.8. `reviews` Table
Stores guest feedback and ratings.
*   **id**: Text (UUID v4) [Primary Key]
*   **booking_id**: Text [Foreign Key -> bookings.id]
*   **author_id**: Text [Foreign Key -> users.id]
*   **rating**: Integer [Not Null] (1-5)
*   **comment**: Text [Nullable]
*   **created_at**: Integer (Timestamp)

### 2.9. `activities` Table
Manages add-on rural experiences (Bul-meong, Kimchi Making).
*   **id**: Text (UUID v4) [Primary Key]
*   **listing_id**: Text [Foreign Key -> listings.id]
*   **title**: Text [Not Null] (e.g., 'Fire Gazing Kit')
*   **description**: Text [Nullable]
*   **price**: Integer [Not Null] (Add-on Cost)
*   **max_participants**: Integer [Nullable]
*   **is_active**: Integer (Boolean 0/1) [Default: 1]

### 2.10. `messages` Table (Chat)
Supports auto-translated communication.
*   **id**: Text (UUID v4) [Primary Key]
*   **booking_id**: Text [Foreign Key -> bookings.id]
*   **sender_id**: Text [Foreign Key -> users.id]
*   **original_content**: Text [Not Null]
*   **translated_content**: Text [Nullable]
*   **is_translation_success**: Integer (Boolean)
*   **created_at**: Integer (Timestamp)

### 2.11. `transport_requests` Table
Shuttle service and airport/terminal pickup requests.
*   **id**: Text (UUID v4) [Primary Key]
*   **booking_id**: Text [Foreign Key -> bookings.id]
*   **pickup_point**: Text [Not Null]
*   **arrival_time**: Integer (Timestamp)
*   **status**: Text ('scheduled', 'completed', 'cancelled')
*   **created_at**: Integer (Timestamp)

## 3. Drizzle Schema Example (TypeScript)
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['guest', 'host', 'admin'] }).default('guest'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const listings = sqliteTable('listings', {
  id: text('id').primaryKey(),
  hostId: text('host_id').references(() => users.id),
  title: text('title').notNull(),
  pricePerNight: integer('price_per_night').notNull(),
  amenities: text('amenities', { mode: 'json' }).$type<string[]>(), // JSON Capability
});
```

## 4. Key Decisions & Trade-offs
1.  **Why UUIDs?**: We use UUIDs (Text) instead of Auto-increment Integers to avoid enumeration attacks and make it easier to shard or merge databases later if needed (Turso supports this well).
2.  **JSON Usage**: Storing `amenities` and `images` as JSON strings simplifies the schema, avoiding complex join tables for simple lists. SQLite/Turso handles JSON very efficiently.
3.  **Timestamps**: Stored as Integers (Unix Epoch) for straightforward sorting and time zone independence.

## 5. Related Documents
- **Foundation**: [Product Specs](../01_Concept_Design/03_PRODUCT_SPECS.md) - MVP 기능 명세 및 사이트맵
- **Foundation**: [UI Design](../01_Concept_Design/05_UI_DESIGN.md) - 디자인 시스템 가이드라인
- **Specs**: [Admin Management Spec](./04_ADMIN_MANAGEMENT_SPEC.md) - 호스트용 관리 기능 명세
- **Logic**: [Booking State Machine](../04_Logic_Progress/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
- **Logic**: [Digital Key System](../04_Logic_Progress/03_DIGITAL_KEY_SYSTEM.md) - QR 체크인 로직
- **Logic**: [Translation Engine](../04_Logic_Progress/04_TRANSLATION_ENGINE.md) - 채팅 자동 번역 데이터 저장 방식
- **Logic**: [Transport Concierge](../04_Logic_Progress/05_TRANSPORT_CONCIERGE_LOGIC.md) - 셔틀 서비스 예약 데이터 저장 방식
- **Logic**: [Auth & Session](../04_Logic_Progress/06_AUTH_AND_SESSION_LOGIC.md) - `users`, `sessions`, `accounts` 테이블 사용 로직
