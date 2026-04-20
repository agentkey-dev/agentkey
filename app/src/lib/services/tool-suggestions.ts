import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { appendAuditLog } from "@/lib/audit";
import {
  getToolSuggestionCooldownUntil,
  getToolSuggestionIdentity,
  getToolSuggestionLockKeyParts,
  getToolSuggestionLockTokens,
  toolMatchesSuggestionIdentity,
  toolSuggestionsMatch,
} from "@/lib/core/tool-suggestions";
import { getDb } from "@/lib/db/client";
import {
  accessGrants,
  agents,
  toolSuggestionAgents,
  toolSuggestions,
  tools,
} from "@/lib/db/schema";
import { AppError } from "@/lib/http";

type Actor = {
  actorId: string;
  actorEmail: string;
};

type DbClient = ReturnType<typeof getDb>;
type DbTx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbExecutor = DbClient | DbTx;

type SupporterSummary = {
  agentId: string;
  agentName: string;
  latestReason: string;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
};

export type PendingToolSuggestion = {
  kind: "tool_suggestion";
  id: string;
  name: string;
  url: string | null;
  supporterCount: number;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
  requestedAt: Date;
  supporters: SupporterSummary[];
};

export function createPendingToolSuggestionSummary(input: {
  id: string;
  name: string;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
  supporters: SupporterSummary[];
}): PendingToolSuggestion {
  const firstRequestedAt =
    input.supporters.length === 0
      ? input.createdAt
      : input.supporters.reduce(
          (earliest, supporter) =>
            supporter.firstRequestedAt < earliest
              ? supporter.firstRequestedAt
              : earliest,
          input.supporters[0].firstRequestedAt,
        );
  const lastRequestedAt =
    input.supporters.length === 0
      ? input.updatedAt
      : input.supporters.reduce(
          (latest, supporter) =>
            supporter.lastRequestedAt > latest ? supporter.lastRequestedAt : latest,
          input.supporters[0].lastRequestedAt,
        );

  return {
    kind: "tool_suggestion",
    id: input.id,
    name: input.name,
    url: input.url,
    supporterCount: input.supporters.length,
    firstRequestedAt,
    lastRequestedAt,
    requestedAt: lastRequestedAt,
    supporters: input.supporters,
  };
}

export function sortPendingToolSuggestions<T extends {
  supporterCount: number;
  lastRequestedAt: Date | string;
  name: string;
}>(suggestions: T[]): T[] {
  return [...suggestions].sort((left, right) => {
    if (right.supporterCount !== left.supporterCount) {
      return right.supporterCount - left.supporterCount;
    }

    const lastRequestedAtDiff =
      new Date(right.lastRequestedAt).getTime() -
      new Date(left.lastRequestedAt).getTime();

    if (lastRequestedAtDiff !== 0) {
      return lastRequestedAtDiff;
    }

    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
}

type SuggestToolInput = {
  organizationId: string;
  agentId: string;
  agentName: string;
  name: string;
  url?: string;
  reason: string;
};

type SuggestToolResult =
  | {
      outcome: "suggested";
      suggestionId: string;
      existing: boolean;
      requestedAt: Date;
    }
  | {
      outcome: "existing_tool";
      toolId: string;
      toolName: string;
    }
  | {
      outcome: "cooldown";
      suggestionId: string;
      retryAfter: string;
    };

async function listOrganizationTools(db: DbExecutor, organizationId: string) {
  return db.query.tools.findMany({
    where: eq(tools.organizationId, organizationId),
    orderBy: desc(tools.createdAt),
  });
}

async function findMatchingSuggestionRows(
  db: DbExecutor,
  organizationId: string,
  identity: ReturnType<typeof getToolSuggestionIdentity>,
  statuses: Array<"pending" | "dismissed" | "accepted">,
) {
  const rows = await db.query.toolSuggestions.findMany({
    where: and(
      eq(toolSuggestions.organizationId, organizationId),
      inArray(toolSuggestions.status, statuses),
    ),
    orderBy: desc(toolSuggestions.updatedAt),
  });

  return rows.filter((row) =>
    toolSuggestionsMatch(
      {
        normalizedName: row.normalizedName,
        normalizedDomain: row.normalizedDomain,
      },
      identity,
    ),
  );
}

async function upsertSuggestionSupporter(
  db: DbExecutor,
  input: {
    organizationId: string;
    suggestionId: string;
    agentId: string;
    reason: string;
    now: Date;
  },
) {
  const [supporter] = await db
    .insert(toolSuggestionAgents)
    .values({
      organizationId: input.organizationId,
      suggestionId: input.suggestionId,
      agentId: input.agentId,
      latestReason: input.reason,
      firstRequestedAt: input.now,
      lastRequestedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        toolSuggestionAgents.suggestionId,
        toolSuggestionAgents.agentId,
      ],
      set: {
        latestReason: input.reason,
        lastRequestedAt: input.now,
        updatedAt: input.now,
      },
    })
    .returning();

  return supporter.id;
}

async function acquireSuggestionLocks(
  db: DbExecutor,
  organizationId: string,
  identity: ReturnType<typeof getToolSuggestionIdentity>,
) {
  for (const token of getToolSuggestionLockTokens(organizationId, identity)) {
    const [leftKey, rightKey] = getToolSuggestionLockKeyParts(token);

    await db.execute(sql`
      select pg_advisory_xact_lock(${leftKey}, ${rightKey})
    `);
  }
}

async function listSuggestionSupporters(
  db: DbExecutor,
  suggestionIds: string[],
) {
  if (suggestionIds.length === 0) {
    return new Map<string, SupporterSummary[]>();
  }

  const rows = await db
    .select({
      suggestionId: toolSuggestionAgents.suggestionId,
      agentId: agents.id,
      agentName: agents.name,
      latestReason: toolSuggestionAgents.latestReason,
      firstRequestedAt: toolSuggestionAgents.firstRequestedAt,
      lastRequestedAt: toolSuggestionAgents.lastRequestedAt,
    })
    .from(toolSuggestionAgents)
    .innerJoin(agents, eq(toolSuggestionAgents.agentId, agents.id))
    .where(inArray(toolSuggestionAgents.suggestionId, suggestionIds))
    .orderBy(desc(toolSuggestionAgents.lastRequestedAt), agents.name);

  const bySuggestion = new Map<string, SupporterSummary[]>();

  for (const row of rows) {
    const bucket = bySuggestion.get(row.suggestionId) ?? [];
    bucket.push({
      agentId: row.agentId,
      agentName: row.agentName,
      latestReason: row.latestReason,
      firstRequestedAt: row.firstRequestedAt,
      lastRequestedAt: row.lastRequestedAt,
    });
    bySuggestion.set(row.suggestionId, bucket);
  }

  return bySuggestion;
}

export async function suggestTool(input: SuggestToolInput): Promise<SuggestToolResult> {
  const db = getDb();
  const identity = getToolSuggestionIdentity({
    name: input.name,
    url: input.url,
  });
  const now = new Date();

  return db.transaction(async (tx) => {
    await acquireSuggestionLocks(tx, input.organizationId, identity);

    const existingTools = await listOrganizationTools(tx, input.organizationId);
    const matchingTool = existingTools.find((tool) =>
      toolMatchesSuggestionIdentity(tool, identity),
    );

    if (matchingTool) {
      await appendAuditLog(
        {
          organizationId: input.organizationId,
          actorType: "agent",
          actorId: input.agentId,
          actorLabel: input.agentName,
          action: "tool_suggestion.redirected_to_existing_tool",
          targetType: "tool",
          targetId: matchingTool.id,
          metadata: {
            toolId: matchingTool.id,
            toolName: matchingTool.name,
          },
        },
        tx,
      );

      return {
        outcome: "existing_tool",
        toolId: matchingTool.id,
        toolName: matchingTool.name,
      };
    }

    const [matchingSuggestion] = await findMatchingSuggestionRows(
      tx,
      input.organizationId,
      identity,
      ["pending", "dismissed"],
    );

    if (
      matchingSuggestion?.status === "dismissed" &&
      matchingSuggestion.dismissedUntil &&
      matchingSuggestion.dismissedUntil > now
    ) {
      await appendAuditLog(
        {
          organizationId: input.organizationId,
          actorType: "agent",
          actorId: input.agentId,
          actorLabel: input.agentName,
          action: "tool_suggestion.cooldown_rejected",
          targetType: "tool_suggestion",
          targetId: matchingSuggestion.id,
          metadata: {
            retryAfter: matchingSuggestion.dismissedUntil.toISOString(),
          },
        },
        tx,
      );

      return {
        outcome: "cooldown",
        suggestionId: matchingSuggestion.id,
        retryAfter: matchingSuggestion.dismissedUntil.toISOString(),
      };
    }

    if (matchingSuggestion) {
      const isExistingPendingSuggestion = matchingSuggestion.status === "pending";

      await tx
        .update(toolSuggestions)
        .set({
          name: input.name,
          normalizedName: identity.normalizedName,
          url: identity.normalizedUrl,
          normalizedDomain: identity.normalizedDomain,
          status: "pending",
          dismissedUntil: null,
          convertedToolId: null,
          decidedByUserId: null,
          decidedByEmail: null,
          decidedAt: null,
          updatedAt: now,
        })
        .where(eq(toolSuggestions.id, matchingSuggestion.id));

      await upsertSuggestionSupporter(tx, {
        organizationId: input.organizationId,
        suggestionId: matchingSuggestion.id,
        agentId: input.agentId,
        reason: input.reason,
        now,
      });

      await appendAuditLog(
        {
          organizationId: input.organizationId,
          actorType: "agent",
          actorId: input.agentId,
          actorLabel: input.agentName,
          action: "tool_suggestion.supported",
          targetType: "tool_suggestion",
          targetId: matchingSuggestion.id,
          metadata: {
            toolName: input.name,
            url: identity.normalizedUrl,
          },
        },
        tx,
      );

      return {
        outcome: "suggested",
        suggestionId: matchingSuggestion.id,
        existing: isExistingPendingSuggestion,
        requestedAt: now,
      };
    }

    const [created] = await tx
      .insert(toolSuggestions)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        normalizedName: identity.normalizedName,
        url: identity.normalizedUrl,
        normalizedDomain: identity.normalizedDomain,
      })
      .returning();

    await upsertSuggestionSupporter(tx, {
      organizationId: input.organizationId,
      suggestionId: created.id,
      agentId: input.agentId,
      reason: input.reason,
      now,
    });

    await appendAuditLog(
      {
        organizationId: input.organizationId,
        actorType: "agent",
        actorId: input.agentId,
        actorLabel: input.agentName,
        action: "tool_suggestion.created",
        targetType: "tool_suggestion",
        targetId: created.id,
        metadata: {
          toolName: created.name,
          url: created.url,
        },
      },
      tx,
    );

    return {
      outcome: "suggested",
      suggestionId: created.id,
      existing: false,
      requestedAt: created.createdAt,
    };
  });
}

export async function listPendingToolSuggestions(
  organizationId: string,
): Promise<PendingToolSuggestion[]> {
  const db = getDb();
  const suggestions = await db.query.toolSuggestions.findMany({
    where: and(
      eq(toolSuggestions.organizationId, organizationId),
      eq(toolSuggestions.status, "pending"),
    ),
  });
  const supportersBySuggestion = await listSuggestionSupporters(
    db,
    suggestions.map((suggestion) => suggestion.id),
  );

  return sortPendingToolSuggestions(
    suggestions.map((suggestion) =>
      createPendingToolSuggestionSummary({
        id: suggestion.id,
        name: suggestion.name,
        url: suggestion.url,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
        supporters: supportersBySuggestion.get(suggestion.id) ?? [],
      }),
    ),
  );
}

export async function getToolSuggestionById(
  organizationId: string,
  suggestionId: string,
) {
  const db = getDb();
  const suggestion = await db.query.toolSuggestions.findFirst({
    where: and(
      eq(toolSuggestions.organizationId, organizationId),
      eq(toolSuggestions.id, suggestionId),
    ),
  });

  if (!suggestion) {
    return null;
  }

  const supportersBySuggestion = await listSuggestionSupporters(db, [suggestion.id]);

  return {
    ...suggestion,
    supporters: supportersBySuggestion.get(suggestion.id) ?? [],
  };
}

export async function dismissToolSuggestion(
  organizationId: string,
  suggestionId: string,
  actor: Actor,
) {
  const db = getDb();
  const existing = await db.query.toolSuggestions.findFirst({
    where: and(
      eq(toolSuggestions.organizationId, organizationId),
      eq(toolSuggestions.id, suggestionId),
    ),
  });

  if (!existing) {
    throw new AppError("Suggestion not found.", 404);
  }

  if (existing.status !== "pending") {
    throw new AppError("Only pending suggestions can be dismissed.", 409);
  }

  const dismissedUntil = getToolSuggestionCooldownUntil();

  const [updated] = await db
    .update(toolSuggestions)
    .set({
      status: "dismissed",
      dismissedUntil,
      decidedByUserId: actor.actorId,
      decidedByEmail: actor.actorEmail,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(toolSuggestions.id, suggestionId))
    .returning();

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "tool_suggestion.dismissed",
    targetType: "tool_suggestion",
    targetId: updated.id,
    metadata: {
      dismissedUntil: dismissedUntil.toISOString(),
      toolName: updated.name,
    },
  });

  return updated;
}

async function seedPendingGrantsFromSuggestions(
  db: DbExecutor,
  input: {
    organizationId: string;
    toolId: string;
    toolName: string;
    suggestionIds: string[];
    actor: Actor;
  },
) {
  if (input.suggestionIds.length === 0) {
    return { count: 0 };
  }

  const supporterRows = await db
    .select({
      suggestionId: toolSuggestionAgents.suggestionId,
      agentId: toolSuggestionAgents.agentId,
      latestReason: toolSuggestionAgents.latestReason,
      lastRequestedAt: toolSuggestionAgents.lastRequestedAt,
    })
    .from(toolSuggestionAgents)
    .where(inArray(toolSuggestionAgents.suggestionId, input.suggestionIds))
    .orderBy(desc(toolSuggestionAgents.lastRequestedAt));

  const supporterByAgent = new Map<
    string,
    {
      suggestionId: string;
      latestReason: string;
      lastRequestedAt: Date;
    }
  >();

  for (const row of supporterRows) {
    if (!supporterByAgent.has(row.agentId)) {
      supporterByAgent.set(row.agentId, {
        suggestionId: row.suggestionId,
        latestReason: row.latestReason,
        lastRequestedAt: row.lastRequestedAt,
      });
    }
  }

  const agentIds = [...supporterByAgent.keys()];

  if (agentIds.length === 0) {
    return { count: 0 };
  }

  const existingGrants = await db.query.accessGrants.findMany({
    where: and(
      eq(accessGrants.organizationId, input.organizationId),
      eq(accessGrants.toolId, input.toolId),
      inArray(accessGrants.agentId, agentIds),
    ),
  });
  const existingGrantByAgent = new Map(
    existingGrants.map((grant) => [grant.agentId, grant]),
  );

  let count = 0;

  for (const agentId of agentIds) {
    const supporter = supporterByAgent.get(agentId);

    if (!supporter) {
      continue;
    }

    const requestedAt = new Date();
    const existingGrant = existingGrantByAgent.get(agentId);

    if (existingGrant?.status === "approved" || existingGrant?.status === "pending") {
      continue;
    }

    if (existingGrant) {
      const [updated] = await db
        .update(accessGrants)
        .set({
          status: "pending",
          reason: supporter.latestReason,
          denialReason: null,
          credentialEncrypted: null,
          requestedAt,
          decidedByUserId: null,
          decidedByEmail: null,
          decidedAt: null,
          updatedAt: requestedAt,
        })
        .where(eq(accessGrants.id, existingGrant.id))
        .returning();

      await appendAuditLog(
        {
          organizationId: input.organizationId,
          actorType: "human",
          actorId: input.actor.actorId,
          actorLabel: input.actor.actorEmail,
          action: "grant.requested_from_suggestion",
          targetType: "access_grant",
          targetId: updated.id,
          metadata: {
            agentId,
            toolId: input.toolId,
            toolName: input.toolName,
            suggestionId: supporter.suggestionId,
          },
        },
        db,
      );

      count += 1;
      continue;
    }

    const [created] = await db
      .insert(accessGrants)
      .values({
        organizationId: input.organizationId,
        agentId,
        toolId: input.toolId,
        status: "pending",
        reason: supporter.latestReason,
        requestedAt,
      })
      .returning();

    await appendAuditLog(
      {
        organizationId: input.organizationId,
        actorType: "human",
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorEmail,
        action: "grant.requested_from_suggestion",
        targetType: "access_grant",
        targetId: created.id,
        metadata: {
          agentId,
          toolId: input.toolId,
          toolName: input.toolName,
          suggestionId: supporter.suggestionId,
        },
      },
      db,
    );

    count += 1;
  }

  return { count };
}

export async function resolveMatchingToolSuggestionsForTool(
  db: DbExecutor,
  input: {
    organizationId: string;
    tool: {
      id: string;
      name: string;
      url?: string | null;
    };
    actor: Actor;
    sourceSuggestionId?: string;
    resolutionSource: "source_suggestion" | "tool_created" | "tool_updated";
  },
) {
  const pendingSuggestions = await db.query.toolSuggestions.findMany({
    where: and(
      eq(toolSuggestions.organizationId, input.organizationId),
      eq(toolSuggestions.status, "pending"),
    ),
    orderBy: desc(toolSuggestions.updatedAt),
  });
  const toolIdentity = getToolSuggestionIdentity({
    name: input.tool.name,
    url: input.tool.url,
  });

  const matches = pendingSuggestions.filter((suggestion) => {
    if (input.sourceSuggestionId && suggestion.id === input.sourceSuggestionId) {
      return true;
    }

    return toolSuggestionsMatch(
      {
        normalizedName: suggestion.normalizedName,
        normalizedDomain: suggestion.normalizedDomain,
      },
      toolIdentity,
    );
  });

  if (matches.length === 0) {
    return { resolvedSuggestions: 0, seededGrants: 0 };
  }

  const now = new Date();
  const suggestionIds = matches.map((suggestion) => suggestion.id);

  await db
    .update(toolSuggestions)
    .set({
      status: "accepted",
      dismissedUntil: null,
      convertedToolId: input.tool.id,
      decidedByUserId: input.actor.actorId,
      decidedByEmail: input.actor.actorEmail,
      decidedAt: now,
      updatedAt: now,
    })
    .where(inArray(toolSuggestions.id, suggestionIds));

  for (const suggestion of matches) {
    const action =
      input.resolutionSource === "source_suggestion" &&
      suggestion.id === input.sourceSuggestionId
        ? "tool_suggestion.accepted"
        : "tool_suggestion.auto_resolved";

    await appendAuditLog(
      {
        organizationId: input.organizationId,
        actorType: "human",
        actorId: input.actor.actorId,
        actorLabel: input.actor.actorEmail,
        action,
        targetType: "tool_suggestion",
        targetId: suggestion.id,
        metadata: {
          toolId: input.tool.id,
          toolName: input.tool.name,
          resolutionSource: input.resolutionSource,
        },
      },
      db,
    );
  }

  const seeded = await seedPendingGrantsFromSuggestions(db, {
    organizationId: input.organizationId,
    toolId: input.tool.id,
    toolName: input.tool.name,
    suggestionIds,
    actor: input.actor,
  });

  return {
    resolvedSuggestions: matches.length,
    seededGrants: seeded.count,
  };
}
