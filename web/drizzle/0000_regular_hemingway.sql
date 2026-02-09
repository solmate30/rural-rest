CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`max_participants` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`check_in` integer NOT NULL,
	`check_out` integer NOT NULL,
	`total_price` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_intent_id` text,
	`qr_code_token` text,
	`qr_code_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price_per_night` integer NOT NULL,
	`max_guests` integer NOT NULL,
	`location` text NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`transport_support` integer DEFAULT false NOT NULL,
	`smart_lock_enabled` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`original_content` text NOT NULL,
	`translated_content` text,
	`is_translation_success` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`author_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transport_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`pickup_point` text NOT NULL,
	`arrival_time` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'guest' NOT NULL,
	`avatar_url` text,
	`preferred_lang` text DEFAULT 'en' NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);