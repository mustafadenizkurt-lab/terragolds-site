ALTER TABLE `products` ADD `campaign_label` text;--> statement-breakpoint
ALTER TABLE `products` ADD `discount_percent` integer DEFAULT 0 NOT NULL;
