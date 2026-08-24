CREATE TABLE `email_verification_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`email` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "email_verification_tokens_kind_check" CHECK("email_verification_tokens"."kind" IN ('account', 'checkout'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_tokens_hash_unique` ON `email_verification_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_user_idx` ON `email_verification_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_email_kind_idx` ON `email_verification_tokens` (`email`,`kind`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_expiry_idx` ON `email_verification_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `system_test_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_id` text NOT NULL,
	`kind` text NOT NULL,
	`scenario` text DEFAULT 'success' NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "system_test_runs_status_check" CHECK("system_test_runs"."status" IN ('passed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_test_runs_test_id_unique` ON `system_test_runs` (`test_id`);--> statement-breakpoint
CREATE INDEX `system_test_runs_created_idx` ON `system_test_runs` (`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
UPDATE `users`
SET `email_verified_at` = CURRENT_TIMESTAMP
WHERE `email_verified_at` IS NULL;
