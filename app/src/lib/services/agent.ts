import { and, desc, eq } from "drizzle-orm";

import { appendAuditLog } from "@/lib/audit";
import { assertGrantCanBeRequested } from "@/lib/core/grants";
import { decryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db/client";
import { accessGrants, tools } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import {
  notifyAccessRequestCreated,
  notifyInstructionSuggestionCreated,
  notifyToolSuggestionCreated,
} from "@/lib/services/notifications";
import { suggestToolInstruction as createToolInstructionSuggestion } from "@/lib/services/tool-instructions";
import { suggestTool as createToolSuggestion } from "@/lib/services/tool-suggestions";

export async function listToolsForAgent(
  organizationId: string,
  agentId: string,
) {
  const db = getDb();
  const [toolRows, grantRows] = await Promise.all([
    db.query.tools.findMany({
      where: eq(tools.organizationId, organizationId),
      orderBy: desc(tools.createdAt),
    }),
    db.query.accessGrants.findMany({
      where: and(
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.agentId, agentId),
      ),
    }),
  ]);

  const grantByTool = new Map(grantRows.map((grant) => [grant.toolId, grant]));

  return toolRows.map((tool) => {
    const grant = grantByTool.get(tool.id);

    return {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      your_access: grant?.status ?? "none",
      denial_reason: grant?.denialReason ?? undefined,
    };
  });
}

export async function requestAccess(
  organizationId: string,
  agentId: string,
  toolId: string,
  reason: string,
  agentName: string,
  appOrigin?: string,
) {
  const db = getDb();
  const tool = await db.query.tools.findFirst({
    where: and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)),
  });

  if (!tool) {
    throw new AppError(
      "Tool not found.",
      404,
      "Check the tool ID. Use GET /api/tools to browse available tools and their IDs.",
    );
  }

  const existing = await db.query.accessGrants.findFirst({
    where: and(
      eq(accessGrants.organizationId, organizationId),
      eq(accessGrants.agentId, agentId),
      eq(accessGrants.toolId, toolId),
    ),
  });

  assertGrantCanBeRequested(existing);

  let grantId = existing?.id;
  let requestedAt = new Date();

  if (existing) {
    const [updated] = await db
      .update(accessGrants)
      .set({
        status: "pending",
        reason,
        denialReason: null,
        credentialEncrypted: null,
        requestedAt,
        decidedByUserId: null,
        decidedByEmail: null,
        decidedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(accessGrants.id, existing.id))
      .returning();

    grantId = updated.id;
  } else {
    const [created] = await db
      .insert(accessGrants)
      .values({
        organizationId,
        agentId,
        toolId,
        status: "pending",
        reason,
        requestedAt,
      })
      .returning();

    grantId = created.id;
    requestedAt = created.requestedAt;
  }

  await appendAuditLog({
    organizationId,
    actorType: "agent",
    actorId: agentId,
    actorLabel: agentName,
    action: "grant.requested",
    targetType: "access_grant",
    targetId: grantId,
    metadata: { agentId, toolId, toolName: tool.name },
  });

  if (appOrigin) {
    try {
      await notifyAccessRequestCreated({
        organizationId,
        agentId,
        agentName,
        toolId,
        toolName: tool.name,
        reason,
        requestId: grantId,
        requestedAt,
        appOrigin,
      });
    } catch (error) {
      console.error("Failed to notify access request destinations", error);
    }
  }

  return { requestId: grantId };
}

export async function getCredentialForAgent(
  organizationId: string,
  agentId: string,
  toolId: string,
  agentName: string,
) {
  const db = getDb();
  const tool = await db.query.tools.findFirst({
    where: and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)),
  });

  if (!tool) {
    throw new AppError(
      "Tool not found.",
      404,
      "Check the tool ID. Use GET /api/tools to browse available tools and their IDs.",
    );
  }

  const grant = await db.query.accessGrants.findFirst({
    where: and(
      eq(accessGrants.organizationId, organizationId),
      eq(accessGrants.agentId, agentId),
      eq(accessGrants.toolId, toolId),
    ),
  });

  if (!grant || grant.status !== "approved") {
    let hint = "Request access first via POST /api/tools/{tool_id}/request with a reason.";
    if (grant) {
      if (grant.status === "pending") {
        hint = "Your request is pending human review. Check status via GET /api/tools.";
      } else if (grant.status === "denied") {
        hint = "Your request was denied. Check GET /api/tools for the denial_reason. You can submit a new request with a different justification.";
      } else if (grant.status === "revoked") {
        hint = "Your access was revoked. Submit a new request via POST /api/tools/{tool_id}/request.";
      }
    }
    throw new AppError("This tool has not been approved for the agent.", 403, hint);
  }

  const credentialEncrypted =
    tool.credentialMode === "shared"
      ? tool.credentialEncrypted
      : grant.credentialEncrypted;

  if (!credentialEncrypted) {
    throw new AppError("Credential is not configured.", 500);
  }

  const credential = decryptSecret(credentialEncrypted);

  await appendAuditLog({
    organizationId,
    actorType: "agent",
    actorId: agentId,
    actorLabel: agentName,
    action: "credential.vended",
    targetType: "tool",
    targetId: toolId,
    metadata: { agentId, toolId, toolName: tool.name },
  });

  return {
    toolId: tool.id,
    toolName: tool.name,
    authType: tool.authType,
    credential,
    instructions: tool.instructions ?? "",
  };
}

export async function suggestTool(
  organizationId: string,
  agentId: string,
  input: {
    name: string;
    url?: string;
    reason: string;
  },
  agentName: string,
  appOrigin?: string,
) {
  const result = await createToolSuggestion({
    organizationId,
    agentId,
    agentName,
    name: input.name,
    url: input.url,
    reason: input.reason,
  });

  if (
    result.outcome === "suggested" &&
    !result.existing &&
    appOrigin
  ) {
    try {
      await notifyToolSuggestionCreated({
        organizationId,
        agentId,
        agentName,
        suggestionId: result.suggestionId,
        toolName: input.name,
        toolUrl: input.url,
        reason: input.reason,
        requestedAt: result.requestedAt,
        appOrigin,
      });
    } catch (error) {
      console.error("Failed to notify tool suggestion destinations", error);
    }
  }

  return result;
}

export async function suggestToolInstruction(
  organizationId: string,
  agentId: string,
  toolId: string,
  input: {
    learned: string;
    why: string;
  },
  agentName: string,
  appOrigin?: string,
) {
  const tool = await getDb().query.tools.findFirst({
    where: and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)),
  });

  if (!tool) {
    throw new AppError(
      "Tool not found.",
      404,
      "Check the tool ID. Use GET /api/tools to browse available tools and their IDs.",
    );
  }

  const result = await createToolInstructionSuggestion({
    organizationId,
    agentId,
    agentName,
    toolId,
    learned: input.learned,
    why: input.why,
  });

  if (result.outcome === "suggested" && !result.existing && appOrigin) {
    try {
      await notifyInstructionSuggestionCreated({
        organizationId,
        agentId,
        agentName,
        suggestionId: result.suggestionId,
        toolId,
        toolName: tool.name,
        learned: input.learned,
        requestedAt: result.requestedAt,
        appOrigin,
      });
    } catch (error) {
      console.error("Failed to notify instruction suggestion destinations", error);
    }
  }

  return result;
}
