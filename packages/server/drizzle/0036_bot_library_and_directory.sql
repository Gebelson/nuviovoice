ALTER TABLE `users` ADD `is_bot` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `bot_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '',
	`icon` text DEFAULT 'Bot',
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bot_categories_slug` ON `bot_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_bot_categories_sort` ON `bot_categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '',
	`avatar` text,
	`banner` text,
	`developer_id` text NOT NULL,
	`bot_user_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`is_verified` integer DEFAULT 0 NOT NULL,
	`is_official` integer DEFAULT 0 NOT NULL,
	`prefix` text DEFAULT '/' NOT NULL,
	`website_url` text,
	`support_url` text,
	`privacy_policy_url` text,
	`webhook_url` text,
	`webhook_secret` text,
	`bot_token` text,
	`required_permissions` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`commands` text DEFAULT '[]' NOT NULL,
	`layout_data` text DEFAULT '[]' NOT NULL,
	`custom_css` text DEFAULT '',
	`install_count` integer DEFAULT 0 NOT NULL,
	`rating_average` real DEFAULT 5 NOT NULL,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`developer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bots_slug` ON `bots` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_bots_developer_id` ON `bots` (`developer_id`);--> statement-breakpoint
CREATE INDEX `idx_bots_bot_user_id` ON `bots` (`bot_user_id`);--> statement-breakpoint
CREATE INDEX `idx_bots_status` ON `bots` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bots_install_count` ON `bots` (`install_count`);--> statement-breakpoint
CREATE INDEX `idx_bots_rating` ON `bots` (`rating_average`);--> statement-breakpoint
CREATE TABLE `bot_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`space_id` text NOT NULL,
	`installed_by` text NOT NULL,
	`granted_permissions` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`installed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`installed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bot_installations_bot_space` ON `bot_installations` (`bot_id`, `space_id`);--> statement-breakpoint
CREATE INDEX `idx_bot_installations_space_id` ON `bot_installations` (`space_id`);--> statement-breakpoint
CREATE INDEX `idx_bot_installations_bot_id` ON `bot_installations` (`bot_id`);--> statement-breakpoint
CREATE TABLE `bot_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`developer_reply` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bot_reviews_bot_user` ON `bot_reviews` (`bot_id`, `user_id`);--> statement-breakpoint
CREATE INDEX `idx_bot_reviews_bot_id` ON `bot_reviews` (`bot_id`);--> statement-breakpoint
CREATE INDEX `idx_bot_reviews_user_id` ON `bot_reviews` (`user_id`);
