import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { cache } from "react";

import {
  generateAgentApiKey,
  hashAgentApiKey,
} from "@/lib/agent-keys";
import { appendAuditLog } from "@/lib/audit";
import { assertApprovalInput } from "@/lib/core/grants";
import {
  diffToolCatalog,
  formatToolCatalog,
  getUniqueToolConfigKey,
  parseToolCatalogDocument,
  type ExistingToolConfigSnapshot,
  type ToolCatalogFormat,
} from "@/lib/core/tool-config";
import { encryptSecret } from "@/lib/crypto";
import { getOrganizationOnboardingState } from "@/lib/dashboard-onboarding";
import { getDb } from "@/lib/db/client";
import {
  accessGrants,
  agents,
  auditLog,
  organizations,
  toolInstructionSuggestions,
  toolSuggestions,
  toolInstructionVersions,
  tools,
  type AccessGrantStatus,
  type ToolCredentialMode,
} from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import {
  createAgentCatalogItem,
  type AgentCatalogItem,
  type AgentCatalogPendingToolSummary,
  type AgentRecentActivityEvent,
} from "@/lib/agent-catalog";
import type { ToolCatalogItem, ToolHealthStatus } from "@/lib/tool-catalog";
import { normalizeToolUrl } from "@/lib/tool-branding";
import {
  createToolInstructionVersion,
  getPendingToolInstructionSuggestionById,
  listPendingToolInstructionSuggestions,
} from "@/lib/services/tool-instructions";
import {
  getToolSuggestionById,
  listPendingToolSuggestions,
  resolveMatchingToolSuggestionsForTool,
} from "@/lib/services/tool-suggestions";

type Actor = {
  actorId: string;
  actorEmail: string;
};

const ACCESS_HISTORY_ACTIONS = [
  "grant.requested",
  "grant.assigned",
  "grant.approved",
  "grant.denied",
  "grant.revoked",
  "credential.vended",
] as const;
const STALE_ROTATION_DAYS = 90;
const EXPIRY_WARNING_DAYS = 14;

type ToolAccessSummary = {
  toolId: string;
  toolName: string;
};

type AgentAccessEvent = {
  id: string;
  action: (typeof ACCESS_HISTORY_ACTIONS)[number];
  createdAt: Date;
  toolId: string | null;
  toolName: string | null;
};

export type RecentToolActivityEvent = {
  id: string;
  action: string;
  createdAt: Date;
  actorLabel: string;
};

type AgentAccessLists = {
  granted: string[];
  pending: string[];
  grantedTools: ToolAccessSummary[];
  pendingTools: AgentCatalogPendingToolSummary[];
};

type AgentSummary = {
  agentId: string;
  agentName: string;
};

type ToolAccessLists = {
  approved: number;
  pending: number;
  approvedAgentList: AgentSummary[];
  pendingAgentList: AgentSummary[];
};

export type PendingAccessRequestItem = {
  kind: "access_request";
  id: string;
  agentId: string;
  agentName: string;
  agentDescription: string;
  toolId: string;
  toolName: string;
  toolCredentialMode: "shared" | "per_agent";
  reason: string | null;
  requestedAt: Date;
};

export type PendingAdminRequestItem =
  | PendingAccessRequestItem
  | Awaited<ReturnType<typeof listPendingToolInstructionSuggestions>>[number]
  | Awaited<ReturnType<typeof listPendingToolSuggestions>>[number];

type ToolHealthInput = Pick<
  typeof tools.$inferSelect,
  | "credentialMode"
  | "credentialEncrypted"
  | "credentialLastRotatedAt"
  | "credentialExpiresAt"
>;

function getWholeDayDiff(target: Date, now: Date) {
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  return Math.floor(
    (startOfTarget.getTime() - startOfNow.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function getDaysSince(date: Date, now: Date) {
  return Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function getToolHealthStatus(
  tool: ToolHealthInput,
  now = new Date(),
): ToolHealthStatus {
  if (tool.credentialMode === "per_agent") {
    return "healthy";
  }

  if (!tool.credentialEncrypted) {
    return "action_needed";
  }

  if (tool.credentialExpiresAt) {
    const expiryDayDelta = getWholeDayDiff(tool.credentialExpiresAt, now);

    if (expiryDayDelta < 0) {
      return "action_needed";
    }

    if (expiryDayDelta <= EXPIRY_WARNING_DAYS) {
      return "attention";
    }
  }

  if (
    tool.credentialLastRotatedAt &&
    getDaysSince(tool.credentialLastRotatedAt, now) > STALE_ROTATION_DAYS
  ) {
    return "attention";
  }

  return "healthy";
}

function toToolCatalogItem(
  tool: typeof tools.$inferSelect,
  summary?: ToolAccessLists,
): ToolCatalogItem {
  return {
    id: tool.id,
    configKey: tool.configKey,
    name: tool.name,
    description: tool.description,
    url: tool.url,
    authType: tool.authType,
    credentialMode: tool.credentialMode,
    instructions: tool.instructions,
    currentInstructionVersionId: tool.currentInstructionVersionId,
    credentialLastRotatedAt: tool.credentialLastRotatedAt,
    credentialExpiresAt: tool.credentialExpiresAt,
    healthStatus: getToolHealthStatus(tool),
    approvedAgents: summary?.approved ?? 0,
    pendingAgents: summary?.pending ?? 0,
    approvedAgentList: summary?.approvedAgentList ?? [],
    pendingAgentList: summary?.pendingAgentList ?? [],
  };
}

function getAgentIdsFilter(agentIds: string[]) {
  return sql`(${auditLog.metadata} ->> 'agentId') in (${sql.join(
    agentIds.map((agentId) => sql`${agentId}`),
    sql`, `,
  )})`;
}

export function summarizeAgentGrantRows(
  grantRows: Array<{
    agentId: string;
    requestId: string;
    status: AccessGrantStatus;
    toolId: string;
    toolName: string;
    toolCredentialMode: ToolCredentialMode;
  }>,
) {
  const grantsByAgent = new Map<string, AgentAccessLists>();

  for (const grant of grantRows) {
    const bucket = grantsByAgent.get(grant.agentId) ?? {
      granted: [],
      pending: [],
      grantedTools: [],
      pendingTools: [],
    };

    if (grant.status === "approved") {
      bucket.granted.push(grant.toolName);
      bucket.grantedTools.push({
        toolId: grant.toolId,
        toolName: grant.toolName,
      });
    }

    if (grant.status === "pending") {
      bucket.pending.push(grant.toolName);
      bucket.pendingTools.push({
        requestId: grant.requestId,
        toolId: grant.toolId,
        toolName: grant.toolName,
        toolCredentialMode: grant.toolCredentialMode,
      });
    }

    grantsByAgent.set(grant.agentId, bucket);
  }

  return grantsByAgent;
}

export function collectRecentAgentAccessEvents(
  rows: Array<{
    id: string;
    agentId: string | null;
    action: string;
    createdAt: Date;
    toolId: string | null;
    toolName: string | null;
  }>,
) {
  const eventsByAgent = new Map<string, AgentAccessEvent[]>();

  for (const row of rows) {
    if (!row.agentId) {
      continue;
    }

    const bucket = eventsByAgent.get(row.agentId) ?? [];

    if (bucket.length >= 5) {
      continue;
    }

    bucket.push({
      id: row.id,
      action: row.action as AgentAccessEvent["action"],
      createdAt: row.createdAt,
      toolId: row.toolId,
      toolName: row.toolName,
    });
    eventsByAgent.set(row.agentId, bucket);
  }

  return eventsByAgent;
}

export function summarizeToolGrantRows(
  grantRows: Array<{
    toolId: string;
    agentId: string;
    agentName: string;
    status: AccessGrantStatus;
  }>,
) {
  const summaryByTool = new Map<string, ToolAccessLists>();

  for (const grant of grantRows) {
    const bucket = summaryByTool.get(grant.toolId) ?? {
      approved: 0,
      pending: 0,
      approvedAgentList: [],
      pendingAgentList: [],
    };

    if (grant.status === "approved") {
      bucket.approved += 1;
      bucket.approvedAgentList.push({
        agentId: grant.agentId,
        agentName: grant.agentName,
      });
    }

    if (grant.status === "pending") {
      bucket.pending += 1;
      bucket.pendingAgentList.push({
        agentId: grant.agentId,
        agentName: grant.agentName,
      });
    }

    summaryByTool.set(grant.toolId, bucket);
  }

  return summaryByTool;
}

async function listRecentAgentAccessEvents(
  organizationId: string,
  agentIds: string[],
) {
  if (agentIds.length === 0) {
    return new Map<string, AgentAccessEvent[]>();
  }

  const db = getDb();
  const rows = await db
    .select({
      id: auditLog.id,
      agentId: sql<string | null>`${auditLog.metadata} ->> 'agentId'`.as(
        "agent_id",
      ),
      action: auditLog.action,
      createdAt: auditLog.createdAt,
      toolId: sql<string | null>`${auditLog.metadata} ->> 'toolId'`.as(
        "tool_id",
      ),
      toolName: sql<string | null>`coalesce(${tools.name}, ${auditLog.metadata} ->> 'toolName')`.as(
        "tool_name",
      ),
    })
    .from(auditLog)
    .leftJoin(
      tools,
      and(
        eq(tools.organizationId, organizationId),
        sql`${tools.id}::text = ${auditLog.metadata} ->> 'toolId'`,
      ),
    )
    .where(
      and(
        eq(auditLog.organizationId, organizationId),
        inArray(auditLog.action, [...ACCESS_HISTORY_ACTIONS]),
        getAgentIdsFilter(agentIds),
      ),
    )
    .orderBy(desc(auditLog.createdAt));

  return collectRecentAgentAccessEvents(rows);
}

async function listToolRows(organizationId: string) {
  const db = getDb();

  return db.query.tools.findMany({
    where: eq(tools.organizationId, organizationId),
    orderBy: desc(tools.createdAt),
  });
}

async function getExistingToolSnapshots(
  organizationId: string,
): Promise<ExistingToolConfigSnapshot[]> {
  const toolRows = await listToolRows(organizationId);

  return toolRows.map((tool) => ({
    id: tool.id,
    configKey: tool.configKey,
    name: tool.name,
    description: tool.description,
    url: tool.url,
    authType: tool.authType,
    credentialMode: tool.credentialMode,
    instructions: tool.instructions,
    credentialConfigured: Boolean(tool.credentialEncrypted),
  }));
}

type DbExecutor = ReturnType<typeof getDb>;
type DbTx = Parameters<Parameters<DbExecutor["transaction"]>[0]>[0];
type DbScope = DbExecutor | DbTx;

type DashboardOverviewCounts = {
  agents: number;
  totalAgents: number;
  tools: number;
  pendingRequests: number;
  grantedAccess: number;
};

type DashboardOverviewSummary = {
  counts: DashboardOverviewCounts;
  onboarding: ReturnType<typeof getOrganizationOnboardingState>;
};

async function resolveToolConfigKey(
  db: DbScope,
  organizationId: string,
  label: string,
  preferredKey?: string,
) {
  const existing = await db
    .select({ configKey: tools.configKey })
    .from(tools)
    .where(eq(tools.organizationId, organizationId))
    .orderBy(asc(tools.configKey));
  const keys = new Set(existing.map((row) => row.configKey));

  if (preferredKey && !keys.has(preferredKey)) {
    return preferredKey;
  }

  return getUniqueToolConfigKey(preferredKey ?? label, (candidate) =>
    keys.has(candidate),
  );
}

async function getDashboardOverviewSummary(input: {
  organizationId: string;
  onboardingDismissedAt: Date | null;
  db: DbScope;
}): Promise<DashboardOverviewSummary> {
  const [[activeAgentCount], [totalAgentCount], [toolCount], [pendingGrantCount], [pendingToolSuggestionCount], [pendingInstructionSuggestionCount], [approvedCount]] =
    await Promise.all([
      input.db
        .select({ value: count() })
        .from(agents)
        .where(
          and(
            eq(agents.organizationId, input.organizationId),
            eq(agents.status, "active"),
          ),
        ),
      input.db
        .select({ value: count() })
        .from(agents)
        .where(eq(agents.organizationId, input.organizationId)),
      input.db
        .select({ value: count() })
        .from(tools)
        .where(eq(tools.organizationId, input.organizationId)),
      input.db
        .select({ value: count() })
        .from(accessGrants)
        .where(
          and(
            eq(accessGrants.organizationId, input.organizationId),
            eq(accessGrants.status, "pending"),
          ),
        ),
      input.db
        .select({ value: count() })
        .from(toolSuggestions)
        .where(
          and(
            eq(toolSuggestions.organizationId, input.organizationId),
            eq(toolSuggestions.status, "pending"),
          ),
        ),
      input.db
        .select({ value: count() })
        .from(toolInstructionSuggestions)
        .where(
          and(
            eq(toolInstructionSuggestions.organizationId, input.organizationId),
            eq(toolInstructionSuggestions.status, "pending"),
          ),
        ),
      input.db
        .select({ value: count() })
        .from(accessGrants)
        .where(
          and(
            eq(accessGrants.organizationId, input.organizationId),
            eq(accessGrants.status, "approved"),
          ),
        ),
    ]);

  return {
    counts: {
      agents: activeAgentCount?.value ?? 0,
      totalAgents: totalAgentCount?.value ?? 0,
      tools: toolCount?.value ?? 0,
      pendingRequests:
        (pendingGrantCount?.value ?? 0) +
        (pendingToolSuggestionCount?.value ?? 0) +
        (pendingInstructionSuggestionCount?.value ?? 0),
      grantedAccess: approvedCount?.value ?? 0,
    },
    onboarding: getOrganizationOnboardingState({
      totalAgentCount: totalAgentCount?.value ?? 0,
      toolCount: toolCount?.value ?? 0,
      onboardingDismissedAt: input.onboardingDismissedAt,
    }),
  };
}

const getCachedDashboardOverviewSummary = cache(
  async (organizationId: string, onboardingDismissedAtIso: string | null) =>
    getDashboardOverviewSummary({
      organizationId,
      onboardingDismissedAt: onboardingDismissedAtIso
        ? new Date(onboardingDismissedAtIso)
        : null,
      db: getDb(),
    }),
);

export async function getOrganizationDashboardOnboardingState(
  input: {
    organizationId: string;
    onboardingDismissedAt: Date | null;
  },
  db?: DbExecutor,
) {
  const summary = db
    ? await getDashboardOverviewSummary({
        organizationId: input.organizationId,
        onboardingDismissedAt: input.onboardingDismissedAt,
        db,
      })
    : await getCachedDashboardOverviewSummary(
        input.organizationId,
        input.onboardingDismissedAt?.toISOString() ?? null,
      );

  return summary.onboarding;
}

export async function getDashboardOverview(
  organizationId: string,
  onboardingDismissedAt: Date | null,
) {
  const summary = await getCachedDashboardOverviewSummary(
    organizationId,
    onboardingDismissedAt?.toISOString() ?? null,
  );
  const db = getDb();
  const [pendingRequests, recentAudit] = await Promise.all([
    listPendingRequests(organizationId),
    db.query.auditLog.findMany({
      where: eq(auditLog.organizationId, organizationId),
      orderBy: desc(auditLog.createdAt),
      limit: 8,
    }),
  ]);

  return {
    ...summary,
    pendingRequests: pendingRequests.slice(0, 5),
    recentAudit,
  };
}

export async function getDashboardSummary(
  organizationId: string,
  onboardingDismissedAt: Date | null,
): Promise<DashboardOverviewSummary> {
  return getCachedDashboardOverviewSummary(
    organizationId,
    onboardingDismissedAt?.toISOString() ?? null,
  );
}

export async function listRecentAuditForDashboard(
  organizationId: string,
  limit = 8,
) {
  const db = getDb();
  return db.query.auditLog.findMany({
    where: eq(auditLog.organizationId, organizationId),
    orderBy: desc(auditLog.createdAt),
    limit,
  });
}

export async function dismissOrganizationOnboarding(
  organizationId: string,
  db: DbExecutor = getDb(),
) {
  const now = new Date();

  const [organization] = await db
    .update(organizations)
    .set({
      onboardingDismissedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(organizations.id, organizationId),
        sql`${organizations.onboardingDismissedAt} is null`,
      ),
    )
    .returning({
      onboardingDismissedAt: organizations.onboardingDismissedAt,
    });

  if (organization) {
    return organization;
  }

  const [existing] = await db
    .select({
      onboardingDismissedAt: organizations.onboardingDismissedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!existing) {
    throw new AppError("Organization not found.", 404);
  }

  return existing;
}

export async function listAgents(
  organizationId: string,
): Promise<AgentCatalogItem[]> {
  const db = getDb();
  const [agentRows, grantRows] = await Promise.all([
    db.query.agents.findMany({
      where: eq(agents.organizationId, organizationId),
      orderBy: desc(agents.createdAt),
    }),
    db
      .select({
        agentId: accessGrants.agentId,
        requestId: accessGrants.id,
        status: accessGrants.status,
        toolId: tools.id,
        toolName: tools.name,
        toolCredentialMode: tools.credentialMode,
      })
      .from(accessGrants)
      .innerJoin(tools, eq(accessGrants.toolId, tools.id))
      .where(eq(accessGrants.organizationId, organizationId)),
  ]);

  const recentAccessByAgent = await listRecentAgentAccessEvents(
    organizationId,
    agentRows.map((agent) => agent.id),
  );

  const grantsByAgent = summarizeAgentGrantRows(grantRows);

  return agentRows.map((agent) =>
    createAgentCatalogItem(
      agent,
      grantsByAgent.get(agent.id),
      recentAccessByAgent.get(agent.id)?.[0]?.createdAt ?? null,
    ),
  );
}

export async function createAgent(
  organizationId: string,
  input: { name: string; description: string },
  actor: Actor,
  options?: { db?: DbScope },
) {
  const db = options?.db ?? getDb();
  const apiKey = generateAgentApiKey();
  const apiKeyHash = hashAgentApiKey(apiKey);

  const [created] = await db
    .insert(agents)
    .values({
      organizationId,
      name: input.name,
      description: input.description,
      apiKeyHash,
      createdByUserId: actor.actorId,
      createdByEmail: actor.actorEmail,
    })
    .returning();

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "agent.created",
    targetType: "agent",
    targetId: created.id,
    metadata: { name: created.name },
  });

  return {
    agentId: created.id,
    apiKey,
    instructions: `Add TOOL_PROVISIONING_API_KEY=${apiKey} to the agent configuration.`,
    agent: createAgentCatalogItem(created),
  };
}

export async function updateAgent(
  organizationId: string,
  agentId: string,
  input: {
    name?: string;
    description?: string;
  },
  actor: Actor,
): Promise<AgentCatalogItem> {
  const db = getDb();

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)),
    });

    if (!existing) {
      throw new AppError("Agent not found.", 404);
    }

    const [nextAgent] = await tx
      .update(agents)
      .set({
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)))
      .returning();

    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "agent.updated",
        targetType: "agent",
        targetId: nextAgent.id,
        metadata: {
          agentId: nextAgent.id,
          name: nextAgent.name,
        },
      },
      tx,
    );

    return nextAgent;
  });

  const [grantRows, recentAccessByAgent] = await Promise.all([
    db
      .select({
        agentId: accessGrants.agentId,
        requestId: accessGrants.id,
        status: accessGrants.status,
        toolId: tools.id,
        toolName: tools.name,
        toolCredentialMode: tools.credentialMode,
      })
      .from(accessGrants)
      .innerJoin(tools, eq(accessGrants.toolId, tools.id))
      .where(
        and(
          eq(accessGrants.organizationId, organizationId),
          eq(accessGrants.agentId, agentId),
        ),
      ),
    listRecentAgentAccessEvents(organizationId, [agentId]),
  ]);

  return createAgentCatalogItem(
    updated,
    summarizeAgentGrantRows(grantRows).get(agentId),
    recentAccessByAgent.get(agentId)?.[0]?.createdAt ?? null,
  );
}

export async function suspendAgent(
  organizationId: string,
  agentId: string,
  actor: Actor,
) {
  const db = getDb();
  const [updated] = await db
    .update(agents)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(
      and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)),
    )
    .returning();

  if (!updated) {
    throw new AppError("Agent not found.", 404);
  }

  await db
    .update(accessGrants)
    .set({
      status: "revoked",
      credentialEncrypted: null,
      decidedAt: new Date(),
      decidedByUserId: actor.actorId,
      decidedByEmail: actor.actorEmail,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.agentId, agentId),
        inArray(accessGrants.status, ["pending", "approved"]),
      ),
    );

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "agent.suspended",
    targetType: "agent",
    targetId: agentId,
  });
}

export async function rotateAgentKey(
  organizationId: string,
  agentId: string,
  actor: Actor,
) {
  const db = getDb();
  const apiKey = generateAgentApiKey();
  const apiKeyHash = hashAgentApiKey(apiKey);

  const [updated] = await db
    .update(agents)
    .set({ apiKeyHash, updatedAt: new Date() })
    .where(
      and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)),
    )
    .returning();

  if (!updated) {
    throw new AppError("Agent not found.", 404);
  }

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "agent.key_rotated",
    targetType: "agent",
    targetId: agentId,
  });

  return {
    agentId,
    apiKey,
    instructions: `Replace the old TOOL_PROVISIONING_API_KEY with ${apiKey}.`,
  };
}

function isUniqueViolationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function assignToolToAgentInDb(
  db: DbScope,
  organizationId: string,
  agentId: string,
  input: {
    toolId: string;
    credential?: string;
  },
  actor: Actor,
) {
  const now = new Date();
  const credential = input.credential?.trim();
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, agentId),
      eq(agents.organizationId, organizationId),
    ),
  });

  if (!agent) {
    throw new AppError("Agent not found.", 404);
  }

  if (agent.status === "suspended") {
    throw new AppError("Suspended agents cannot be assigned tools.", 409);
  }

  const tool = await db.query.tools.findFirst({
    where: and(
      eq(tools.id, input.toolId),
      eq(tools.organizationId, organizationId),
    ),
  });

  if (!tool) {
    throw new AppError("Tool not found.", 404);
  }

  assertApprovalInput(tool.credentialMode, credential);

  const existing = await db.query.accessGrants.findFirst({
    where: and(
      eq(accessGrants.organizationId, organizationId),
      eq(accessGrants.agentId, agentId),
      eq(accessGrants.toolId, input.toolId),
    ),
  });

  if (existing?.status === "pending") {
    throw new AppError(
      "This agent already has a pending request for this tool.",
      409,
    );
  }

  if (existing?.status === "approved") {
    throw new AppError("This agent already has access to this tool.", 409);
  }

  const grantValues = {
    status: "approved" as const,
    reason: null,
    denialReason: null,
    credentialEncrypted:
      tool.credentialMode === "per_agent" && credential
        ? encryptSecret(credential)
        : null,
    decidedByUserId: actor.actorId,
    decidedByEmail: actor.actorEmail,
    decidedAt: now,
    updatedAt: now,
  };

  const [grant] = existing
    ? await db
        .update(accessGrants)
        .set(grantValues)
        .where(eq(accessGrants.id, existing.id))
        .returning()
    : await db
        .insert(accessGrants)
        .values({
          organizationId,
          agentId,
          toolId: input.toolId,
          ...grantValues,
        })
        .returning();

  await appendAuditLog(
    {
      organizationId,
      actorType: "human",
      actorId: actor.actorId,
      actorLabel: actor.actorEmail,
      action: "grant.assigned",
      targetType: "access_grant",
      targetId: grant.id,
      metadata: {
        agentId,
        toolId: tool.id,
        toolName: tool.name,
      },
    },
    db,
  );

  return grant;
}

export async function assignToolToAgent(
  organizationId: string,
  agentId: string,
  input: {
    toolId: string;
    credential?: string;
  },
  actor: Actor,
  options?: { db?: DbScope },
) {
  try {
    if (options?.db) {
      return await assignToolToAgentInDb(
        options.db,
        organizationId,
        agentId,
        input,
        actor,
      );
    }

    const db = getDb();

    return await db.transaction(async (tx) =>
      assignToolToAgentInDb(
        tx as DbScope,
        organizationId,
        agentId,
        input,
        actor,
      ),
    );
  } catch (error) {
    if (isUniqueViolationError(error)) {
      throw new AppError("This agent already has a grant for this tool.", 409);
    }

    throw error;
  }
}

export async function revokeAgentToolAccess(
  organizationId: string,
  agentId: string,
  toolId: string,
  actor: Actor,
) {
  const db = getDb();
  const [existing] = await db
    .select({
      id: accessGrants.id,
      toolName: tools.name,
    })
    .from(accessGrants)
    .innerJoin(tools, eq(accessGrants.toolId, tools.id))
    .where(
      and(
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.agentId, agentId),
        eq(accessGrants.toolId, toolId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AppError("Access grant not found.", 404);
  }

  const [updated] = await db
    .update(accessGrants)
    .set({
      status: "revoked",
      credentialEncrypted: null,
      decidedAt: new Date(),
      decidedByUserId: actor.actorId,
      decidedByEmail: actor.actorEmail,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.agentId, agentId),
        eq(accessGrants.toolId, toolId),
      ),
    )
    .returning();

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "grant.revoked",
    targetType: "access_grant",
    targetId: updated.id,
    metadata: { agentId, toolId, toolName: existing.toolName },
  });
}

export async function listTools(organizationId: string) {
  const db = getDb();
  const [toolRows, grantStats] = await Promise.all([
    listToolRows(organizationId),
    db
      .select({
        toolId: accessGrants.toolId,
        agentId: agents.id,
        agentName: agents.name,
        status: accessGrants.status,
      })
      .from(accessGrants)
      .innerJoin(agents, eq(accessGrants.agentId, agents.id))
      .where(eq(accessGrants.organizationId, organizationId))
      .orderBy(asc(agents.name)),
  ]);

  const summaryByTool = summarizeToolGrantRows(grantStats);

  return toolRows.map((tool) => toToolCatalogItem(tool, summaryByTool.get(tool.id)));
}

async function createToolInDb(
  db: DbScope,
  organizationId: string,
  input: {
    configKey?: string;
    name: string;
    description: string;
    url?: string;
    authType: typeof tools.$inferInsert.authType;
    credentialMode: ToolCredentialMode;
    credential?: string;
    instructions?: string;
    sourceSuggestionId?: string;
  },
  actor: Actor,
  options?: { suppressAudit?: boolean },
) {
  const now = new Date();
  const sharedCredential = input.credential?.trim();
  const nextInstructions = input.instructions?.trim() || null;
  const configKey = await resolveToolConfigKey(
    db,
    organizationId,
    input.name,
    input.configKey,
  );
  const [created] = await db
    .insert(tools)
    .values({
      organizationId,
      configKey,
      name: input.name,
      description: input.description,
      url: normalizeToolUrl(input.url) ?? null,
      authType: input.authType,
      credentialMode: input.credentialMode,
      credentialEncrypted: sharedCredential ? encryptSecret(sharedCredential) : null,
      credentialLastRotatedAt:
        input.credentialMode === "shared" && sharedCredential ? now : null,
      instructions: nextInstructions,
      addedByUserId: actor.actorId,
      addedByEmail: actor.actorEmail,
    })
    .returning();

  const version = await createToolInstructionVersion(db, {
    organizationId,
    toolId: created.id,
    instructions: nextInstructions,
    source: "tool_create",
    actor,
  });

  await appendAuditLog(
    {
      organizationId,
      actorType: "human",
      actorId: actor.actorId,
      actorLabel: actor.actorEmail,
      action: "tool.instructions.version_created",
      targetType: "tool_instruction_version",
      targetId: version.id,
      metadata: {
        source: "tool_create",
        toolId: created.id,
        toolName: created.name,
      },
    },
    db,
  );

  const [createdWithVersion] = await db
    .update(tools)
    .set({
      currentInstructionVersionId: version.id,
      updatedAt: now,
    })
    .where(and(eq(tools.id, created.id), eq(tools.organizationId, organizationId)))
    .returning();

  if (!options?.suppressAudit) {
    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "tool.created",
        targetType: "tool",
        targetId: created.id,
        metadata: {
          credentialMode: created.credentialMode,
          name: created.name,
          toolId: created.id,
          toolName: created.name,
        },
      },
      db,
    );
  }

  await resolveMatchingToolSuggestionsForTool(db, {
    organizationId,
    tool: {
      id: created.id,
      name: created.name,
      url: created.url,
    },
    actor,
    sourceSuggestionId: input.sourceSuggestionId,
    resolutionSource: input.sourceSuggestionId
      ? "source_suggestion"
      : "tool_created",
  });

  return toToolCatalogItem(createdWithVersion);
}

export async function createTool(
  organizationId: string,
  input: {
    configKey?: string;
    name: string;
    description: string;
    url?: string;
    authType: typeof tools.$inferInsert.authType;
    credentialMode: ToolCredentialMode;
    credential?: string;
    instructions?: string;
    sourceSuggestionId?: string;
  },
  actor: Actor,
  options?: { suppressAudit?: boolean; db?: DbScope },
) {
  if (options?.db) {
    return createToolInDb(options.db, organizationId, input, actor, options);
  }

  const db = getDb();

  return db.transaction(async (tx) =>
    createToolInDb(tx as DbScope, organizationId, input, actor, options),
  );
}

export async function updateTool(
  organizationId: string,
  toolId: string,
  input: {
    name?: string;
    description?: string;
    url?: string;
    credential?: string;
    instructions?: string;
    credentialExpiresAt?: string | null;
    acceptedInstructionSuggestionId?: string;
    restoreInstructionVersionId?: string;
  },
  actor: Actor,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const existing = await tx.query.tools.findFirst({
      where: and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)),
    });

    if (!existing) {
      throw new AppError("Tool not found.", 404);
    }

    if (existing.credentialMode === "per_agent" && input.credential) {
      throw new AppError(
        "Per-agent tools cannot store a shared credential.",
        400,
      );
    }

    if (!existing.currentInstructionVersionId) {
      throw new AppError("Instruction history is not configured for this tool.", 500);
    }

    const nextCredential = input.credential?.trim();
    const shouldRotateCredential =
      existing.credentialMode === "shared" && Boolean(nextCredential);
    const nextCredentialExpiresAt =
      input.credentialExpiresAt === undefined
        ? existing.credentialExpiresAt
        : input.credentialExpiresAt === null
          ? null
          : new Date(input.credentialExpiresAt);
    const restoredVersion = input.restoreInstructionVersionId
      ? await tx.query.toolInstructionVersions.findFirst({
          where: and(
            eq(toolInstructionVersions.organizationId, organizationId),
            eq(toolInstructionVersions.toolId, toolId),
            eq(toolInstructionVersions.id, input.restoreInstructionVersionId),
          ),
        })
      : null;

    if (input.restoreInstructionVersionId && !restoredVersion) {
      throw new AppError("Instruction version not found.", 404);
    }

    const acceptedSuggestion = input.acceptedInstructionSuggestionId
      ? await tx.query.toolInstructionSuggestions.findFirst({
          where: and(
            eq(toolInstructionSuggestions.organizationId, organizationId),
            eq(toolInstructionSuggestions.toolId, toolId),
            eq(
              toolInstructionSuggestions.id,
              input.acceptedInstructionSuggestionId,
            ),
          ),
        })
      : null;

    if (input.acceptedInstructionSuggestionId && !acceptedSuggestion) {
      throw new AppError("Instruction suggestion not found.", 404);
    }

    if (
      acceptedSuggestion &&
      (acceptedSuggestion.status !== "pending" ||
        acceptedSuggestion.baseVersionId !== existing.currentInstructionVersionId)
    ) {
      throw new AppError(
        "This instruction suggestion is no longer pending for the current guide version.",
        409,
      );
    }

    const nextInstructions =
      restoredVersion && input.instructions === undefined
        ? restoredVersion.instructions
        : input.instructions === undefined
          ? existing.instructions
          : input.instructions || null;
    const versionSource =
      restoredVersion !== null
        ? "restore"
        : acceptedSuggestion
          ? "suggestion_accept"
          : "manual";
    const version = await createToolInstructionVersion(tx, {
      organizationId,
      toolId,
      instructions: nextInstructions,
      source: versionSource,
      actor,
    });

    const [updated] = await tx
      .update(tools)
      .set({
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        url:
          input.url === undefined
            ? existing.url
            : normalizeToolUrl(input.url) ?? null,
        instructions: nextInstructions,
        currentInstructionVersionId: version.id,
        credentialEncrypted:
          shouldRotateCredential && nextCredential
            ? encryptSecret(nextCredential)
            : existing.credentialEncrypted,
        credentialLastRotatedAt: shouldRotateCredential
          ? new Date()
          : existing.credentialLastRotatedAt,
        credentialExpiresAt:
          existing.credentialMode === "shared"
            ? nextCredentialExpiresAt
            : existing.credentialExpiresAt,
        updatedAt: new Date(),
      })
      .where(and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)))
      .returning();

    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "tool.updated",
        targetType: "tool",
        targetId: updated.id,
        metadata: {
          rotatedCredential: shouldRotateCredential,
          credentialMode: updated.credentialMode,
          name: updated.name,
          instructionVersionSource: versionSource,
          toolId: updated.id,
          toolName: updated.name,
        },
      },
      tx,
    );

    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "tool.instructions.version_created",
        targetType: "tool_instruction_version",
        targetId: version.id,
        metadata: {
          source: versionSource,
          toolId: updated.id,
          toolName: updated.name,
        },
      },
      tx,
    );

    if (restoredVersion) {
      await appendAuditLog(
        {
          organizationId,
          actorType: "human",
          actorId: actor.actorId,
          actorLabel: actor.actorEmail,
          action: "tool.instructions.restored",
          targetType: "tool_instruction_version",
          targetId: version.id,
          metadata: {
            restoredFromVersionId: restoredVersion.id,
            toolId: updated.id,
            toolName: updated.name,
          },
        },
        tx,
      );
    }

    if (acceptedSuggestion) {
      await tx
        .update(toolInstructionSuggestions)
        .set({
          status: "accepted",
          acceptedVersionId: version.id,
          decidedByUserId: actor.actorId,
          decidedByEmail: actor.actorEmail,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(toolInstructionSuggestions.id, acceptedSuggestion.id));

      await appendAuditLog(
        {
          organizationId,
          actorType: "human",
          actorId: actor.actorId,
          actorLabel: actor.actorEmail,
          action: "tool_instruction_suggestion.accepted",
          targetType: "tool_instruction_suggestion",
          targetId: acceptedSuggestion.id,
          metadata: {
            toolId: updated.id,
            toolName: updated.name,
            instructionVersionId: version.id,
          },
        },
        tx,
      );
    }

    await resolveMatchingToolSuggestionsForTool(tx, {
      organizationId,
      tool: {
        id: updated.id,
        name: updated.name,
        url: updated.url,
      },
      actor,
      resolutionSource: "tool_updated",
    });

    return toToolCatalogItem(updated);
  });
}

export async function deleteTool(
  organizationId: string,
  toolId: string,
  actor: Actor,
) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: tools.id,
        name: tools.name,
      })
      .from(tools)
      .where(and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)))
      .limit(1);

    if (!existing) {
      throw new AppError("Tool not found.", 404);
    }

    const grantRows = await tx
      .select({
        id: accessGrants.id,
        agentId: accessGrants.agentId,
        status: accessGrants.status,
      })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.organizationId, organizationId),
          eq(accessGrants.toolId, toolId),
          inArray(accessGrants.status, ["pending", "approved"]),
        ),
      );

    let approvedCount = 0;
    let pendingCount = 0;

    for (const grant of grantRows) {
      if (grant.status === "approved") {
        approvedCount += 1;
      }

      if (grant.status === "pending") {
        pendingCount += 1;
      }

      await appendAuditLog(
        {
          organizationId,
          actorType: "human",
          actorId: actor.actorId,
          actorLabel: actor.actorEmail,
          action: "grant.revoked",
          targetType: "access_grant",
          targetId: grant.id,
          metadata: {
            agentId: grant.agentId,
            toolId: existing.id,
            toolName: existing.name,
          },
        },
        tx,
      );
    }

    const [deleted] = await tx
      .delete(tools)
      .where(and(eq(tools.id, toolId), eq(tools.organizationId, organizationId)))
      .returning({
        id: tools.id,
        name: tools.name,
      });

    if (!deleted) {
      throw new AppError("Tool not found.", 404);
    }

    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "tool.deleted",
        targetType: "tool",
        targetId: deleted.id,
        metadata: {
          toolId: deleted.id,
          toolName: deleted.name,
          approvedCount,
          pendingCount,
        },
      },
      tx,
    );

    return {
      toolId: deleted.id,
      toolName: deleted.name,
      approvedCount,
      pendingCount,
    };
  });
}

export async function exportToolCatalog(
  organizationId: string,
  format: ToolCatalogFormat,
) {
  const toolRows = await listToolRows(organizationId);

  return formatToolCatalog(
    {
      version: 1,
      tools: toolRows
        .slice()
        .sort((left, right) => left.configKey.localeCompare(right.configKey))
        .map((tool) => ({
          key: tool.configKey,
          name: tool.name,
          description: tool.description,
          url: tool.url,
          authType: tool.authType,
          credentialMode: tool.credentialMode,
          instructions: tool.instructions ?? "",
          credentialConfigured: Boolean(tool.credentialEncrypted),
        })),
    },
    format,
  );
}

export async function previewToolCatalogImport(
  organizationId: string,
  input: {
    body: string;
    contentType?: string | null;
  },
) {
  const [{ importedTools, invalidItems }, existingTools] = await Promise.all([
    Promise.resolve(parseToolCatalogDocument(input)),
    getExistingToolSnapshots(organizationId),
  ]);

  return diffToolCatalog(existingTools, importedTools, invalidItems);
}

export async function applyToolCatalogImport(
  organizationId: string,
  input: {
    body: string;
    contentType?: string | null;
  },
  actor: Actor,
) {
  const db = getDb();
  const diff = await previewToolCatalogImport(organizationId, input);

  if (diff.counts.invalid > 0) {
    throw new AppError(
      "Import contains invalid tool definitions.",
      400,
      "Fix the invalid entries in the preview before applying the import.",
    );
  }

  const existingTools = await getExistingToolSnapshots(organizationId);
  const existingByKey = new Map(existingTools.map((tool) => [tool.configKey, tool]));
  let created = 0;
  let updated = 0;

  for (const imported of diff.importedTools) {
    const existing = existingByKey.get(imported.key);

    if (!existing) {
      await createTool(
        organizationId,
        {
          configKey: imported.key,
          name: imported.name,
          description: imported.description,
          url: imported.url ?? undefined,
          authType: imported.authType,
          credentialMode: imported.credentialMode,
          instructions: imported.instructions,
        },
        actor,
        { suppressAudit: true },
      );
      created += 1;
      continue;
    }

    if (
      existing.name === imported.name &&
      existing.description === imported.description &&
      (existing.url ?? null) === imported.url &&
      existing.authType === imported.authType &&
      existing.credentialMode === imported.credentialMode &&
      (existing.instructions ?? "") === imported.instructions
    ) {
      continue;
    }

    const [result] = await db
      .update(tools)
      .set({
        name: imported.name,
        description: imported.description,
        url: imported.url,
        authType: imported.authType,
        credentialMode: imported.credentialMode,
        instructions: imported.instructions || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tools.id, existing.id),
          eq(tools.organizationId, organizationId),
        ),
      )
      .returning();

    if (!result) {
      throw new AppError("Tool not found during import update.", 404);
    }

    updated += 1;
  }

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "config.import_applied",
    targetType: "tool_catalog",
    targetId: organizationId,
    metadata: {
      created,
      updated,
      unchanged: diff.counts.unchanged,
      removedPreviewOnly: diff.counts.remove,
    },
  });

  return diff;
}

export async function listPendingRequests(organizationId: string) {
  const db = getDb();
  const [accessRequests, toolSuggestionRequests, instructionSuggestionRequests] =
    await Promise.all([
    db
    .select({
      kind: sql<"access_request">`'access_request'`.as("kind"),
      id: accessGrants.id,
      agentId: agents.id,
      agentName: agents.name,
      agentDescription: agents.description,
      toolId: tools.id,
      toolName: tools.name,
      toolCredentialMode: tools.credentialMode,
      reason: accessGrants.reason,
      requestedAt: accessGrants.requestedAt,
    })
    .from(accessGrants)
    .innerJoin(agents, eq(accessGrants.agentId, agents.id))
    .innerJoin(tools, eq(accessGrants.toolId, tools.id))
    .where(
      and(
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.status, "pending"),
      ),
    )
    .orderBy(desc(accessGrants.requestedAt)),
    listPendingToolSuggestions(organizationId),
    listPendingToolInstructionSuggestions(organizationId),
  ]);

  return [...accessRequests, ...toolSuggestionRequests, ...instructionSuggestionRequests].sort(
    (left, right) => right.requestedAt.getTime() - left.requestedAt.getTime(),
  ) as PendingAdminRequestItem[];
}

export async function getPendingToolSuggestion(
  organizationId: string,
  suggestionId: string,
) {
  const suggestion = await getToolSuggestionById(organizationId, suggestionId);

  if (!suggestion || suggestion.status !== "pending") {
    return null;
  }

  return suggestion;
}

export async function getPendingToolInstructionSuggestion(
  organizationId: string,
  suggestionId: string,
) {
  return getPendingToolInstructionSuggestionById(organizationId, suggestionId);
}

export async function approveRequest(
  organizationId: string,
  requestId: string,
  credential: string | undefined,
  actor: Actor,
) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const pending = await tx
      .select({
        id: accessGrants.id,
        agentId: accessGrants.agentId,
        toolId: accessGrants.toolId,
        toolName: tools.name,
        status: accessGrants.status,
        toolCredentialMode: tools.credentialMode,
      })
      .from(accessGrants)
      .innerJoin(tools, eq(accessGrants.toolId, tools.id))
      .where(
        and(
          eq(accessGrants.id, requestId),
          eq(accessGrants.organizationId, organizationId),
        ),
      )
      .limit(1)
      .for("update");

    const grant = pending[0];

    if (!grant) {
      throw new AppError("Request not found.", 404);
    }

    if (grant.status !== "pending") {
      throw new AppError("Only pending requests can be approved.", 409);
    }

    assertApprovalInput(grant.toolCredentialMode, credential);

    const [updated] = await tx
      .update(accessGrants)
      .set({
        status: "approved",
        denialReason: null,
        credentialEncrypted:
          grant.toolCredentialMode === "per_agent" && credential
            ? encryptSecret(credential)
            : null,
        decidedByUserId: actor.actorId,
        decidedByEmail: actor.actorEmail,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accessGrants.id, requestId),
          eq(accessGrants.organizationId, organizationId),
          eq(accessGrants.status, "pending"),
        ),
      )
      .returning();

    if (!updated) {
      throw new AppError("Only pending requests can be approved.", 409);
    }

    await appendAuditLog(
      {
        organizationId,
        actorType: "human",
        actorId: actor.actorId,
        actorLabel: actor.actorEmail,
        action: "grant.approved",
        targetType: "access_grant",
        targetId: updated.id,
        metadata: {
          agentId: grant.agentId,
          toolId: grant.toolId,
          toolName: grant.toolName,
        },
      },
      tx,
    );

    return updated;
  });
}

export async function denyRequest(
  organizationId: string,
  requestId: string,
  reason: string | undefined,
  actor: Actor,
) {
  const db = getDb();
  const pending = await db
    .select({
      id: accessGrants.id,
      agentId: accessGrants.agentId,
      toolId: accessGrants.toolId,
      toolName: tools.name,
      status: accessGrants.status,
    })
    .from(accessGrants)
    .innerJoin(tools, eq(accessGrants.toolId, tools.id))
    .where(
      and(
        eq(accessGrants.id, requestId),
        eq(accessGrants.organizationId, organizationId),
      ),
    )
    .limit(1);

  const grant = pending[0];

  if (!grant || grant.status !== "pending") {
    throw new AppError("Pending request not found.", 404);
  }

  const [updated] = await db
    .update(accessGrants)
    .set({
      status: "denied",
      denialReason: reason?.trim() || null,
      credentialEncrypted: null,
      decidedByUserId: actor.actorId,
      decidedByEmail: actor.actorEmail,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(accessGrants.id, requestId),
        eq(accessGrants.organizationId, organizationId),
        eq(accessGrants.status, "pending"),
      ),
    )
    .returning();

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "grant.denied",
    targetType: "access_grant",
    targetId: updated.id,
    metadata: {
      agentId: grant.agentId,
      toolId: grant.toolId,
      toolName: grant.toolName,
    },
  });

  return updated;
}

export async function listAuditEvents(
  organizationId: string,
  filters: {
    action?: string;
    agentId?: string;
    toolId?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
) {
  const db = getDb();
  const clauses = [eq(auditLog.organizationId, organizationId)];

  if (filters.action) {
    clauses.push(eq(auditLog.action, filters.action));
  }

  if (filters.agentId) {
    clauses.push(sql`${auditLog.metadata} ->> 'agentId' = ${filters.agentId}`);
  }

  if (filters.toolId) {
    clauses.push(
      or(
        sql`${auditLog.metadata} ->> 'toolId' = ${filters.toolId}`,
        and(
          eq(auditLog.targetType, "tool"),
          eq(auditLog.targetId, filters.toolId),
        ),
      )!,
    );
  }

  if (filters.from) {
    clauses.push(gte(auditLog.createdAt, new Date(filters.from)));
  }

  if (filters.to) {
    clauses.push(lte(auditLog.createdAt, new Date(filters.to)));
  }

  return db.query.auditLog.findMany({
    where: and(...clauses),
    orderBy: desc(auditLog.createdAt),
    limit: filters.limit ?? 100,
  });
}

export async function getRecentToolActivity(
  organizationId: string,
  toolId: string,
  limit = 5,
): Promise<RecentToolActivityEvent[]> {
  const events = await listAuditEvents(organizationId, {
    toolId,
    limit,
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    createdAt: event.createdAt,
      actorLabel: event.actorLabel,
    }));
}

export async function getRecentAgentActivity(
  organizationId: string,
  agentId: string,
  limit = 5,
): Promise<AgentRecentActivityEvent[]> {
  const events = await listAuditEvents(organizationId, {
    agentId,
    limit,
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    createdAt: event.createdAt,
    toolId:
      event.metadata &&
      typeof event.metadata === "object" &&
      typeof event.metadata.toolId === "string"
        ? event.metadata.toolId
        : null,
    toolName:
      event.metadata &&
      typeof event.metadata === "object" &&
      typeof event.metadata.toolName === "string"
        ? event.metadata.toolName
        : null,
  }));
}
