CREATE TABLE `access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`denial_reason` text,
	`credential_encrypted` text,
	`requested_at` integer NOT NULL,
	`decided_by_user_id` text,
	`decided_by_email` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `access_grants_organization_id_idx` ON `access_grants` (`organization_id`);--> statement-breakpoint
CREATE INDEX `access_grants_agent_id_idx` ON `access_grants` (`agent_id`);--> statement-breakpoint
CREATE INDEX `access_grants_tool_id_idx` ON `access_grants` (`tool_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `access_grants_agent_tool_idx` ON `access_grants` (`agent_id`,`tool_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`api_key_hash` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agents_organization_id_idx` ON `agents` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agents_api_key_hash_idx` ON `agents` (`api_key_hash`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_label` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_log_organization_created_idx` ON `audit_log` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_id`);--> statement-breakpoint
CREATE TABLE `auth_login_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`turnstile_passed` integer DEFAULT false NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_login_tokens_token_hash_idx` ON `auth_login_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_login_tokens_email_created_idx` ON `auth_login_tokens` (`email`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`selected_organization_id` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`selected_organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_idx` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_id_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invites_org_email_idx` ON `organization_invites` (`organization_id`,`email`);--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`legacy_clerk_membership_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `organization_memberships_organization_id_idx` ON `organization_memberships` (`organization_id`);--> statement-breakpoint
CREATE INDEX `organization_memberships_user_id_idx` ON `organization_memberships` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_memberships_organization_user_idx` ON `organization_memberships` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `organization_notification_settings` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`slack_webhook_encrypted` text,
	`discord_webhook_encrypted` text,
	`last_slack_delivery_status` text,
	`last_slack_delivery_at` integer,
	`last_slack_error` text,
	`last_discord_delivery_status` text,
	`last_discord_delivery_at` integer,
	`last_discord_error` text,
	`updated_by_user_id` text NOT NULL,
	`updated_by_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `organization_notification_settings_updated_at_idx` ON `organization_notification_settings` (`updated_at`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_clerk_org_id` text,
	`name` text NOT NULL,
	`slug` text,
	`onboarding_dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_legacy_clerk_org_id_idx` ON `organizations` (`legacy_clerk_org_id`);--> statement-breakpoint
CREATE TABLE `rate_limit_buckets` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL,
	`window_ms` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_buckets_updated_at_idx` ON `rate_limit_buckets` (`updated_at`);--> statement-breakpoint
CREATE TABLE `tool_instruction_suggestion_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`suggestion_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`latest_why` text NOT NULL,
	`first_requested_at` integer NOT NULL,
	`last_requested_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggestion_id`) REFERENCES `tool_instruction_suggestions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestion_agents_organization_id_idx` ON `tool_instruction_suggestion_agents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestion_agents_suggestion_id_idx` ON `tool_instruction_suggestion_agents` (`suggestion_id`);--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestion_agents_agent_id_idx` ON `tool_instruction_suggestion_agents` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tool_instruction_suggestion_agents_suggestion_agent_idx` ON `tool_instruction_suggestion_agents` (`suggestion_id`,`agent_id`);--> statement-breakpoint
CREATE TABLE `tool_instruction_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`base_version_id` text NOT NULL,
	`learned` text NOT NULL,
	`normalized_learned` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`dismissal_reason` text,
	`accepted_version_id` text,
	`decided_by_user_id` text,
	`decided_by_email` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`base_version_id`) REFERENCES `tool_instruction_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_version_id`) REFERENCES `tool_instruction_versions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestions_organization_id_idx` ON `tool_instruction_suggestions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestions_organization_status_idx` ON `tool_instruction_suggestions` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `tool_instruction_suggestions_tool_base_version_idx` ON `tool_instruction_suggestions` (`tool_id`,`base_version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tool_instruction_suggestions_dedupe_idx` ON `tool_instruction_suggestions` (`organization_id`,`tool_id`,`base_version_id`,`normalized_learned`);--> statement-breakpoint
CREATE TABLE `tool_instruction_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`tool_id` text NOT NULL,
	`instructions` text NOT NULL,
	`source` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_instruction_versions_organization_id_idx` ON `tool_instruction_versions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_instruction_versions_tool_id_idx` ON `tool_instruction_versions` (`tool_id`);--> statement-breakpoint
CREATE INDEX `tool_instruction_versions_tool_created_idx` ON `tool_instruction_versions` (`tool_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tool_suggestion_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`suggestion_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`latest_reason` text NOT NULL,
	`first_requested_at` integer NOT NULL,
	`last_requested_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggestion_id`) REFERENCES `tool_suggestions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_suggestion_agents_organization_id_idx` ON `tool_suggestion_agents` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_suggestion_agents_suggestion_id_idx` ON `tool_suggestion_agents` (`suggestion_id`);--> statement-breakpoint
CREATE INDEX `tool_suggestion_agents_agent_id_idx` ON `tool_suggestion_agents` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tool_suggestion_agents_suggestion_agent_idx` ON `tool_suggestion_agents` (`suggestion_id`,`agent_id`);--> statement-breakpoint
CREATE TABLE `tool_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`url` text,
	`normalized_domain` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`dismissed_until` integer,
	`converted_tool_id` text,
	`decided_by_user_id` text,
	`decided_by_email` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`converted_tool_id`) REFERENCES `tools`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tool_suggestions_organization_id_idx` ON `tool_suggestions` (`organization_id`);--> statement-breakpoint
CREATE INDEX `tool_suggestions_organization_status_idx` ON `tool_suggestions` (`organization_id`,`status`);--> statement-breakpoint
CREATE INDEX `tool_suggestions_organization_domain_idx` ON `tool_suggestions` (`organization_id`,`normalized_domain`);--> statement-breakpoint
CREATE INDEX `tool_suggestions_organization_name_idx` ON `tool_suggestions` (`organization_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `tools` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`config_key` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text,
	`auth_type` text NOT NULL,
	`credential_mode` text NOT NULL,
	`credential_encrypted` text,
	`credential_last_rotated_at` integer,
	`credential_expires_at` integer,
	`instructions` text,
	`current_instruction_version_id` text,
	`added_by_user_id` text NOT NULL,
	`added_by_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tools_organization_id_idx` ON `tools` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tools_organization_config_key_idx` ON `tools` (`organization_id`,`config_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`legacy_clerk_user_id` text,
	`last_signed_in_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_legacy_clerk_user_id_idx` ON `users` (`legacy_clerk_user_id`);