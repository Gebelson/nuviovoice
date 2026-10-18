ALTER TABLE `spaces` ADD `type` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `spaces` ADD `full_description` text;--> statement-breakpoint
ALTER TABLE `spaces` ADD `category` text;--> statement-breakpoint
ALTER TABLE `spaces` ADD `tags` text DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `spaces` ADD `rules` text;--> statement-breakpoint
ALTER TABLE `spaces` ADD `publication_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `published_at` integer;--> statement-breakpoint
CREATE INDEX `idx_spaces_type_pub_status` ON `spaces` (`type`,`publication_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spaces_slug` ON `spaces` (`slug`);
