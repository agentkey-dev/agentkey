import assert from "node:assert/strict";
import test from "node:test";
import { type SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

import { createAgentCatalogItem } from "@/lib/agent-catalog";
import { toAccessGrantResponse } from "@/lib/core/grants";
import { diffToolCatalog } from "@/lib/core/tool-config";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { auditLog, type accessGrants, type agents } from "@/lib/db/schema";
import { AppError } from "@/lib/http";
import { applyToolCatalogImport, assignToolToAgent } from "@/lib/services/admin";
import { getCredentialForAgent } from "@/lib/services/agent";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const baseTool = {
  id: "tool-1",
  organizationId: "org-1",
  configKey: "github",
  name: "GitHub",
  description: "Source control",
  url: "https://github.com/",
  authType: "api_key" as const,
  credentialMode: "shared" as const,
  credentialConfigured: true,
  instructions: "Use the approved repository only.",
};

async function withDb<T>(db: unknown, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.__toolProvisioningDb;
  globalThis.__toolProvisioningDb = db as never;
  try {
    return await run();
  } finally {
    globalThis.__toolProvisioningDb = previous;
  }
}

test("imports reject changing either credential mode before any write", async () => {
  for (const credentialMode of ["shared", "per_agent"] as const) {
    const otherMode: "shared" | "per_agent" = credentialMode === "shared" ? "per_agent" : "shared";
    const existing = { ...baseTool, credentialMode };
    const imported = { ...baseTool, key: baseTool.configKey, credentialMode: otherMode };
    const diff = diffToolCatalog([existing], [imported]);
    assert.equal(diff.counts.invalid, 1);
    assert.equal(diff.counts.update, 0);
    assert.match(diff.items[0].errors?.[0] ?? "", /Credential mode cannot be changed/);

    let writes = 0;
    await withDb({
      query: { tools: { findMany: async () => [existing] } },
      update() { writes++; throw new Error("must not write"); },
      insert() { writes++; throw new Error("must not write"); },
    }, async () => {
      await assert.rejects(() => applyToolCatalogImport("org-1", {
        body: JSON.stringify({ version: 1, tools: [imported] }),
        contentType: "application/json",
      }, { actorId: "user-1", actorEmail: "admin@example.test" }),
      (error) => error instanceof AppError && error.status === 400);
    });
    assert.equal(writes, 0);
  }
});

test("dashboard DTOs exclude key hashes and encrypted credentials", () => {
  const catalog = createAgentCatalogItem({
    id: "agent-1", apiKeyHash: "sensitive-hash", name: "Agent",
  } as typeof agents.$inferSelect);
  assert.equal("apiKeyHash" in catalog, false);
  const grant = toAccessGrantResponse({
    id: "grant-1", status: "approved", credentialEncrypted: "sensitive-ciphertext",
  } as typeof accessGrants.$inferSelect);
  assert.equal(grant.id, "grant-1");
  assert.equal("credentialEncrypted" in grant, false);
});

test("AES-GCM rejects modified, truncated, and noncanonical ciphertext", () => {
  const encrypted = encryptSecret("secret");
  for (const index of [0, 12, 28]) {
    const altered = Buffer.from(encrypted, "base64url");
    altered[index] ^= 1;
    assert.throws(() => decryptSecret(altered.toString("base64url")));
  }
  const empty = Buffer.from(encryptSecret(""), "base64url");
  // Node otherwise accepts a truncated 4-byte GCM tag for an empty message.
  assert.throws(() => decryptSecret(empty.subarray(0, 16).toString("base64url")));
  assert.throws(() => decryptSecret(`${encrypted}!`));
  assert.notEqual(encryptSecret("secret"), encrypted);
});

function credentialDb(options: {
  mode?: "shared" | "per_agent";
  status?: "approved" | "pending" | "denied" | "revoked" | null;
  expiresAt?: Date | null;
  missingTool?: boolean;
  failAudit?: boolean;
}) {
  const audits: Array<Record<string, unknown>> = [];
  const dialect = new SQLiteSyncDialect();
  return {
    audits,
    query: {
      tools: {
        findFirst: async ({ where }: { where: SQL }) => {
          const sql = dialect.sqlToQuery(where);
          assert.match(sql.sql, /"tools"\."organization_id" = \?/);
          assert.deepEqual(sql.params, ["tool-1", "org-1"]);
          return options.missingTool ? undefined : {
            ...baseTool,
            credentialMode: options.mode ?? "shared",
            credentialExpiresAt: options.expiresAt ?? null,
            credentialEncrypted: encryptSecret("shared-secret"),
          };
        },
      },
      accessGrants: {
        findFirst: async ({ where }: { where: SQL }) => {
          const sql = dialect.sqlToQuery(where);
          assert.match(sql.sql, /"access_grants"\."organization_id" = \?/);
          assert.match(sql.sql, /"access_grants"\."agent_id" = \?/);
          assert.match(sql.sql, /"access_grants"\."tool_id" = \?/);
          assert.deepEqual(sql.params, ["org-1", "agent-1", "tool-1"]);
          return options.status === null ? undefined : {
            status: options.status ?? "approved",
            credentialEncrypted: encryptSecret("agent-secret"),
          };
        },
      },
    },
    insert(table: unknown) {
      assert.equal(table, auditLog);
      return { values: async (entry: Record<string, unknown>) => {
        if (options.failAudit) throw new Error("audit unavailable");
        audits.push(entry);
      } };
    },
  };
}

test("credential vending enforces tenant and agent filters and chooses only the approved credential mode", async () => {
  for (const mode of ["shared", "per_agent"] as const) {
    const db = credentialDb({ mode });
    const result = await withDb(db, () => getCredentialForAgent("org-1", "agent-1", "tool-1", "Agent", {
      ip: "203.0.113.12",
      userAgent: "audit-test/1.0",
    }));
    assert.equal(result.credential, mode === "shared" ? "shared-secret" : "agent-secret");
    assert.equal(db.audits[0].action, "credential.vended");
    assert.deepEqual(db.audits[0].metadata, {
      agentId: "agent-1", toolId: "tool-1", toolName: "GitHub",
      ip: "203.0.113.12", userAgent: "audit-test/1.0",
    });
    assert.equal(JSON.stringify(db.audits).includes("secret"), false);
  }
});

test("direct D1 assignment cannot enable access if its audit write fails", async () => {
  for (const existing of [null, { id: "grant-1", status: "revoked", updatedAt: new Date() }]) {
    let grantWrites = 0;
    const db = {
      // These are the direct-executor capabilities checked by runDbMutation.
      select() { throw new Error("unexpected select"); },
      update() { grantWrites++; throw new Error("must not mutate grants"); },
      insert(table: unknown) {
        assert.equal(table, auditLog);
        return { values: async () => { throw new Error("audit unavailable"); } };
      },
      query: {
        agents: { findFirst: async () => ({ id: "agent-1", status: "active" }) },
        tools: { findFirst: async () => baseTool },
        accessGrants: { findFirst: async () => existing },
      },
    };
    await withDb(db, () => assert.rejects(() => assignToolToAgent(
      "org-1", "agent-1", { toolId: "tool-1" },
      { actorId: "user-1", actorEmail: "admin@example.test" },
    ), /audit unavailable/));
    assert.equal(grantWrites, 0);
  }
});

test("credential vending fails closed for missing tools, missing grants, revoked grants, expiry, and audit failures", async () => {
  for (const status of ["pending", "denied", "revoked", null] as const) {
    const db = credentialDb({ status });
    await withDb(db, () => assert.rejects(
      () => getCredentialForAgent("org-1", "agent-1", "tool-1", "Agent"),
      (error) => error instanceof AppError && error.status === 403,
    ));
    assert.equal(db.audits.length, 0);
  }
  for (const [options, status] of [
    [{ missingTool: true }, 404],
    [{ expiresAt: new Date(Date.now() - 1) }, 403],
  ] as const) {
    const db = credentialDb(options);
    await withDb(db, () => assert.rejects(
      () => getCredentialForAgent("org-1", "agent-1", "tool-1", "Agent"),
      (error) => error instanceof AppError && error.status === status,
    ));
    assert.equal(db.audits.length, 0);
  }
  const db = credentialDb({ failAudit: true });
  await withDb(db, () => assert.rejects(
    () => getCredentialForAgent("org-1", "agent-1", "tool-1", "Agent"),
    /audit unavailable/,
  ));
});
