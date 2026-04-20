ALTER TABLE "tools" ADD COLUMN "credential_last_rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tools" ADD COLUMN "credential_expires_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "tools"
SET "credential_last_rotated_at" = COALESCE(
  (
    SELECT MAX("audit_log"."created_at")
    FROM "audit_log"
    WHERE "audit_log"."organization_id" = "tools"."organization_id"
      AND "audit_log"."action" = 'tool.updated'
      AND COALESCE(("audit_log"."metadata" ->> 'rotatedCredential')::boolean, false)
      AND "audit_log"."target_type" = 'tool'
      AND "audit_log"."target_id" = "tools"."id"::text
  ),
  "tools"."created_at"
)
WHERE "tools"."credential_mode" = 'shared'
  AND "tools"."credential_encrypted" IS NOT NULL;
