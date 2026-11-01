ALTER TABLE `users` ADD `friend_discovery_visibility` text DEFAULT 'everyone' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `receive_winks` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `users` SET `friend_discovery_visibility` = 'nobody' WHERE `discoverable` = 0;
