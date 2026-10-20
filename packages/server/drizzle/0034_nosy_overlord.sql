CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '',
	`icon` text DEFAULT 'Package',
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_slug_unique` ON `product_categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_product_categories_slug` ON `product_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_product_categories_sort` ON `product_categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `product_favorites` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_favorites_user_id` ON `product_favorites` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_product_favorites_product_id` ON `product_favorites` (`product_id`);--> statement-breakpoint
CREATE TABLE `product_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '',
	`status` text DEFAULT 'pending' NOT NULL,
	`action_taken` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_product_reports_product_id` ON `product_reports` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_reports_reporter_id` ON `product_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `idx_product_reports_status` ON `product_reports` (`status`);--> statement-breakpoint
CREATE TABLE `product_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`short_description` text DEFAULT '',
	`price` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`thumbnail` text,
	`images` text DEFAULT '[]',
	`layout_data` text DEFAULT '[]' NOT NULL,
	`custom_css` text DEFAULT '',
	`status` text DEFAULT 'draft' NOT NULL,
	`review_notes` text,
	`submitted_at` integer,
	`reviewed_at` integer,
	`reviewed_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_product_revisions_product_id` ON `product_revisions` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_revisions_status` ON `product_revisions` (`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`short_description` text DEFAULT '',
	`product_type` text DEFAULT 'digital' NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`thumbnail` text,
	`images` text DEFAULT '[]',
	`status` text DEFAULT 'draft' NOT NULL,
	`published_revision_id` text,
	`sales_count` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 5 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_seller_id` ON `products` (`seller_id`);--> statement-breakpoint
CREATE INDEX `idx_products_category_id` ON `products` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_slug` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_status` ON `products` (`status`);--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store_name` text NOT NULL,
	`slug` text NOT NULL,
	`bio` text DEFAULT '',
	`avatar` text,
	`banner` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`contact_email` text,
	`review_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_slug_unique` ON `sellers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sellers_user_id` ON `sellers` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sellers_slug` ON `sellers` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_sellers_status` ON `sellers` (`status`);--> statement-breakpoint
CREATE TABLE `voice_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`space_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_invites_token_unique` ON `voice_invites` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_voice_invites_token` ON `voice_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_voice_invites_space_id` ON `voice_invites` (`space_id`);--> statement-breakpoint
CREATE INDEX `idx_voice_invites_channel_id` ON `voice_invites` (`channel_id`);