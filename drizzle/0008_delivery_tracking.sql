CREATE TABLE `shipping_tracking_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`manual_delivery_enabled` integer DEFAULT true NOT NULL,
	`automatic_tracking_enabled` integer DEFAULT false NOT NULL,
	`provider_name` text DEFAULT '' NOT NULL,
	`api_base_url` text DEFAULT '' NOT NULL,
	`encrypted_credentials` text DEFAULT '' NOT NULL,
	`credential_hint` text DEFAULT '' NOT NULL,
	`updated_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "shipping_tracking_settings_singleton_check" CHECK("shipping_tracking_settings"."id" = 1)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
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
	`subtotal_amount` integer DEFAULT 0 NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`shipping_amount` integer DEFAULT 0 NOT NULL,
	`discount_code` text,
	`total_amount` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`payment_provider` text DEFAULT 'shopier' NOT NULL,
	`payment_reference` text,
	`payment_id` text,
	`shopier_random_nr` text NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`shipping_carrier` text DEFAULT '' NOT NULL,
	`tracking_number` text DEFAULT '' NOT NULL,
	`shipped_at` text,
	`delivered_at` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_status_check" CHECK("__new_orders"."status" IN ('pending', 'paid', 'failed', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_payment_provider_check" CHECK("__new_orders"."payment_provider" IN ('shopier', 'paytr', 'iyzico'))
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "user_id", "status", "customer_first_name", "customer_last_name", "customer_email", "customer_phone", "shipping_address", "shipping_district", "shipping_city", "shipping_postcode", "shipping_country", "subtotal_amount", "discount_amount", "shipping_amount", "discount_code", "total_amount", "currency", "payment_provider", "payment_reference", "payment_id", "shopier_random_nr", "customer_note", "shipping_carrier", "tracking_number", "shipped_at", "delivered_at", "paid_at", "created_at", "updated_at") SELECT "id", "user_id", "status", "customer_first_name", "customer_last_name", "customer_email", "customer_phone", "shipping_address", "shipping_district", "shipping_city", "shipping_postcode", "shipping_country", "subtotal_amount", "discount_amount", "shipping_amount", "discount_code", "total_amount", "currency", "payment_provider", "payment_reference", "payment_id", "shopier_random_nr", "customer_note", "shipping_carrier", "tracking_number", "shipped_at", NULL, "paid_at", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_customer_email_idx` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_id_unique` ON `orders` (`payment_id`);
