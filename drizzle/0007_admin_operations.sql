CREATE TABLE `product_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`user_id` integer,
	`product_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_favorites_visitor_product_unique` ON `product_favorites` (`visitor_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_favorites_product_idx` ON `product_favorites` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_favorites_user_idx` ON `product_favorites` (`user_id`);--> statement-breakpoint
CREATE INDEX `product_favorites_created_idx` ON `product_favorites` (`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_carrier` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` text;
