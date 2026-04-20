import assert from "node:assert/strict";
import test from "node:test";

import {
  generateAgentApiKey,
  hashAgentApiKey,
  verifyAgentApiKey,
} from "@/lib/agent-keys";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  assertApprovalInput,
  assertGrantCanBeRequested,
} from "@/lib/core/grants";
import { normalizeOrganizationIdentity } from "@/lib/core/organizations";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

test("agent API keys hash and verify correctly", () => {
  const apiKey = generateAgentApiKey();
  const hash = hashAgentApiKey(apiKey);

  assert.equal(apiKey.startsWith("sk_agent_"), true);
  assert.equal(verifyAgentApiKey(apiKey, hash), true);
  assert.equal(verifyAgentApiKey(`${apiKey}_wrong`, hash), false);
});

test("credentials round-trip through AES encryption", () => {
  const secret = "lin_api_secret";
  const encrypted = encryptSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.equal(decryptSecret(encrypted), secret);
});

test("organization identity normalization trims and slugifies", () => {
  const normalized = normalizeOrganizationIdentity({
    clerkOrgId: "org_123",
    name: "  Acme Platform Team  ",
    slug: "",
  });

  assert.deepEqual(normalized, {
    clerkOrgId: "org_123",
    name: "Acme Platform Team",
    slug: "acme-platform-team",
  });
});

test("pending or approved grants cannot be requested again", () => {
  assert.throws(
    () => assertGrantCanBeRequested({ status: "pending" }),
    /pending request/,
  );
  assert.throws(
    () => assertGrantCanBeRequested({ status: "approved" }),
    /already have access/,
  );
  assert.doesNotThrow(() =>
    assertGrantCanBeRequested({ status: "denied" }),
  );
  assert.doesNotThrow(() =>
    assertGrantCanBeRequested({ status: "revoked" }),
  );
});

test("per-agent approvals require a credential", () => {
  assert.throws(
    () => assertApprovalInput("per_agent", ""),
    /require a credential/,
  );
  assert.doesNotThrow(() => assertApprovalInput("shared"));
  assert.doesNotThrow(() =>
    assertApprovalInput("per_agent", "discord_bot_token"),
  );
});
