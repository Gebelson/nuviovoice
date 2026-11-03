ALTER TABLE `space_members` ADD `avatar` text;--> statement-breakpoint
ALTER TABLE `space_members` ADD `allow_dms` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `space_members` ADD `allow_friend_requests` integer DEFAULT 1 NOT NULL;
