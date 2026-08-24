CREATE TABLE `discount_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`discount_type` text DEFAULT 'percent' NOT NULL,
	`discount_value` integer NOT NULL,
	`minimum_order_amount` integer DEFAULT 0 NOT NULL,
	`usage_limit` integer DEFAULT 0 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`starts_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "discount_codes_type_check" CHECK("discount_codes"."discount_type" IN ('percent', 'fixed')),
	CONSTRAINT "discount_codes_value_check" CHECK("discount_codes"."discount_value" > 0),
	CONSTRAINT "discount_codes_limits_check" CHECK("discount_codes"."minimum_order_amount" >= 0 AND "discount_codes"."usage_limit" >= 0 AND "discount_codes"."used_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE INDEX `discount_codes_active_idx` ON `discount_codes` (`active`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_hash_unique` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_expiry_idx` ON `password_reset_tokens` (`expires_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `subtotal_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_code` text;--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;