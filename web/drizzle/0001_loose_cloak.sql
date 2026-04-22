CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `ai_chat_threads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `local_gov_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`month` text NOT NULL,
	`gross_revenue_krw` integer NOT NULL,
	`operating_profit_krw` integer NOT NULL,
	`settlement_usdc` integer NOT NULL,
	`gov_wallet_address` text,
	`payout_tx` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operator_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`month` text NOT NULL,
	`gross_revenue_krw` integer NOT NULL,
	`operating_cost_krw` integer DEFAULT 0 NOT NULL,
	`operating_profit_krw` integer NOT NULL,
	`settlement_usdc` integer NOT NULL,
	`payout_tx` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rwa_dividends` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`user_id` text,
	`rwa_token_id` text NOT NULL,
	`month` text NOT NULL,
	`dividend_usdc` integer NOT NULL,
	`claim_tx` text,
	`claimed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rwa_token_id`) REFERENCES `rwa_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rwa_investments` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`user_id` text,
	`rwa_token_id` text NOT NULL,
	`token_amount` integer NOT NULL,
	`invested_usdc` integer NOT NULL,
	`purchase_tx` text,
	`refund_tx` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rwa_token_id`) REFERENCES `rwa_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rwa_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`token_mint` text,
	`symbol` text,
	`total_supply` integer NOT NULL,
	`tokens_sold` integer DEFAULT 0 NOT NULL,
	`valuation_krw` integer NOT NULL,
	`price_per_token_usdc` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`funding_deadline` integer NOT NULL,
	`estimated_apy_bps` integer DEFAULT 0 NOT NULL,
	`min_funding_bps` integer DEFAULT 6000 NOT NULL,
	`program_id` text NOT NULL,
	`last_settlement_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rwa_tokens_token_mint_unique` ON `rwa_tokens` (`token_mint`);--> statement-breakpoint
CREATE UNIQUE INDEX `rwa_tokens_symbol_unique` ON `rwa_tokens` (`symbol`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`month` text NOT NULL,
	`total_revenue_usdc` integer NOT NULL,
	`operating_cost_usdc` integer DEFAULT 0 NOT NULL,
	`gov_share_usdc` integer NOT NULL,
	`operator_share_usdc` integer NOT NULL,
	`investor_share_usdc` integer NOT NULL,
	`onchain_tx_signature` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'guest' NOT NULL,
	`preferred_lang` text DEFAULT 'en' NOT NULL,
	`wallet_address` text,
	`wallet_connected_at` text,
	`kyc_verified` integer DEFAULT false NOT NULL,
	`kyc_verified_at` text,
	`wallet_nonce` text,
	`wallet_nonce_issued_at` text,
	`privy_did` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_privy_did_unique` ON `user` (`privy_did`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`check_in` integer NOT NULL,
	`check_out` integer NOT NULL,
	`total_price` integer NOT NULL,
	`total_price_usdc` integer,
	`escrow_pda` text,
	`onchain_pay_tx` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_intent_id` text,
	`paypal_authorization_id` text,
	`paypal_capture_id` text,
	`platform_fee_krw` integer,
	`qr_code_token` text,
	`qr_code_expires_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bookings`("id", "listing_id", "guest_id", "check_in", "check_out", "total_price", "total_price_usdc", "escrow_pda", "onchain_pay_tx", "status", "payment_intent_id", "paypal_authorization_id", "paypal_capture_id", "platform_fee_krw", "qr_code_token", "qr_code_expires_at", "created_at") SELECT "id", "listing_id", "guest_id", "check_in", "check_out", "total_price", "total_price_usdc", "escrow_pda", "onchain_pay_tx", "status", "payment_intent_id", "paypal_authorization_id", "paypal_capture_id", "platform_fee_krw", "qr_code_token", "qr_code_expires_at", "created_at" FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`node_number` integer,
	`host_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price_per_night` integer NOT NULL,
	`valuation_krw` integer,
	`max_guests` integer NOT NULL,
	`location` text NOT NULL,
	`region` text DEFAULT '기타' NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`lat` real,
	`lng` real,
	`title_en` text,
	`description_en` text,
	`renovation_history` text DEFAULT '[]',
	`transport_support` integer DEFAULT false NOT NULL,
	`smart_lock_enabled` integer DEFAULT false NOT NULL,
	`gov_wallet_address` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_listings`("id", "node_number", "host_id", "title", "description", "price_per_night", "valuation_krw", "max_guests", "location", "region", "amenities", "images", "lat", "lng", "title_en", "description_en", "renovation_history", "transport_support", "smart_lock_enabled", "gov_wallet_address", "created_at") SELECT "id", "node_number", "host_id", "title", "description", "price_per_night", "valuation_krw", "max_guests", "location", "region", "amenities", "images", "lat", "lng", "title_en", "description_en", "renovation_history", "transport_support", "smart_lock_enabled", "gov_wallet_address", "created_at" FROM `listings`;--> statement-breakpoint
DROP TABLE `listings`;--> statement-breakpoint
ALTER TABLE `__new_listings` RENAME TO `listings`;--> statement-breakpoint
CREATE UNIQUE INDEX `listings_node_number_unique` ON `listings` (`node_number`);--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`original_content` text NOT NULL,
	`translated_content` text,
	`is_translation_success` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "booking_id", "sender_id", "original_content", "translated_content", "is_translation_success", "created_at") SELECT "id", "booking_id", "sender_id", "original_content", "translated_content", "is_translation_success", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`author_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "booking_id", "author_id", "rating", "comment", "created_at") SELECT "id", "booking_id", "author_id", "rating", "comment", "created_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;