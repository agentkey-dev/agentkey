CREATE TABLE "migration_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"migration_token_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"commit_result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_by_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "migration_previews" ADD CONSTRAINT "migration_previews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_previews" ADD CONSTRAINT "migration_previews_migration_token_id_migration_tokens_id_fk" FOREIGN KEY ("migration_token_id") REFERENCES "public"."migration_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_tokens" ADD CONSTRAINT "migration_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "migration_previews_organization_id_idx" ON "migration_previews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "migration_previews_token_id_idx" ON "migration_previews" USING btree ("migration_token_id");--> statement-breakpoint
CREATE INDEX "migration_tokens_organization_id_idx" ON "migration_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_tokens_token_hash_idx" ON "migration_tokens" USING btree ("token_hash");