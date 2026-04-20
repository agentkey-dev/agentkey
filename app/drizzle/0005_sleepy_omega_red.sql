CREATE TYPE "public"."tool_suggestion_status" AS ENUM('pending', 'dismissed', 'accepted');--> statement-breakpoint
CREATE TABLE "tool_suggestion_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"latest_reason" text NOT NULL,
	"first_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"url" text,
	"normalized_domain" text,
	"status" "tool_suggestion_status" DEFAULT 'pending' NOT NULL,
	"dismissed_until" timestamp with time zone,
	"converted_tool_id" uuid,
	"decided_by_user_id" text,
	"decided_by_email" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_suggestion_agents" ADD CONSTRAINT "tool_suggestion_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_suggestion_agents" ADD CONSTRAINT "tool_suggestion_agents_suggestion_id_tool_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."tool_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_suggestion_agents" ADD CONSTRAINT "tool_suggestion_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_suggestions" ADD CONSTRAINT "tool_suggestions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_suggestions" ADD CONSTRAINT "tool_suggestions_converted_tool_id_tools_id_fk" FOREIGN KEY ("converted_tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tool_suggestion_agents_organization_id_idx" ON "tool_suggestion_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tool_suggestion_agents_suggestion_id_idx" ON "tool_suggestion_agents" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "tool_suggestion_agents_agent_id_idx" ON "tool_suggestion_agents" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_suggestion_agents_suggestion_agent_idx" ON "tool_suggestion_agents" USING btree ("suggestion_id","agent_id");--> statement-breakpoint
CREATE INDEX "tool_suggestions_organization_id_idx" ON "tool_suggestions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tool_suggestions_organization_status_idx" ON "tool_suggestions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tool_suggestions_organization_domain_idx" ON "tool_suggestions" USING btree ("organization_id","normalized_domain");--> statement-breakpoint
CREATE INDEX "tool_suggestions_organization_name_idx" ON "tool_suggestions" USING btree ("organization_id","normalized_name");