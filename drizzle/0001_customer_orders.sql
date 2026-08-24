CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`customer_first_name` text NOT NULL,
	`customer_last_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`shipping_address` text NOT NULL,
	`shipping_district` text DEFAULT '' NOT NULL,
	`shipping_city` text NOT NULL,
	`shipping_postcode` text DEFAULT '' NOT NULL,
	`shipping_country` text DEFAULT 'Turkey' NOT NULL,
	`total_amount` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`payment_id` text,
	`shopier_random_nr` text NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_status_check" CHECK("orders"."status" IN ('pending', 'paid', 'failed', 'shipped', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);
--> statement-breakpoint
CREATE INDEX `orders_customer_email_idx` ON `orders` (`customer_email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_id_unique` ON `orders` (`payment_id`);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`product_id` integer,
	`product_name` text NOT NULL,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "order_items_quantity_check" CHECK("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id`);
--> statement-breakpoint
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id`);
