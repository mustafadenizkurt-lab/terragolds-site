ALTER TABLE `products` ADD `slug` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `meta_title` text;--> statement-breakpoint
ALTER TABLE `products` ADD `meta_description` text;--> statement-breakpoint
CREATE INDEX `products_slug_idx` ON `products` (`slug`);--> statement-breakpoint
CREATE TRIGGER `products_auto_draft_on_zero_stock` AFTER UPDATE OF `stock` ON `products` WHEN NEW.stock <= 0 AND NEW.status = 'published' BEGIN UPDATE products SET status = 'draft' WHERE id = NEW.id; END;--> statement-breakpoint
CREATE TRIGGER `products_auto_draft_on_zero_stock_insert` AFTER INSERT ON `products` WHEN NEW.stock <= 0 AND NEW.status = 'published' BEGIN UPDATE products SET status = 'draft' WHERE id = NEW.id; END;