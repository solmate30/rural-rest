import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
    id: text("id").primaryKey(), // UUID v4
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["guest", "host", "admin"] }).notNull().default("guest"),
    avatarUrl: text("avatar_url"),
    preferredLang: text("preferred_lang").notNull().default("en"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const listings = sqliteTable("listings", {
    id: text("id").primaryKey(), // UUID v4
    hostId: text("host_id").notNull().references(() => users.id),
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
    guestId: text("guest_id").notNull().references(() => users.id),
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
    authorId: text("author_id").notNull().references(() => users.id),
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
    senderId: text("sender_id").notNull().references(() => users.id),
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
