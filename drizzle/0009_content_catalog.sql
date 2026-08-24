CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_name_unique` ON `product_categories` (`name`);--> statement-breakpoint
CREATE INDEX `product_categories_order_idx` ON `product_categories` (`active`,`sort_order`);--> statement-breakpoint
INSERT OR IGNORE INTO `product_categories`
  (`name`, `description`, `active`, `sort_order`)
SELECT `category`, '', 1, MIN(`sort_order`)
FROM `products`
WHERE TRIM(`category`) <> ''
GROUP BY `category`;--> statement-breakpoint
CREATE TABLE `site_content` (
	`key` text PRIMARY KEY NOT NULL,
	`draft_value` text DEFAULT '' NOT NULL,
	`published_value` text DEFAULT '' NOT NULL,
	`updated_by` integer,
	`published_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
