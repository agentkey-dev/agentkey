import assert from "node:assert/strict";
import test from "node:test";

import { decryptSecret } from "@/lib/crypto";
import { accessGrants, agents, auditLog } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import {
  approveRequest,
  assignToolToAgent,
  createAgent,
  getRecentAgentActivity,
  updateAgent,
} from "@/lib/services/admin";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

type GrantStatus = "pending" | "approved" | "denied" | "revoked";

type GrantState = {
  id: string;
  organizationId: string;
  agentId: string;
  toolId: string;
  status: GrantStatus;
  denialReason: string | null;
  reason: string | null;
  credentialEncrypted: string | null;
  decidedByUserId: string | null;
  decidedByEmail: string | null;
  decidedAt: Date | null;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  toolName?: string;
  toolCredentialMode?: "per_agent" | "shared";
};

type AssignState = {
  agent: {
    id: string;
    organizationId: string;
    status: "active" | "suspended";
  } | null;
  tool: {
    id: string;
    organizationId: string;
    name: string;
    credentialMode: "per_agent" | "shared";
  } | null;
  grant: GrantState | null;
};

function createApproveTx(state: { grant: GrantState }, failAuditInsert: boolean) {
  return {
    select() {
      return {
        from() {
          return this;
        },
        innerJoin() {
          return this;
        },
        where() {
          return this;
        },
        limit() {
          return this;
        },
        for() {
          return Promise.resolve([
            {
              id: state.grant.id,
              agentId: state.grant.agentId,
              toolId: state.grant.toolId,
              toolName: state.grant.toolName,
              status: state.grant.status,
              toolCredentialMode: state.grant.toolCredentialMode,
            },
          ]);
        },
      };
    },
    update(table: unknown) {
      assert.equal(table, accessGrants);

      return {
        set(values: Partial<GrantState>) {
          return {
            where() {
              return {
                returning: async () => {
                  if (state.grant.status !== "pending") {
                    return [];
                  }

                  state.grant = {
                    ...state.grant,
                    ...values,
                  };

                  return [state.grant];
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: async () => {
          if (table === auditLog && failAuditInsert) {
            throw new Error("audit write failed");
          }

          return [];
        },
      };
    },
  };
}

function createAssignTx(
  state: AssignState,
  options?: {
    failAuditInsert?: boolean;
    uniqueViolationOnInsert?: boolean;
  },
) {
  return {
    query: {
      agents: {
        findFirst: async () => state.agent,
      },
      tools: {
        findFirst: async () => state.tool,
      },
      accessGrants: {
        findFirst: async () => state.grant,
      },
    },
    update(table: unknown) {
      assert.equal(table, accessGrants);

      return {
        set(values: Partial<GrantState>) {
          return {
            where() {
              return {
                returning: async () => {
                  if (!state.grant) {
                    return [];
                  }

                  state.grant = {
                    ...state.grant,
                    ...values,
                  };

                  return [state.grant];
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      if (table === accessGrants) {
        return {
          values: (
            values: Pick<
              GrantState,
              | "organizationId"
              | "agentId"
              | "toolId"
              | "status"
              | "reason"
              | "denialReason"
              | "credentialEncrypted"
              | "decidedByUserId"
              | "decidedByEmail"
              | "decidedAt"
              | "updatedAt"
            >,
          ) => {
            return {
              returning: async () => {
                if (options?.uniqueViolationOnInsert) {
                  throw { code: "23505" };
                }

                const now =
                  values.decidedAt ?? new Date("2026-04-01T00:00:00.000Z");
                state.grant = {
                  id: "grant-created",
                  organizationId: values.organizationId,
                  agentId: values.agentId,
                  toolId: values.toolId,
                  status: values.status,
                  reason: values.reason,
                  denialReason: values.denialReason,
                  credentialEncrypted: values.credentialEncrypted,
                  decidedByUserId: values.decidedByUserId,
                  decidedByEmail: values.decidedByEmail,
                  decidedAt: values.decidedAt,
                  requestedAt: now,
                  createdAt: now,
                  updatedAt: values.updatedAt,
                };

                return [state.grant];
              },
            };
          },
        };
      }

      return {
        values: async () => {
          if (table === auditLog && options?.failAuditInsert) {
            throw new Error("audit write failed");
          }

          return [];
        },
      };
    },
  };
}

function createUpdateAgentTx(
  state: {
    agent: (typeof agents.$inferSelect) | null;
  },
  options?: {
    failAuditInsert?: boolean;
  },
) {
  return {
    query: {
      agents: {
        findFirst: async () => state.agent,
      },
    },
    update(table: unknown) {
      assert.equal(table, agents);

      return {
        set(values: Partial<typeof agents.$inferSelect>) {
          return {
            where() {
              return {
                returning: async () => {
                  if (!state.agent) {
                    return [];
                  }

                  state.agent = {
                    ...state.agent,
                    ...values,
                  };

                  return [state.agent];
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: async () => {
          if (table === auditLog && options?.failAuditInsert) {
            throw new Error("audit write failed");
          }

          return [];
        },
      };
    },
  };
}

async function withMockTransaction<TState>(
  state: TState,
  createTx: (
    draft: TState,
  ) => {
    insert?: (table: unknown) => { values: (...args: unknown[]) => Promise<unknown> };
    update?: (table: unknown) => unknown;
    select?: () => unknown;
    query?: Record<string, unknown>;
  },
  callback: () => Promise<unknown>,
) {
  const previousDb = globalThis.__toolProvisioningDb;
  const previousSql = globalThis.__toolProvisioningSql;

  globalThis.__toolProvisioningSql = {} as never;
  globalThis.__toolProvisioningDb = {
    transaction: async (transactionCallback: (tx: unknown) => Promise<unknown>) => {
      const draft = structuredClone(state);

      try {
        const result = await transactionCallback(createTx(draft) as never);
        Object.assign(state as object, draft);
        return result;
      } catch (error) {
        throw error;
      }
    },
  } as never;

  try {
    return await callback();
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
    globalThis.__toolProvisioningSql = previousSql;
  }
}

async function withMockDb(
  db: unknown,
  callback: () => Promise<unknown>,
) {
  const previousDb = globalThis.__toolProvisioningDb;
  const previousSql = globalThis.__toolProvisioningSql;

  globalThis.__toolProvisioningSql = {} as never;
  globalThis.__toolProvisioningDb = db as never;

  try {
    return await callback();
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
    globalThis.__toolProvisioningSql = previousSql;
  }
}

test("createAgent returns a catalog item payload with empty access state", async () => {
  const createdAt = new Date("2026-04-01T10:00:00.000Z");
  const updatedAt = new Date("2026-04-01T10:00:00.000Z");
  const createdRow = {
    id: "agent-1",
    organizationId: "org-1",
    name: "Bug Bot",
    description: "Tracks bugs",
    apiKeyHash: "hash",
    createdByUserId: "user-1",
    createdByEmail: "admin@example.com",
    status: "active" as const,
    createdAt,
    updatedAt,
  };

  const db = {
    insert(table: unknown) {
      if (table === agents) {
        return {
          values() {
            return {
              returning: async () => [createdRow],
            };
          },
        };
      }

      if (table === auditLog) {
        return {
          values: async () => [],
        };
      }

      throw new Error("unexpected table");
    },
  };

  const result = await withMockDb(db, () =>
    createAgent(
      "org-1",
      {
        name: "Bug Bot",
        description: "Tracks bugs",
      },
      {
        actorId: "user-1",
        actorEmail: "admin@example.com",
      },
    ),
  );

  assert.equal(typeof result.apiKey, "string");
  assert.equal(result.agentId, "agent-1");
  assert.deepEqual(result.agent, {
    ...createdRow,
    lastActiveAt: null,
    toolsGranted: [],
    toolsPending: [],
    grantedTools: [],
    pendingTools: [],
  });
});

test("updateAgent updates name and description and preserves access summaries", async () => {
  const createdAt = new Date("2026-04-01T10:00:00.000Z");
  const originalUpdatedAt = new Date("2026-04-01T10:00:00.000Z");
  const lastActiveAt = new Date("2026-04-03T09:00:00.000Z");
  const state = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      name: "Bug Bot",
      description: "Tracks bugs",
      apiKeyHash: "hash",
      createdByUserId: "user-1",
      createdByEmail: "admin@example.com",
      status: "active" as const,
      createdAt,
      updatedAt: originalUpdatedAt,
    },
  };
  let selectCall = 0;
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(createUpdateAgentTx(state) as never),
    select() {
      selectCall += 1;

      if (selectCall === 1) {
        return {
          from() {
            return this;
          },
          innerJoin() {
            return this;
          },
          where: async () => [
            {
              agentId: "agent-1",
              requestId: "grant-1",
              status: "approved",
              toolId: "tool-1",
              toolName: "Linear",
              toolCredentialMode: "shared" as const,
            },
            {
              agentId: "agent-1",
              requestId: "grant-2",
              status: "pending",
              toolId: "tool-2",
              toolName: "Notion",
              toolCredentialMode: "per_agent" as const,
            },
          ],
        };
      }

      return {
        from() {
          return this;
        },
        leftJoin() {
          return this;
        },
        where() {
          return this;
        },
        orderBy: async () => [
          {
            id: "evt-1",
            agentId: "agent-1",
            action: "credential.vended",
            createdAt: lastActiveAt,
            toolId: "tool-1",
            toolName: "Linear",
          },
        ],
      };
    },
  };

  const result = await withMockDb(db, () =>
    updateAgent(
      "org-1",
      "agent-1",
      {
        name: "Bug Tracker",
        description: "Tracks bugs and triages issues",
      },
      {
        actorId: "user-1",
        actorEmail: "admin@example.com",
      },
    ),
  );

  assert.equal(result.name, "Bug Tracker");
  assert.equal(result.description, "Tracks bugs and triages issues");
  assert.equal(result.lastActiveAt, lastActiveAt);
  assert.deepEqual(result.grantedTools, [
    { toolId: "tool-1", toolName: "Linear" },
  ]);
  assert.deepEqual(result.pendingTools, [
    {
      requestId: "grant-2",
      toolId: "tool-2",
      toolName: "Notion",
      toolCredentialMode: "per_agent",
    },
  ]);
  assert.equal(result.updatedAt instanceof Date, true);
  assert.notEqual(result.updatedAt, originalUpdatedAt);
});

test("updateAgent returns 404 for unknown agents", async () => {
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(
        createUpdateAgentTx({
          agent: null,
        }) as never,
      ),
  };

  await assert.rejects(
    () =>
      withMockDb(db, () =>
        updateAgent(
          "org-1",
          "agent-missing",
          {
            name: "Missing",
          },
          {
            actorId: "user-1",
            actorEmail: "admin@example.com",
          },
        ),
      ),
    (error) =>
      error instanceof AppError &&
      error.status === 404 &&
      error.message === "Agent not found.",
  );
});

test("updateAgent writes an agent.updated audit event", async () => {
  const state = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      name: "Bug Bot",
      description: "Tracks bugs",
      apiKeyHash: "hash",
      createdByUserId: "user-1",
      createdByEmail: "admin@example.com",
      status: "active" as const,
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      updatedAt: new Date("2026-04-01T10:00:00.000Z"),
    },
  };
  const auditEntries: Array<Record<string, unknown>> = [];
  let selectCall = 0;
  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        ...createUpdateAgentTx(state),
        insert(table: unknown) {
          return {
            values: async (values: Record<string, unknown>) => {
              if (table === auditLog) {
                auditEntries.push(values);
              }

              return [];
            },
          };
        },
      } as never),
    select() {
      selectCall += 1;

      if (selectCall === 1) {
        return {
          from() {
            return this;
          },
          innerJoin() {
            return this;
          },
          where: async () => [],
        };
      }

      return {
        from() {
          return this;
        },
        leftJoin() {
          return this;
        },
        where() {
          return this;
        },
        orderBy: async () => [],
      };
    },
  };

  await withMockDb(db, () =>
    updateAgent(
      "org-1",
      "agent-1",
      {
        name: "Bug Tracker",
      },
      {
        actorId: "user-1",
        actorEmail: "admin@example.com",
      },
    ),
  );

  assert.equal(auditEntries[0]?.action, "agent.updated");
  assert.deepEqual(auditEntries[0]?.metadata, {
    agentId: "agent-1",
    name: "Bug Tracker",
  });
});

test("getRecentAgentActivity maps audit metadata into drawer activity events", async () => {
  const createdAt = new Date("2026-04-02T10:00:00.000Z");
  const db = {
    query: {
      auditLog: {
        findMany: async () => [
          {
            id: "evt-1",
            action: "grant.revoked",
            createdAt,
            metadata: {
              agentId: "agent-1",
              toolId: "tool-1",
              toolName: "Linear",
            },
          },
          {
            id: "evt-2",
            action: "agent.key_rotated",
            createdAt: new Date("2026-04-01T10:00:00.000Z"),
            metadata: null,
          },
        ],
      },
    },
  };

  const result = await withMockDb(db, () =>
    getRecentAgentActivity("org-1", "agent-1", 5),
  );

  assert.deepEqual(result, [
    {
      id: "evt-1",
      action: "grant.revoked",
      createdAt,
      toolId: "tool-1",
      toolName: "Linear",
    },
    {
      id: "evt-2",
      action: "agent.key_rotated",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
      toolId: null,
      toolName: null,
    },
  ]);
});

test("approveRequest rolls back the grant update if the audit insert fails", async () => {
  const state = {
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      toolName: "Discord",
      status: "pending" as const,
      toolCredentialMode: "per_agent" as const,
      denialReason: null,
      reason: "Need to manage alerts",
      credentialEncrypted: null,
      decidedByUserId: null,
      decidedByEmail: null,
      decidedAt: null,
      requestedAt: new Date("2026-03-31T09:00:00.000Z"),
      createdAt: new Date("2026-03-31T09:00:00.000Z"),
      updatedAt: new Date("2026-03-31T10:00:00.000Z"),
    },
  };

  await withMockTransaction(
    state,
    (draft) => createApproveTx(draft as { grant: GrantState }, true),
    async () => {
      await assert.rejects(
        () =>
          approveRequest("org-1", "grant-1", "discord_bot_token", {
            actorId: "user-1",
            actorEmail: "admin@example.com",
          }),
        /audit write failed/,
      );
    },
  );

  assert.equal(state.grant.status, "pending");
  assert.equal(state.grant.credentialEncrypted, null);
  assert.equal(state.grant.decidedByUserId, null);
});

test("assignToolToAgent rolls back a new grant if the audit insert fails", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Linear",
      credentialMode: "shared",
    },
    grant: null,
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState, { failAuditInsert: true }),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        /audit write failed/,
      );
    },
  );

  assert.equal(state.grant, null);
});

test("assignToolToAgent rolls back a revived grant if the audit insert fails", async () => {
  const originalRequestedAt = new Date("2026-03-20T10:00:00.000Z");
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Linear",
      credentialMode: "shared",
    },
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      status: "denied",
      reason: "Old request context",
      denialReason: "Not now",
      credentialEncrypted: null,
      decidedByUserId: "user-old",
      decidedByEmail: "old@example.com",
      decidedAt: new Date("2026-03-20T11:00:00.000Z"),
      requestedAt: originalRequestedAt,
      createdAt: new Date("2026-03-20T10:00:00.000Z"),
      updatedAt: new Date("2026-03-20T11:00:00.000Z"),
    },
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState, { failAuditInsert: true }),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        /audit write failed/,
      );
    },
  );

  assert.equal(state.grant?.status, "denied");
  assert.equal(state.grant?.reason, "Old request context");
  assert.equal(state.grant?.denialReason, "Not now");
  assert.equal(state.grant?.requestedAt, originalRequestedAt);
});

test("assignToolToAgent creates an approved shared grant", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Linear",
      credentialMode: "shared",
    },
    grant: null,
  };

  const grant = (await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    () =>
      assignToolToAgent(
        "org-1",
        "agent-1",
        { toolId: "tool-1" },
        {
          actorId: "user-1",
          actorEmail: "admin@example.com",
        },
      ),
  )) as GrantState;

  assert.equal(grant.status, "approved");
  assert.equal(grant.reason, null);
  assert.equal(grant.denialReason, null);
  assert.equal(grant.credentialEncrypted, null);
  assert.equal(grant.decidedByUserId, "user-1");
  assert.equal(state.grant?.status, "approved");
});

test("assignToolToAgent reassigns denied grants to approved", async () => {
  const requestedAt = new Date("2026-03-18T08:00:00.000Z");
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Discord",
      credentialMode: "per_agent",
    },
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      status: "denied",
      reason: "Old request",
      denialReason: "Use the shared bot",
      credentialEncrypted: null,
      decidedByUserId: "user-old",
      decidedByEmail: "old@example.com",
      decidedAt: new Date("2026-03-18T09:00:00.000Z"),
      requestedAt,
      createdAt: requestedAt,
      updatedAt: new Date("2026-03-18T09:00:00.000Z"),
    },
  };

  const grant = (await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    () =>
      assignToolToAgent(
        "org-1",
        "agent-1",
        { toolId: "tool-1", credential: "discord_bot_token" },
        {
          actorId: "user-1",
          actorEmail: "admin@example.com",
        },
      ),
  )) as GrantState;

  assert.equal(grant.status, "approved");
  assert.equal(grant.reason, null);
  assert.equal(grant.denialReason, null);
  assert.equal(grant.requestedAt.toISOString(), requestedAt.toISOString());
  assert.equal(decryptSecret(grant.credentialEncrypted ?? ""), "discord_bot_token");
});

test("assignToolToAgent reassigns revoked grants to approved", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Notion",
      credentialMode: "shared",
    },
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      status: "revoked",
      reason: null,
      denialReason: "Credential rotated",
      credentialEncrypted: null,
      decidedByUserId: "user-old",
      decidedByEmail: "old@example.com",
      decidedAt: new Date("2026-03-18T09:00:00.000Z"),
      requestedAt: new Date("2026-03-18T08:00:00.000Z"),
      createdAt: new Date("2026-03-18T08:00:00.000Z"),
      updatedAt: new Date("2026-03-18T09:00:00.000Z"),
    },
  };

  const grant = (await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    () =>
      assignToolToAgent(
        "org-1",
        "agent-1",
        { toolId: "tool-1" },
        {
          actorId: "user-1",
          actorEmail: "admin@example.com",
        },
      ),
  )) as GrantState;

  assert.equal(grant.status, "approved");
  assert.equal(grant.denialReason, null);
  assert.equal(grant.credentialEncrypted, null);
});

test("assignToolToAgent rejects pending grants", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Notion",
      credentialMode: "shared",
    },
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      status: "pending",
      reason: "Waiting",
      denialReason: null,
      credentialEncrypted: null,
      decidedByUserId: null,
      decidedByEmail: null,
      decidedAt: null,
      requestedAt: new Date("2026-03-18T08:00:00.000Z"),
      createdAt: new Date("2026-03-18T08:00:00.000Z"),
      updatedAt: new Date("2026-03-18T08:00:00.000Z"),
    },
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        (error) =>
          error instanceof AppError &&
          error.status === 409 &&
          error.message.includes("pending request"),
      );
    },
  );
});

test("assignToolToAgent rejects approved grants", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Notion",
      credentialMode: "shared",
    },
    grant: {
      id: "grant-1",
      organizationId: "org-1",
      agentId: "agent-1",
      toolId: "tool-1",
      status: "approved",
      reason: null,
      denialReason: null,
      credentialEncrypted: null,
      decidedByUserId: "user-1",
      decidedByEmail: "admin@example.com",
      decidedAt: new Date("2026-03-18T09:00:00.000Z"),
      requestedAt: new Date("2026-03-18T08:00:00.000Z"),
      createdAt: new Date("2026-03-18T08:00:00.000Z"),
      updatedAt: new Date("2026-03-18T09:00:00.000Z"),
    },
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        (error) =>
          error instanceof AppError &&
          error.status === 409 &&
          error.message.includes("already has access"),
      );
    },
  );
});

test("assignToolToAgent rejects suspended agents", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "suspended",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Notion",
      credentialMode: "shared",
    },
    grant: null,
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        (error) =>
          error instanceof AppError &&
          error.status === 409 &&
          error.message.includes("Suspended agents"),
      );
    },
  );
});

test("assignToolToAgent requires a per-agent credential", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Discord",
      credentialMode: "per_agent",
    },
    grant: null,
  };

  await withMockTransaction(
    state,
    (draft) => createAssignTx(draft as AssignState),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        (error) =>
          error instanceof AppError &&
          error.status === 400 &&
          error.message.includes("require a credential"),
      );
    },
  );
});

test("assignToolToAgent maps unique index collisions to a conflict", async () => {
  const state: AssignState = {
    agent: {
      id: "agent-1",
      organizationId: "org-1",
      status: "active",
    },
    tool: {
      id: "tool-1",
      organizationId: "org-1",
      name: "Notion",
      credentialMode: "shared",
    },
    grant: null,
  };

  await withMockTransaction(
    state,
    (draft) =>
      createAssignTx(draft as AssignState, { uniqueViolationOnInsert: true }),
    async () => {
      await assert.rejects(
        () =>
          assignToolToAgent(
            "org-1",
            "agent-1",
            { toolId: "tool-1" },
            {
              actorId: "user-1",
              actorEmail: "admin@example.com",
            },
          ),
        (error) =>
          error instanceof AppError &&
          error.status === 409 &&
          error.message.includes("already has a grant"),
      );
    },
  );
});
