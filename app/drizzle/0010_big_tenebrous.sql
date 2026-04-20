CREATE TYPE "public"."tool_instruction_suggestion_status" AS ENUM('pending', 'dismissed', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."tool_instruction_version_source" AS ENUM('manual', 'suggestion_accept', 'restore', 'tool_create', 'backfill');--> statement-breakpoint
CREATE TABLE "tool_instruction_suggestion_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"latest_why" text NOT NULL,
	"first_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_instruction_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"base_version_id" uuid NOT NULL,
	"learned" text NOT NULL,
	"normalized_learned" text NOT NULL,
	"status" "tool_instruction_suggestion_status" DEFAULT 'pending' NOT NULL,
	"dismissal_reason" text,
	"accepted_version_id" uuid,
	"decided_by_user_id" text,
	"decided_by_email" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_instruction_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tool_id" uuid NOT NULL,
	"instructions" text NOT NULL,
	"source" "tool_instruction_version_source" NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "current_instruction_version_id" uuid;--> statement-breakpoint
WITH "inserted_instruction_versions" AS (
	INSERT INTO "tool_instruction_versions" (
		"organization_id",
		"tool_id",
		"instructions",
		"source",
		"created_by_user_id",
		"created_by_email",
		"created_at"
	)
	SELECT
		"organization_id",
		"id",
		coalesce("instructions", ''),
		'backfill',
		"added_by_user_id",
		"added_by_email",
		"created_at"
	FROM "tools"
	RETURNING "id", "tool_id"
)
UPDATE "tools"
SET "current_instruction_version_id" = "inserted_instruction_versions"."id"
FROM "inserted_instruction_versions"
WHERE "tools"."id" = "inserted_instruction_versions"."tool_id";--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestion_agents" ADD CONSTRAINT "tool_instruction_suggestion_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestion_agents" ADD CONSTRAINT "tool_instruction_suggestion_agents_suggestion_id_tool_instruction_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."tool_instruction_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestion_agents" ADD CONSTRAINT "tool_instruction_suggestion_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestions" ADD CONSTRAINT "tool_instruction_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestions" ADD CONSTRAINT "tool_instruction_suggestions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestions" ADD CONSTRAINT "tool_instruction_suggestions_base_version_id_tool_instruction_versions_id_fk" FOREIGN KEY ("base_version_id") REFERENCES "public"."tool_instruction_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_suggestions" ADD CONSTRAINT "tool_instruction_suggestions_accepted_version_id_tool_instruction_versions_id_fk" FOREIGN KEY ("accepted_version_id") REFERENCES "public"."tool_instruction_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_versions" ADD CONSTRAINT "tool_instruction_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_instruction_versions" ADD CONSTRAINT "tool_instruction_versions_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestion_agents_organization_id_idx" ON "tool_instruction_suggestion_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestion_agents_suggestion_id_idx" ON "tool_instruction_suggestion_agents" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestion_agents_agent_id_idx" ON "tool_instruction_suggestion_agents" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_instruction_suggestion_agents_suggestion_agent_idx" ON "tool_instruction_suggestion_agents" USING btree ("suggestion_id","agent_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestions_organization_id_idx" ON "tool_instruction_suggestions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestions_organization_status_idx" ON "tool_instruction_suggestions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tool_instruction_suggestions_tool_base_version_idx" ON "tool_instruction_suggestions" USING btree ("tool_id","base_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_instruction_suggestions_dedupe_idx" ON "tool_instruction_suggestions" USING btree ("organization_id","tool_id","base_version_id","normalized_learned");--> statement-breakpoint
CREATE INDEX "tool_instruction_versions_organization_id_idx" ON "tool_instruction_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_versions_tool_id_idx" ON "tool_instruction_versions" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "tool_instruction_versions_tool_created_idx" ON "tool_instruction_versions" USING btree ("tool_id","created_at");
