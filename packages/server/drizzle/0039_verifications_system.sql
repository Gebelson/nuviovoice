ALTER TABLE `users` ADD `verification_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `verification_category` text;--> statement-breakpoint
ALTER TABLE `spaces` ADD `verification_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `spaces` ADD `verification_category` text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `entity_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`method` text DEFAULT 'manual_review' NOT NULL,
	`public_label` text,
	`approved_by_admin_id` text REFERENCES `users`(`id`),
	`approved_at` integer NOT NULL,
	`revoked_by_admin_id` text REFERENCES `users`(`id`),
	`revoked_at` integer,
	`revoked_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entity_verif_target` ON `entity_verifications` (`target_type`, `target_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entity_verif_status` ON `entity_verifications` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_entity_verif_category` ON `entity_verifications` (`category`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_user_id` text NOT NULL REFERENCES `users`(`id`),
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`public_name` text NOT NULL,
	`activity_description` text,
	`official_website` text,
	`social_links` text DEFAULT '[]',
	`professional_links` text DEFAULT '[]',
	`domain_to_verify` text,
	`domain_token` text,
	`domain_verified` integer DEFAULT 0 NOT NULL,
	`evidence_notes` text,
	`rejection_reason` text,
	`info_request_notes` text,
	`reviewed_by_admin_id` text REFERENCES `users`(`id`),
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_req_status` ON `verification_requests` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_req_requester` ON `verification_requests` (`requester_user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_req_target` ON `verification_requests` (`target_type`, `target_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_req_created` ON `verification_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `verification_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`admin_id` text,
	`admin_username` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`request_id` text,
	`category` text NOT NULL,
	`justification` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_audit_target` ON `verification_audit_logs` (`target_type`, `target_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_audit_admin` ON `verification_audit_logs` (`admin_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verif_audit_created` ON `verification_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_spaces_verification` ON `spaces` (`verification_status`, `verification_category`);
