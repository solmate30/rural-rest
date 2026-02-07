# 01. Database Schema Specification (Turso + Drizzle ORM)
> Created: 2026-02-07 17:15
> Last Updated: 2026-02-07 17:15

## 1. Technology Stack
*   **Database**: **Turso** (Build on libSQL, SQLite compatible Edge DB).
*   **ORM**: **Drizzle ORM** (`drizzle-orm/sqlite-core`).
*   **Hosting**: **Vercel** (Serverless).
*   **Framework**: **React Router v7** (Loader/Action).

## 2. Core Entities (ERD Overview)
The schema is designed for speed and simplicity, leveraging SQLite's JSON capabilities for flexibility.

### 2.1. `users` Table
Stores authentication and profile information.
*   **id**: Text (UUID v4) [Primary Key]
*   **email**: Text [Unique, Not Null]
*   **password_hash**: Text [Not Null] (Argon2 or similar)
*   **name**: Text [Not Null] (Display Name)
*   **role**: Text ('guest', 'host', 'admin') [Default: 'guest']
*   **avatar_url**: Text [Nullable]
*   **created_at**: Integer (Timestamp) [Not Null, Default: now()]

### 2.2. `listings` Table
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
*   **created_at**: Integer (Timestamp)

### 2.3. `bookings` Table
Manages reservations and payments.
*   **id**: Text (UUID v4) [Primary Key]
*   **listing_id**: Text [Foreign Key -> listings.id]
*   **guest_id**: Text [Foreign Key -> users.id]
*   **check_in**: Integer (Timestamp/Date) [Not Null]
*   **check_out**: Integer (Timestamp/Date) [Not Null]
*   **total_price**: Integer [Not Null]
*   **status**: Text ('pending', 'confirmed', 'cancelled', 'completed') [Default: 'pending']
*   **payment_intent_id**: Text [Nullable] (Stripe/PayPal Transaction ID)
*   **created_at**: Integer (Timestamp)

### 2.4. `reviews` Table
Stores guest feedback and ratings.
*   **id**: Text (UUID v4) [Primary Key]
*   **booking_id**: Text [Foreign Key -> bookings.id]
*   **author_id**: Text [Foreign Key -> users.id]
*   **rating**: Integer [Not Null] (1-5)
*   **comment**: Text [Nullable]
*   **created_at**: Integer (Timestamp)

### 2.5. `activities` Table
Manages add-on rural experiences (Bul-meong, Kimchi Making).
*   **id**: Text (UUID v4) [Primary Key]
*   **listing_id**: Text [Foreign Key -> listings.id]
*   **title**: Text [Not Null] (e.g., 'Fire Gazing Kit')
*   **description**: Text [Nullable]
*   **price**: Integer [Not Null] (Add-on Cost)
*   **max_participants**: Integer [Nullable]
*   **is_active**: Integer (Boolean 0/1) [Default: 1]

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
- **Foundation**: [Product Specs](../01_Foundation/03_PRODUCT_SPECS.md) - MVP 기능 명세 및 사이트맵
- **Foundation**: [UI Design](../01_Foundation/05_UI_DESIGN.md) - 디자인 시스템 가이드라인
- **Logic**: [Booking State Machine](../04_Logic/01_BOOKING_STATE_MACHINE.md) - 예약 상태 관리 로직
