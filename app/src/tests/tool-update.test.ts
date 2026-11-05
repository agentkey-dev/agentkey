import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { accessGrants, auditLog, toolInstructionVersions, tools } from "@/lib/db/schema";
import { updateTool } from "@/lib/services/admin";

test("tool rotation preserves multiline credentials and returns existing access", async () => {
  const previousDb = globalThis.__toolProvisioningDb;
  const previousEncryptionKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const originalCredential = "synthetic original credential";
  const multilineCredential = "Application key: synthetic application\nApplication secret: synthetic secret\nConsumer Key: synthetic consumer";
  let stored = {
    id: "tool-1", organizationId: "org-1", configKey: "example", name: "Example",
    description: "Synthetic tool", url: null, authType: "other", credentialMode: "shared",
    instructions: "Synthetic instructions", currentInstructionVersionId: "version-1",
    credentialEncrypted: encryptSecret(originalCredential), totpSecretEncrypted: null,
    credentialLastRotatedAt: new Date("2026-01-01"), credentialExpiresAt: null,
  };
  const grants = [
    { requestId: "grant-1", toolId: "tool-1", agentId: "agent-1", agentName: "Approved agent", status: "approved" },
    { requestId: "grant-2", toolId: "tool-1", agentId: "agent-2", agentName: "Pending agent", status: "pending" },
  ];
  const auditRows: Array<Record<string, unknown>> = [];
  const db = {
    query: {
      tools: { findFirst: async () => stored },
      toolSuggestions: { findMany: async () => [] },
    },
    insert(table: unknown) {
      return { values(values: Record<string, unknown>) {
        if (table === toolInstructionVersions) return { returning: async () => [{ ...values, id: "version-2" }] };
        assert.equal(table, auditLog);
        auditRows.push(values);
        return Promise.resolve();
      } };
    },
    update(table: unknown) {
      assert.equal(table, tools, "credential rotation must not modify access grants");
      return { set(values: Record<string, unknown>) {
        return { where() { return { returning: async () => {
          stored = { ...stored, ...values };
          return [stored];
        } }; } };
      } };
    },
    select() {
      return {
        from(table: unknown) { assert.equal(table, accessGrants); return this; },
        innerJoin() { return this; },
        where() { return this; },
        orderBy: async () => grants,
      };
    },
  };
  globalThis.__toolProvisioningDb = db as never;
  try {
    const updated = await updateTool("org-1", "tool-1", { credential: multilineCredential }, { actorId: "admin-1", actorEmail: "admin@example.invalid" });
    assert.equal(decryptSecret(stored.credentialEncrypted), multilineCredential);
    assert.equal(updated.approvedAgents, 1);
    assert.equal(updated.pendingAgents, 1);
    assert.deepEqual(updated.approvedAgentList, [{ agentId: "agent-1", agentName: "Approved agent" }]);
    assert.deepEqual(updated.pendingAgentList, [{ agentId: "agent-2", agentName: "Pending agent", requestId: "grant-2" }]);
    assert.equal("credentialEncrypted" in updated, false);
    assert.equal(JSON.stringify(auditRows).includes(multilineCredential), false);

    const ciphertext = stored.credentialEncrypted;
    const rotatedAt = stored.credentialLastRotatedAt;
    await updateTool("org-1", "tool-1", { credential: "", name: "Renamed" }, { actorId: "admin-1", actorEmail: "admin@example.invalid" });
    assert.equal(stored.credentialEncrypted, ciphertext, "saving metadata with a blank field must not rotate again");
    assert.equal(stored.credentialLastRotatedAt, rotatedAt);
  } finally {
    globalThis.__toolProvisioningDb = previousDb;
    if (previousEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEncryptionKey;
  }
});
