CREATE TABLE `excluded_supplier_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_id` integer NOT NULL,
	`external_id` text NOT NULL,
	`excluded_by` integer,
	`excluded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `xml_suppliers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`excluded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `excluded_supplier_products_unique` ON `excluded_supplier_products` (`supplier_id`,`external_id`);