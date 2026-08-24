CREATE TABLE `product_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`verified_order_id` text,
	`rating` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`comment` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "product_reviews_rating_check" CHECK("product_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_reviews_user_product_unique` ON `product_reviews` (`user_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `product_reviews_product_id_idx` ON `product_reviews` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_reviews_user_id_idx` ON `product_reviews` (`user_id`);
