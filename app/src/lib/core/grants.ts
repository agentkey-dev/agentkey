import type { accessGrants, ToolCredentialMode } from "@/lib/db/schema";
import { AppError } from "@/lib/http";

type GrantSnapshot = {
  status: "pending" | "approved" | "denied" | "revoked";
};

// Database grant rows contain encrypted credentials; return only fields the
// dashboard uses and keep the stored secret out of browser/API responses.
export function toAccessGrantResponse(grant: typeof accessGrants.$inferSelect) {
  return {
    id: grant.id,
    organizationId: grant.organizationId,
    agentId: grant.agentId,
    toolId: grant.toolId,
    status: grant.status,
    reason: grant.reason,
    denialReason: grant.denialReason,
    decidedByUserId: grant.decidedByUserId,
    decidedByEmail: grant.decidedByEmail,
    requestedAt: grant.requestedAt,
    decidedAt: grant.decidedAt,
    createdAt: grant.createdAt,
    updatedAt: grant.updatedAt,
  };
}

export function assertGrantCanBeRequested(existing?: GrantSnapshot | null) {
  if (!existing) {
    return;
  }

  if (existing.status === "pending") {
    throw new AppError(
      "You already have a pending request for this tool.",
      409,
      "Wait for a human admin to review your existing request. Check status via GET /api/tools.",
    );
  }

  if (existing.status === "approved") {
    throw new AppError(
      "You already have access to this tool.",
      409,
      "Fetch your credentials via GET /api/tools/{tool_id}/credentials.",
    );
  }
}

export function assertApprovalInput(mode: ToolCredentialMode, credential?: string) {
  if (mode === "per_agent" && !credential?.trim()) {
    throw new AppError("Per-agent tools require a credential during approval.", 400);
  }
}
