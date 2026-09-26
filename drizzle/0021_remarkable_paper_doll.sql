PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'customer' NOT NULL,
	`session_version` integer DEFAULT 0 NOT NULL,
	`email_verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "first_name", "last_name", "email", "phone", "password_hash", "role", "session_version", "email_verified_at", "created_at", "updated_at") SELECT "id", "first_name", "last_name", "email", "phone", "password_hash", "role", "session_version", "email_verified_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);