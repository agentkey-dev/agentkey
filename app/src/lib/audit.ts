import { auditLog, type AuditActorType } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";

type AuditWriter = {
  insert: ReturnType<typeof getDb>["insert"];
};

export async function appendAuditLog(entry: {
  organizationId: string;
  actorType: AuditActorType;
  actorId: string;
  actorLabel: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}, db: AuditWriter = getDb()) {
  await db.insert(auditLog).values({
    organizationId: entry.organizationId,
    actorType: entry.actorType,
    actorId: entry.actorId,
    actorLabel: entry.actorLabel,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
  });
}
