CREATE TABLE `automod_infractions` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_automod_space_user` ON `automod_infractions` (`space_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `automod_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`rule_type` text NOT NULL,
	`pattern` text NOT NULL,
	`action` text NOT NULL,
	`enabled` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_automod_rules_space_id` ON `automod_rules` (`space_id`);--> statement-breakpoint
CREATE TABLE `bot_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`webhook_id` text,
	`command` text NOT NULL,
	`description` text DEFAULT '',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bot_commands_space_id` ON `bot_commands` (`space_id`);--> statement-breakpoint
CREATE TABLE `dm_group_epochs` (
	`dm_channel_id` text NOT NULL,
	`epoch` integer NOT NULL,
	`published_by` text NOT NULL,
	`signature` text NOT NULL,
	`roster` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`dm_channel_id`, `epoch`),
	FOREIGN KEY (`dm_channel_id`) REFERENCES `dm_channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sound_preferences` (
	`user_id` text NOT NULL,
	`space_id` text NOT NULL,
	`volume` real DEFAULT 1,
	`muted` integer DEFAULT 0,
	PRIMARY KEY(`user_id`, `space_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sounds` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	`filename` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sounds_space_id` ON `sounds` (`space_id`);--> statement-breakpoint
CREATE TABLE `user_signing_keys` (
	`user_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`jwk` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `fingerprint`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_party_members` (
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`session_id`, `user_id`),
	FOREIGN KEY (`session_id`) REFERENCES `watch_party_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `watch_party_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`host_user_id` text NOT NULL,
	`video_url` text NOT NULL,
	`video_type` text DEFAULT 'youtube',
	`current_time` real DEFAULT 0,
	`state` text DEFAULT 'waiting',
	`is_exclusive` integer DEFAULT 1,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_watch_party_channel_id` ON `watch_party_sessions` (`channel_id`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`space_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`token` text NOT NULL,
	`callback_url` text,
	`callback_secret` text,
	`subscribed_events` text DEFAULT '*',
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhooks_channel_id` ON `webhooks` (`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_webhooks_space_id` ON `webhooks` (`space_id`);