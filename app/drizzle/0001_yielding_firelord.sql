CREATE TYPE "public"."notification_delivery_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TABLE "organization_notification_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"slack_webhook_encrypted" text,
	"discord_webhook_encrypted" text,
	"last_slack_delivery_status" "notification_delivery_status",
	"last_slack_delivery_at" timestamp with time zone,
	"last_slack_error" text,
	"last_discord_delivery_status" "notification_delivery_status",
	"last_discord_delivery_at" timestamp with time zone,
	"last_discord_error" text,
	"updated_by_user_id" text NOT NULL,
	"updated_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_notification_settings_updated_at_idx" ON "organization_notification_settings" USING btree ("updated_at");