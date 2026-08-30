PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`campaign_label` text,
	`discount_percent` integer DEFAULT 0 NOT NULL,
	`hover_image` text,
	`xml_supplier_id` integer REFERENCES xml_suppliers(id) ON UPDATE no action ON DELETE set null,
	`xml_external_id` text,
	`xml_sync_status` text DEFAULT 'manual' NOT NULL,
	`slug` text DEFAULT '' NOT NULL,
	`meta_title` text,
	`meta_description` text,
	`cost` integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_products` (`id`, `name`, `stone`, `category`, `price`, `stock`, `image`, `badge`, `description`, `status`, `shopier_url`, `shopier_product_id`, `shopier_sync_status`, `featured`, `sort_order`, `created_at`, `updated_at`, `campaign_label`, `discount_percent`, `hover_image`, `xml_supplier_id`, `xml_external_id`, `xml_sync_status`, `slug`, `meta_title`, `meta_description`, `cost`)
SELECT `id`, `name`, `stone`, `category`, `price`, `stock`, `image`, `badge`, `description`, `status`, `shopier_url`, `shopier_product_id`, `shopier_sync_status`, `featured`, `sort_order`, `created_at`, `updated_at`, `campaign_label`, `discount_percent`, `hover_image`, `xml_supplier_id`, `xml_external_id`, `xml_sync_status`, `slug`, `meta_title`, `meta_description`, `cost` FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE UNIQUE INDEX `products_xml_source_unique` ON `products` (`xml_supplier_id`,`xml_external_id`);--> statement-breakpoint
CREATE INDEX `products_xml_supplier_idx` ON `products` (`xml_supplier_id`,`xml_sync_status`);--> statement-breakpoint
CREATE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE TRIGGER `products_auto_draft_on_zero_stock` AFTER UPDATE OF `stock` ON `products` WHEN NEW.stock <= 0 AND NEW.status = 'published' BEGIN UPDATE products SET status = 'draft' WHERE id = NEW.id; END;--> statement-breakpoint
CREATE TRIGGER `products_auto_draft_on_zero_stock_insert` AFTER INSERT ON `products` WHEN NEW.stock <= 0 AND NEW.status = 'published' BEGIN UPDATE products SET status = 'draft' WHERE id = NEW.id; END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
