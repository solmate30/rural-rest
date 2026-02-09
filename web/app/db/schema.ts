import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    role: text("role", { enum: ["guest", "host", "admin"] }).notNull().default("guest"),
    preferredLang: text("preferred_lang").notNull().default("en"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id),
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const listings = sqliteTable("listings", {
    id: text("id").primaryKey(), // UUID v4
    hostId: text("host_id").notNull().references(() => user.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    pricePerNight: integer("price_per_night").notNull(), // Stored in KRW/USD base unit (e.g., Won)
    maxGuests: integer("max_guests").notNull(),
    location: text("location").notNull(),
    amenities: text("amenities", { mode: "json" }).notNull().default("[]"), // Array of strings
    images: text("images", { mode: "json" }).notNull().default("[]"), // Array of URLs
    transportSupport: integer("transport_support", { mode: "boolean" }).notNull().default(false),
    smartLockEnabled: integer("smart_lock_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const bookings = sqliteTable("bookings", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    guestId: text("guest_id").notNull().references(() => user.id),
    checkIn: integer("check_in", { mode: "timestamp" }).notNull(), // Unix timestamp
    checkOut: integer("check_out", { mode: "timestamp" }).notNull(), // Unix timestamp
    totalPrice: integer("total_price").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "cancelled", "completed"] }).notNull().default("pending"),
    paymentIntentId: text("payment_intent_id"),
    qrCodeToken: text("qr_code_token"),
    qrCodeExpiresAt: integer("qr_code_expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const reviews = sqliteTable("reviews", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    authorId: text("author_id").notNull().references(() => user.id),
    rating: integer("rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const activities = sqliteTable("activities", {
    id: text("id").primaryKey(), // UUID v4
    listingId: text("listing_id").notNull().references(() => listings.id),
    title: text("title").notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    maxParticipants: integer("max_participants"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    senderId: text("sender_id").notNull().references(() => user.id),
    originalContent: text("original_content").notNull(),
    translatedContent: text("translated_content"),
    isTranslationSuccess: integer("is_translation_success", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const transportRequests = sqliteTable("transport_requests", {
    id: text("id").primaryKey(), // UUID v4
    bookingId: text("booking_id").notNull().references(() => bookings.id),
    pickupPoint: text("pickup_point").notNull(),
    arrivalTime: integer("arrival_time", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull().default("scheduled"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});
