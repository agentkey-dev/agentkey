import { createHash } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { appendAuditLog } from "@/lib/audit";
import { normalizeToolInstructionLearned } from "@/lib/core/tool-instruction-suggestions";
import { getDb } from "@/lib/db/client";
import {
  accessGrants,
  agents,
  toolInstructionSuggestionAgents,
  toolInstructionSuggestions,
  toolInstructionVersions,
  tools,
  type ToolInstructionVersionSource,
} from "@/lib/db/schema";
import { AppError } from "@/lib/http";

type Actor = {
  actorId: string;
  actorEmail: string;
};

type DbClient = ReturnType<typeof getDb>;
type DbTx = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type DbExecutor = DbClient | DbTx;

export type ToolInstructionSuggestionSupporter = {
  agentId: string;
  agentName: string;
  latestWhy: string;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
};

export type PendingToolInstructionSuggestion = {
  kind: "instruction_suggestion";
  id: string;
  toolId: string;
  toolName: string;
  baseVersionId: string;
  learned: string;
  supporterCount: number;
  firstRequestedAt: Date;
  lastRequestedAt: Date;
  requestedAt: Date;
  supporters: ToolInstructionSuggestionSupporter[];
};

export type ToolInstructionHistoryEntry = {
  id: string;
  instructions: string;
  source: ToolInstructionVersionSource;
  createdByUserId: string;
  createdByEmail: string;
  createdAt: Date;
};

export type PendingInstructionSuggestionDetail =
  PendingToolInstructionSuggestion & {
    status: "pending";
  };

function getInstructionSuggestionLockKeyParts(token: string): [number, number] {
  const digest = createHash("sha256").update(token).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

async function acquireInstructionSuggestionLock(
  db: DbExecutor,
  organizationId: string,
  toolId: string,
  baseVersionId: string,
  normalizedLearned: string,
) {
  const token = [
    "tool_instruction_suggestion",
    organizationId,
    toolId,
    baseVersionId,
    normalizedLearned,
  ].join(":");
  const [leftKey, rightKey] = getInstructionSuggestionLockKeyParts(token);

  await db.execute(sql`
    select pg_advisory_xact_lock(${leftKey}, ${rightKey})
  `);
}

async function listInstructionSuggestionSupporters(
  db: DbExecutor,
  suggestionIds: string[],
) {
  if (suggestionIds.length === 0) {
    return new Map<string, ToolInstructionSuggestionSupporter[]>();
  }

  const rows = await db
    .select({
      suggestionId: toolInstructionSuggestionAgents.suggestionId,
      agentId: agents.id,
      agentName: agents.name,
      latestWhy: toolInstructionSuggestionAgents.latestWhy,
      firstRequestedAt: toolInstructionSuggestionAgents.firstRequestedAt,
      lastRequestedAt: toolInstructionSuggestionAgents.lastRequestedAt,
    })
    .from(toolInstructionSuggestionAgents)
    .innerJoin(agents, eq(toolInstructionSuggestionAgents.agentId, agents.id))
    .where(inArray(toolInstructionSuggestionAgents.suggestionId, suggestionIds))
    .orderBy(desc(toolInstructionSuggestionAgents.lastRequestedAt), agents.name);

  const bySuggestion = new Map<string, ToolInstructionSuggestionSupporter[]>();

  for (const row of rows) {
    const bucket = bySuggestion.get(row.suggestionId) ?? [];
    bucket.push({
      agentId: row.agentId,
      agentName: row.agentName,
      latestWhy: row.latestWhy,
      firstRequestedAt: row.firstRequestedAt,
      lastRequestedAt: row.lastRequestedAt,
    });
    bySuggestion.set(row.suggestionId, bucket);
  }

  return bySuggestion;
}

function toPendingInstructionSuggestion(input: {
  id: string;
  toolId: string;
  toolName: string;
  baseVersionId: string;
  learned: string;
  createdAt: Date;
  updatedAt: Date;
  supporters: ToolInstructionSuggestionSupporter[];
}): PendingToolInstructionSuggestion {
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
    kind: "instruction_suggestion",
    id: input.id,
    toolId: input.toolId,
    toolName: input.toolName,
    baseVersionId: input.baseVersionId,
    learned: input.learned,
    supporterCount: input.supporters.length,
    firstRequestedAt,
    lastRequestedAt,
    requestedAt: lastRequestedAt,
    supporters: input.supporters,
  };
}

async function upsertInstructionSuggestionSupporter(
  db: DbExecutor,
  input: {
    organizationId: string;
    suggestionId: string;
    agentId: string;
    why: string;
    now: Date;
  },
) {
  await db
    .insert(toolInstructionSuggestionAgents)
    .values({
      organizationId: input.organizationId,
      suggestionId: input.suggestionId,
      agentId: input.agentId,
      latestWhy: input.why,
      firstRequestedAt: input.now,
      lastRequestedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        toolInstructionSuggestionAgents.suggestionId,
        toolInstructionSuggestionAgents.agentId,
      ],
      set: {
        latestWhy: input.why,
        lastRequestedAt: input.now,
        updatedAt: input.now,
      },
    });
}

export async function createToolInstructionVersion(
  db: DbExecutor,
  input: {
    organizationId: string;
    toolId: string;
    instructions: string | null | undefined;
    source: ToolInstructionVersionSource;
    actor: Actor;
  },
) {
  const [version] = await db
    .insert(toolInstructionVersions)
    .values({
      organizationId: input.organizationId,
      toolId: input.toolId,
      instructions: input.instructions?.trim() ?? "",
      source: input.source,
      createdByUserId: input.actor.actorId,
      createdByEmail: input.actor.actorEmail,
    })
    .returning();

  return version;
}

export async function listToolInstructionHistory(
  organizationId: string,
  toolId: string,
) {
  const db = getDb();

  return db.query.toolInstructionVersions.findMany({
    where: and(
      eq(toolInstructionVersions.organizationId, organizationId),
      eq(toolInstructionVersions.toolId, toolId),
    ),
    orderBy: desc(toolInstructionVersions.createdAt),
  }) as Promise<ToolInstructionHistoryEntry[]>;
}

export async function listPendingToolInstructionSuggestions(
  organizationId: string,
) {
  const db = getDb();
  const rows = await db
    .select({
      id: toolInstructionSuggestions.id,
      toolId: tools.id,
      toolName: tools.name,
      baseVersionId: toolInstructionSuggestions.baseVersionId,
      learned: toolInstructionSuggestions.learned,
      createdAt: toolInstructionSuggestions.createdAt,
      updatedAt: toolInstructionSuggestions.updatedAt,
    })
    .from(toolInstructionSuggestions)
    .innerJoin(tools, eq(toolInstructionSuggestions.toolId, tools.id))
    .where(
      and(
        eq(toolInstructionSuggestions.organizationId, organizationId),
        eq(toolInstructionSuggestions.status, "pending"),
      ),
    )
    .orderBy(desc(toolInstructionSuggestions.updatedAt));

  const supportersBySuggestion = await listInstructionSuggestionSupporters(
    db,
    rows.map((row) => row.id),
  );

  return rows
    .map((row) =>
      toPendingInstructionSuggestion({
        ...row,
        supporters: supportersBySuggestion.get(row.id) ?? [],
      }),
    )
    .sort((left, right) => right.requestedAt.getTime() - left.requestedAt.getTime());
}

export async function getPendingToolInstructionSuggestionById(
  organizationId: string,
  suggestionId: string,
) {
  const db = getDb();
  const [row] = await db
    .select({
      id: toolInstructionSuggestions.id,
      toolId: tools.id,
      toolName: tools.name,
      baseVersionId: toolInstructionSuggestions.baseVersionId,
      learned: toolInstructionSuggestions.learned,
      status: toolInstructionSuggestions.status,
      createdAt: toolInstructionSuggestions.createdAt,
      updatedAt: toolInstructionSuggestions.updatedAt,
    })
    .from(toolInstructionSuggestions)
    .innerJoin(tools, eq(toolInstructionSuggestions.toolId, tools.id))
    .where(
      and(
        eq(toolInstructionSuggestions.organizationId, organizationId),
        eq(toolInstructionSuggestions.id, suggestionId),
      ),
    )
    .limit(1);

  if (!row || row.status !== "pending") {
    return null;
  }

  const supportersBySuggestion = await listInstructionSuggestionSupporters(db, [
    row.id,
  ]);

  return {
    ...toPendingInstructionSuggestion({
      ...row,
      supporters: supportersBySuggestion.get(row.id) ?? [],
    }),
    status: "pending" as const,
  };
}

export async function dismissToolInstructionSuggestion(
  organizationId: string,
  suggestionId: string,
  reason: string,
  actor: Actor,
) {
  const db = getDb();
  const now = new Date();
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new AppError("Dismissal reason is required.", 400);
  }

  const [updated] = await db
    .update(toolInstructionSuggestions)
    .set({
      status: "dismissed",
      dismissalReason: trimmedReason,
      decidedByUserId: actor.actorId,
      decidedByEmail: actor.actorEmail,
      decidedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(toolInstructionSuggestions.organizationId, organizationId),
        eq(toolInstructionSuggestions.id, suggestionId),
        eq(toolInstructionSuggestions.status, "pending"),
      ),
    )
    .returning();

  if (!updated) {
    throw new AppError("Only pending instruction suggestions can be dismissed.", 409);
  }

  await appendAuditLog({
    organizationId,
    actorType: "human",
    actorId: actor.actorId,
    actorLabel: actor.actorEmail,
    action: "tool_instruction_suggestion.dismissed",
    targetType: "tool_instruction_suggestion",
    targetId: updated.id,
    metadata: {
      toolId: updated.toolId,
      reason: trimmedReason,
    },
  });

  return updated;
}

export async function suggestToolInstruction(input: {
  organizationId: string;
  agentId: string;
  agentName: string;
  toolId: string;
  learned: string;
  why: string;
}): Promise<
  | {
      outcome: "suggested";
      suggestionId: string;
      existing: boolean;
      requestedAt: Date;
    }
  | {
      outcome: "dismissed";
      suggestionId: string;
      dismissalReason: string | null;
    }
> {
  const db = getDb();
  const now = new Date();
  const learned = input.learned.trim();
  const why = input.why.trim();
  const normalizedLearned = normalizeToolInstructionLearned(learned);

  return db.transaction(async (tx) => {
    const [toolRow] = await tx
      .select({
        id: tools.id,
        name: tools.name,
        currentInstructionVersionId: tools.currentInstructionVersionId,
        accessStatus: accessGrants.status,
      })
      .from(tools)
      .leftJoin(
        accessGrants,
        and(
          eq(accessGrants.organizationId, input.organizationId),
          eq(accessGrants.agentId, input.agentId),
          eq(accessGrants.toolId, tools.id),
        ),
      )
      .where(
        and(eq(tools.organizationId, input.organizationId), eq(tools.id, input.toolId)),
      )
      .limit(1);

    if (!toolRow) {
      throw new AppError("Tool not found.", 404);
    }

    if (toolRow.accessStatus !== "approved") {
      throw new AppError(
        "This tool has not been approved for the agent.",
        403,
        "Use this endpoint only after the tool has been approved and used.",
      );
    }

    if (!toolRow.currentInstructionVersionId) {
      throw new AppError("Instruction history is not configured for this tool.", 500);
    }

    await acquireInstructionSuggestionLock(
      tx,
      input.organizationId,
      input.toolId,
      toolRow.currentInstructionVersionId,
      normalizedLearned,
    );

    const existing = await tx.query.toolInstructionSuggestions.findFirst({
      where: and(
        eq(toolInstructionSuggestions.organizationId, input.organizationId),
        eq(toolInstructionSuggestions.toolId, input.toolId),
        eq(
          toolInstructionSuggestions.baseVersionId,
          toolRow.currentInstructionVersionId,
        ),
        eq(toolInstructionSuggestions.normalizedLearned, normalizedLearned),
      ),
      orderBy: desc(toolInstructionSuggestions.updatedAt),
    });

    if (existing?.status === "dismissed") {
      return {
        outcome: "dismissed",
        suggestionId: existing.id,
        dismissalReason: existing.dismissalReason ?? null,
      };
    }

    if (existing?.status === "pending") {
      await upsertInstructionSuggestionSupporter(tx, {
        organizationId: input.organizationId,
        suggestionId: existing.id,
        agentId: input.agentId,
        why,
        now,
      });

      await appendAuditLog(
        {
          organizationId: input.organizationId,
          actorType: "agent",
          actorId: input.agentId,
          actorLabel: input.agentName,
          action: "tool_instruction_suggestion.supported",
          targetType: "tool_instruction_suggestion",
          targetId: existing.id,
          metadata: {
            toolId: input.toolId,
            toolName: toolRow.name,
          },
        },
        tx,
      );

      return {
        outcome: "suggested",
        suggestionId: existing.id,
        existing: true,
        requestedAt: now,
      };
    }

    const [created] = await tx
      .insert(toolInstructionSuggestions)
      .values({
        organizationId: input.organizationId,
        toolId: input.toolId,
        baseVersionId: toolRow.currentInstructionVersionId,
        learned,
        normalizedLearned,
        status: "pending",
      })
      .returning();

    await upsertInstructionSuggestionSupporter(tx, {
      organizationId: input.organizationId,
      suggestionId: created.id,
      agentId: input.agentId,
      why,
      now,
    });

    await appendAuditLog(
      {
        organizationId: input.organizationId,
        actorType: "agent",
        actorId: input.agentId,
        actorLabel: input.agentName,
        action: "tool_instruction_suggestion.created",
        targetType: "tool_instruction_suggestion",
        targetId: created.id,
        metadata: {
          toolId: input.toolId,
          toolName: toolRow.name,
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
