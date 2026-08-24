CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`stone` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Doğal Taşlar' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`badge` text,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`shopier_url` text,
	`shopier_product_id` text,
	`shopier_sync_status` text DEFAULT 'manual' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
