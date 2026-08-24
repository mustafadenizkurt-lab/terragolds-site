CREATE TABLE `payment_provider_settings` (
	`provider` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`test_mode` integer DEFAULT true NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`encrypted_credentials` text DEFAULT '' NOT NULL,
	`credential_hint` text DEFAULT '' NOT NULL,
	`updated_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "payment_provider_settings_provider_check" CHECK("payment_provider_settings"."provider" IN ('shopier', 'paytr', 'iyzico'))
);
--> statement-breakpoint
CREATE INDEX `payment_provider_settings_enabled_idx` ON `payment_provider_settings` (`enabled`,`is_primary`);--> statement-breakpoint
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
	`total_amount` integer NOT NULL,
	`currency` text DEFAULT 'TRY' NOT NULL,
	`payment_provider` text DEFAULT 'shopier' NOT NULL,
	`payment_reference` text,
	`payment_id` text,
	`shopier_random_nr` text NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "orders_status_check" CHECK("__new_orders"."status" IN ('pending', 'paid', 'failed', 'shipped', 'cancelled')),
	CONSTRAINT "orders_payment_provider_check" CHECK("__new_orders"."payment_provider" IN ('shopier', 'paytr', 'iyzico'))
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "user_id", "status", "customer_first_name", "customer_last_name", "customer_email", "customer_phone", "shipping_address", "shipping_district", "shipping_city", "shipping_postcode", "shipping_country", "total_amount", "currency", "payment_id", "shopier_random_nr", "customer_note", "paid_at", "created_at", "updated_at") SELECT "id", "user_id", "status", "customer_first_name", "customer_last_name", "customer_email", "customer_phone", "shipping_address", "shipping_district", "shipping_city", "shipping_postcode", "shipping_country", "total_amount", "currency", "payment_id", "shopier_random_nr", "customer_note", "paid_at", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_customer_email_idx` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_id_unique` ON `orders` (`payment_id`);
