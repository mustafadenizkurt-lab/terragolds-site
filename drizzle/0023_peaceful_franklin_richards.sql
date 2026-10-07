CREATE TABLE `product_redirects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`old_slug` text NOT NULL,
	`target_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_redirects_old_slug_unique` ON `product_redirects` (`old_slug`);