CREATE TABLE `xml_suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`feed_url` text NOT NULL,
	`field_mapping` text DEFAULT '{}' NOT NULL,
	`default_markup_percent` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `xml_suppliers_feed_url_unique` ON `xml_suppliers` (`feed_url`);--> statement-breakpoint
CREATE INDEX `xml_suppliers_active_idx` ON `xml_suppliers` (`active`);--> statement-breakpoint
CREATE TABLE `xml_sync_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer,
	`status` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`details` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `xml_suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "xml_sync_logs_status_check" CHECK("xml_sync_logs"."status" IN ('running', 'success', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `xml_sync_logs_supplier_idx` ON `xml_sync_logs` (`supplier_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `products` ADD `xml_supplier_id` integer REFERENCES xml_suppliers(id);--> statement-breakpoint
ALTER TABLE `products` ADD `xml_external_id` text;--> statement-breakpoint
ALTER TABLE `products` ADD `xml_sync_status` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `products_xml_source_unique` ON `products` (`xml_supplier_id`,`xml_external_id`);--> statement-breakpoint
CREATE INDEX `products_xml_supplier_idx` ON `products` (`xml_supplier_id`,`xml_sync_status`);