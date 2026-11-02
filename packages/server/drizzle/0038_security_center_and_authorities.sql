CREATE TABLE IF NOT EXISTS `safety_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `protocol` text NOT NULL UNIQUE,
  `reporter_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `channel_id` text,
  `space_id` text,
  `category` text NOT NULL,
  `priority` text NOT NULL DEFAULT 'medium',
  `description` text,
  `status` text NOT NULL DEFAULT 'pending',
  `assigned_admin_id` text REFERENCES `users`(`id`),
  `resolution_notes` text,
  `resolved_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_safety_reports_reporter` ON `safety_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_safety_reports_status` ON `safety_reports` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_safety_reports_priority` ON `safety_reports` (`priority`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_safety_reports_target` ON `safety_reports` (`target_type`, `target_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `safety_report_evidences` (
  `id` text PRIMARY KEY NOT NULL,
  `report_id` text NOT NULL REFERENCES `safety_reports`(`id`) ON DELETE CASCADE,
  `message_id` text,
  `content_snapshot` text,
  `author_id` text,
  `author_username` text,
  `timestamp` integer,
  `attachments` text,
  `sha256_hash` text NOT NULL,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_safety_report_ev_report` ON `safety_report_evidences` (`report_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `security_cases` (
  `id` text PRIMARY KEY NOT NULL,
  `protocol` text NOT NULL UNIQUE,
  `report_id` text REFERENCES `safety_reports`(`id`),
  `title` text NOT NULL,
  `category` text NOT NULL,
  `priority` text NOT NULL DEFAULT 'medium',
  `status` text NOT NULL DEFAULT 'received',
  `subject_user_id` text REFERENCES `users`(`id`),
  `subject_username` text,
  `subject_space_id` text,
  `assigned_to` text REFERENCES `users`(`id`),
  `summary` text,
  `resolution` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_cases_status` ON `security_cases` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_cases_subject_user` ON `security_cases` (`subject_user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evidence_vault` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text REFERENCES `security_cases`(`id`),
  `report_id` text REFERENCES `safety_reports`(`id`),
  `evidence_type` text NOT NULL,
  `collected_by` text NOT NULL,
  `source` text NOT NULL,
  `hash_sha256` text NOT NULL,
  `payload_encrypted` text NOT NULL,
  `metadata` text NOT NULL,
  `is_extremely_sensitive` integer NOT NULL DEFAULT 0,
  `custody_log` text NOT NULL DEFAULT '[]',
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evidence_vault_case` ON `evidence_vault` (`case_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `authority_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `protocol_number` text NOT NULL,
  `requesting_body` text NOT NULL,
  `authority_name` text NOT NULL,
  `authority_contact` text NOT NULL,
  `request_type` text NOT NULL,
  `legal_basis` text NOT NULL,
  `target_user_id` text,
  `target_space_id` text,
  `status` text NOT NULL DEFAULT 'received',
  `preservation_until` integer,
  `notes` text,
  `created_admin_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_authority_requests_status` ON `authority_requests` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_authority_requests_protocol` ON `authority_requests` (`protocol_number`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `security_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `alert_type` text NOT NULL,
  `severity` text NOT NULL DEFAULT 'medium',
  `subject_user_id` text,
  `subject_username` text,
  `subject_space_id` text,
  `technical_explanation` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_alerts_status` ON `security_alerts` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_alerts_subject` ON `security_alerts` (`subject_user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `security_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text NOT NULL,
  `admin_username` text,
  `action` text NOT NULL,
  `resource_type` text NOT NULL,
  `resource_id` text,
  `case_id` text,
  `justification` text NOT NULL,
  `ip` text,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_audit_admin` ON `security_audit_logs` (`admin_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_audit_action` ON `security_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_security_audit_created` ON `security_audit_logs` (`created_at`);
