ALTER TABLE `dm_members` ADD `cleared_history_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `user_hidden_messages` (
	`user_id` text NOT NULL,
	`message_id` text NOT NULL,
	`channel_type` text DEFAULT 'dm' NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `message_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_hidden_messages_user_id` ON `user_hidden_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_hidden_messages_message_id` ON `user_hidden_messages` (`message_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`channel_id` text,
	`actor_id` text NOT NULL,
	`target_user_id` text,
	`target_id` text,
	`action` text NOT NULL,
	`reason` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_space_id` ON `audit_logs` (`space_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_actor_id` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);
