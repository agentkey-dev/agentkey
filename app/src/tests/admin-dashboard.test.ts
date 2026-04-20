import assert from "node:assert/strict";
import test from "node:test";

import {
  collectRecentAgentAccessEvents,
  getToolHealthStatus,
  summarizeAgentGrantRows,
  summarizeToolGrantRows,
} from "@/lib/services/admin";

test("agent grant summaries keep legacy names and structured tool references", () => {
  const summary = summarizeAgentGrantRows([
    {
      agentId: "agent-1",
      requestId: "grant-1",
      status: "approved",
      toolId: "tool-1",
      toolName: "Linear",
      toolCredentialMode: "shared",
    },
    {
      agentId: "agent-1",
      requestId: "grant-2",
      status: "pending",
      toolId: "tool-2",
      toolName: "Notion",
      toolCredentialMode: "per_agent",
    },
    {
      agentId: "agent-1",
      requestId: "grant-3",
      status: "revoked",
      toolId: "tool-3",
      toolName: "GitHub",
      toolCredentialMode: "shared",
    },
  ]);

  assert.deepEqual(summary.get("agent-1"), {
    granted: ["Linear"],
    pending: ["Notion"],
    grantedTools: [{ toolId: "tool-1", toolName: "Linear" }],
    pendingTools: [
      {
        requestId: "grant-2",
        toolId: "tool-2",
        toolName: "Notion",
        toolCredentialMode: "per_agent",
      },
    ],
  });
});

test("tool grant summaries expose counts and named agent lists", () => {
  const summary = summarizeToolGrantRows([
    {
      toolId: "tool-1",
      agentId: "agent-1",
      agentName: "Bug Bot",
      status: "approved",
    },
    {
      toolId: "tool-1",
      agentId: "agent-2",
      agentName: "Deploy Bot",
      status: "pending",
    },
    {
      toolId: "tool-1",
      agentId: "agent-3",
      agentName: "Audit Bot",
      status: "denied",
    },
  ]);

  assert.deepEqual(summary.get("tool-1"), {
    approved: 1,
    pending: 1,
    approvedAgentList: [{ agentId: "agent-1", agentName: "Bug Bot" }],
    pendingAgentList: [{ agentId: "agent-2", agentName: "Deploy Bot" }],
  });
});

test("recent agent access history is capped to five events per agent", () => {
  const summary = collectRecentAgentAccessEvents([
    {
      id: "evt-1",
      agentId: "agent-1",
      action: "grant.revoked",
      createdAt: new Date("2026-03-29T12:05:00Z"),
      toolId: "tool-1",
      toolName: "Linear",
    },
    {
      id: "evt-2",
      agentId: "agent-1",
      action: "credential.vended",
      createdAt: new Date("2026-03-29T12:04:00Z"),
      toolId: "tool-1",
      toolName: "Linear",
    },
    {
      id: "evt-3",
      agentId: "agent-1",
      action: "grant.approved",
      createdAt: new Date("2026-03-29T12:03:00Z"),
      toolId: "tool-2",
      toolName: "Notion",
    },
    {
      id: "evt-4",
      agentId: "agent-1",
      action: "grant.requested",
      createdAt: new Date("2026-03-29T12:02:00Z"),
      toolId: "tool-2",
      toolName: "Notion",
    },
    {
      id: "evt-5",
      agentId: "agent-1",
      action: "grant.denied",
      createdAt: new Date("2026-03-29T12:01:00Z"),
      toolId: "tool-3",
      toolName: "GitHub",
    },
    {
      id: "evt-6",
      agentId: "agent-1",
      action: "grant.requested",
      createdAt: new Date("2026-03-29T12:00:00Z"),
      toolId: "tool-4",
      toolName: "Slack",
    },
    {
      id: "evt-7",
      agentId: "agent-2",
      action: "grant.requested",
      createdAt: new Date("2026-03-29T11:59:00Z"),
      toolId: "tool-5",
      toolName: "Discord",
    },
  ]);

  assert.deepEqual(
    summary.get("agent-1")?.map((event) => event.id),
    ["evt-1", "evt-2", "evt-3", "evt-4", "evt-5"],
  );
  assert.equal(summary.get("agent-2")?.[0]?.toolName, "Discord");
});

test("tool health is healthy for per-agent tools", () => {
  assert.equal(
    getToolHealthStatus({
      credentialMode: "per_agent",
      credentialEncrypted: null,
      credentialLastRotatedAt: null,
      credentialExpiresAt: null,
    }),
    "healthy",
  );
});

test("tool health needs action when a shared credential is missing", () => {
  assert.equal(
    getToolHealthStatus({
      credentialMode: "shared",
      credentialEncrypted: null,
      credentialLastRotatedAt: null,
      credentialExpiresAt: null,
    }),
    "action_needed",
  );
});

test("tool health flags stale shared credentials for attention", () => {
  assert.equal(
    getToolHealthStatus(
      {
        credentialMode: "shared",
        credentialEncrypted: "secret",
        credentialLastRotatedAt: new Date("2025-12-01T10:00:00Z"),
        credentialExpiresAt: null,
      },
      new Date("2026-03-30T10:00:00Z"),
    ),
    "attention",
  );
});

test("tool health flags upcoming expiry for attention", () => {
  assert.equal(
    getToolHealthStatus(
      {
        credentialMode: "shared",
        credentialEncrypted: "secret",
        credentialLastRotatedAt: new Date("2026-03-01T10:00:00Z"),
        credentialExpiresAt: new Date("2026-04-10T23:59:59Z"),
      },
      new Date("2026-03-30T10:00:00Z"),
    ),
    "attention",
  );
});

test("tool health flags past expiry as action needed", () => {
  assert.equal(
    getToolHealthStatus(
      {
        credentialMode: "shared",
        credentialEncrypted: "secret",
        credentialLastRotatedAt: new Date("2026-03-01T10:00:00Z"),
        credentialExpiresAt: new Date("2026-03-28T23:59:59Z"),
      },
      new Date("2026-03-30T10:00:00Z"),
    ),
    "action_needed",
  );
});
