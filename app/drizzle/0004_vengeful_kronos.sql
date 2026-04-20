ALTER TABLE "tools" ADD COLUMN "config_key" text;--> statement-breakpoint
DO $$
DECLARE
  tool_record RECORD;
  base_key text;
  candidate text;
  suffix integer;
BEGIN
  FOR tool_record IN
    SELECT
      id,
      organization_id,
      coalesce(
        nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
        'tool'
      ) AS base_key
    FROM tools
    ORDER BY organization_id, created_at, id
  LOOP
    base_key := tool_record.base_key;
    candidate := base_key;
    suffix := 2;

    WHILE EXISTS (
      SELECT 1
      FROM tools
      WHERE organization_id = tool_record.organization_id
        AND config_key = candidate
    ) LOOP
      candidate := base_key || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE tools
    SET config_key = candidate
    WHERE id = tool_record.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "tools" ALTER COLUMN "config_key" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tools_organization_config_key_idx" ON "tools" USING btree ("organization_id","config_key");
