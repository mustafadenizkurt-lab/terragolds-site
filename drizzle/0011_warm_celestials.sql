CREATE TABLE `return_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`order_number` text NOT NULL,
	`product_description` text NOT NULL,
	`tracking_number` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`iban` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "return_requests_status_check" CHECK("return_requests"."status" IN ('new', 'reviewing', 'approved', 'rejected', 'completed'))
);
--> statement-breakpoint
CREATE INDEX `return_requests_status_idx` ON `return_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `return_requests_email_idx` ON `return_requests` (`email`);
