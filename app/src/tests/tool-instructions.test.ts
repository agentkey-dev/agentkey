import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInstructionSuggestionDraft,
  normalizeToolInstructionLearned,
} from "@/lib/core/tool-instruction-suggestions";
import { auditLog, toolInstructionSuggestionAgents, toolInstructionSuggestions } from "@/lib/db/schema";
import { suggestToolInstruction } from "@/lib/services/tool-instructions";

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

test("instruction learned text is normalized for dedupe", () => {
  assert.equal(
    normalizeToolInstructionLearned("  Project key: PLATFORM!!!  "),
    "project key platform",
  );
});

test("instruction suggestion draft appends learned text below existing guide", () => {
  assert.equal(
    buildInstructionSuggestionDraft(
      "Use Authorization: Bearer <token>.",
      "Project key is PLATFORM.",
    ),
    "Use Authorization: Bearer <token>.\n\nProject key is PLATFORM.",
  );
});

test("suggestToolInstruction creates a new pending suggestion for an approved tool", async () => {
  const supporterWrites: Array<Record<string, unknown>> = [];
  const auditWrites: Array<Record<string, unknown>> = [];
  let createdSuggestionId: string | null = null;

  const tx = {
    select() {
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
        limit: async () => [
          {
            id: "tool-1",
            name: "Linear",
            currentInstructionVersionId: "version-1",
            accessStatus: "approved",
          },
        ],
      };
    },
    query: {
      toolInstructionSuggestions: {
        findFirst: async () => null,
      },
    },
    execute: async () => [],
    insert(table: unknown) {
      if (table === toolInstructionSuggestions) {
        return {
          values(values: Record<string, unknown>) {
            return {
              returning: async () => {
                createdSuggestionId = "suggestion-1";
                return [
                  {
                    ...values,
                    id: createdSuggestionId,
                    createdAt: new Date("2026-04-07T09:00:00.000Z"),
                  },
                ];
              },
            };
          },
        };
      }

      if (table === toolInstructionSuggestionAgents) {
        return {
          values(values: Record<string, unknown>) {
            return {
              onConflictDoUpdate: async () => {
                supporterWrites.push(values);
              },
            };
          },
        };
      }

      if (table === auditLog) {
        return {
          values: async (values: Record<string, unknown>) => {
            auditWrites.push(values);
            return [];
          },
        };
      }

      throw new Error("Unexpected insert table");
    },
  };

  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx),
  };

  await withMockDb(db, async () => {
    const result = await suggestToolInstruction({
      organizationId: "org-1",
      agentId: "agent-1",
      agentName: "Bug Bot",
      toolId: "tool-1",
      learned: "Project key is PLATFORM.",
      why: "Future agents need the right key.",
    });

    assert.deepEqual(result, {
      outcome: "suggested",
      suggestionId: "suggestion-1",
      existing: false,
      requestedAt: new Date("2026-04-07T09:00:00.000Z"),
    });
  });

  assert.equal(createdSuggestionId, "suggestion-1");
  assert.equal(supporterWrites.length, 1);
  assert.equal(auditWrites.length, 1);
});

test("suggestToolInstruction supports an existing pending suggestion", async () => {
  const supporterWrites: Array<Record<string, unknown>> = [];
  const auditWrites: Array<Record<string, unknown>> = [];

  const tx = {
    select() {
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
        limit: async () => [
          {
            id: "tool-1",
            name: "Linear",
            currentInstructionVersionId: "version-1",
            accessStatus: "approved",
          },
        ],
      };
    },
    query: {
      toolInstructionSuggestions: {
        findFirst: async () => ({
          id: "suggestion-1",
          status: "pending",
        }),
      },
    },
    execute: async () => [],
    insert(table: unknown) {
      if (table === toolInstructionSuggestionAgents) {
        return {
          values(values: Record<string, unknown>) {
            return {
              onConflictDoUpdate: async () => {
                supporterWrites.push(values);
              },
            };
          },
        };
      }

      if (table === auditLog) {
        return {
          values: async (values: Record<string, unknown>) => {
            auditWrites.push(values);
            return [];
          },
        };
      }

      throw new Error("Unexpected insert table");
    },
  };

  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx),
  };

  await withMockDb(db, async () => {
    const result = await suggestToolInstruction({
      organizationId: "org-1",
      agentId: "agent-2",
      agentName: "Deploy Bot",
      toolId: "tool-1",
      learned: "Project key is PLATFORM.",
      why: "Deploy notes should file in the same project.",
    });

    assert.equal(result.outcome, "suggested");
    assert.equal(result.existing, true);
    assert.equal(result.suggestionId, "suggestion-1");
  });

  assert.equal(supporterWrites.length, 1);
  assert.equal(auditWrites.length, 1);
});

test("suggestToolInstruction returns the stored dismissal reason for the current version", async () => {
  const tx = {
    select() {
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
        limit: async () => [
          {
            id: "tool-1",
            name: "Linear",
            currentInstructionVersionId: "version-1",
            accessStatus: "approved",
          },
        ],
      };
    },
    query: {
      toolInstructionSuggestions: {
        findFirst: async () => ({
          id: "suggestion-1",
          status: "dismissed",
          dismissalReason: "Already covered in the current guide.",
        }),
      },
    },
    execute: async () => [],
  };

  const db = {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(tx),
  };

  await withMockDb(db, async () => {
    const result = await suggestToolInstruction({
      organizationId: "org-1",
      agentId: "agent-1",
      agentName: "Bug Bot",
      toolId: "tool-1",
      learned: "Project key is PLATFORM.",
      why: "Future agents need the right key.",
    });

    assert.deepEqual(result, {
      outcome: "dismissed",
      suggestionId: "suggestion-1",
      dismissalReason: "Already covered in the current guide.",
    });
  });
});
