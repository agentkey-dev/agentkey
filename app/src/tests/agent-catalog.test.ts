import assert from "node:assert/strict";
import test from "node:test";

import {
  denyAgentPendingToolInCatalog,
  filterAgentCatalog,
  grantAgentToolInCatalog,
  revokeAgentToolInCatalog,
  rotateAgentCatalogKey,
  suspendAgentInCatalog,
  type AgentCatalogFilters,
  type AgentCatalogItem,
} from "@/lib/agent-catalog";

const AGENTS: AgentCatalogItem[] = [
  {
    id: "agent-1",
    organizationId: "org-1",
    name: "Bug Bot",
    description: "Tracks bugs",
    apiKeyHash: "hash-1",
    createdByUserId: "user-1",
    createdByEmail: "admin@example.com",
    status: "active",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    lastActiveAt: "2026-04-03T12:00:00.000Z",
    toolsGranted: ["Linear", "GitHub"],
    toolsPending: ["Notion"],
    grantedTools: [
      { toolId: "tool-1", toolName: "Linear" },
      { toolId: "tool-2", toolName: "GitHub" },
    ],
    pendingTools: [
      {
        requestId: "grant-1",
        toolId: "tool-3",
        toolName: "Notion",
        toolCredentialMode: "per_agent",
      },
    ],
  },
  {
    id: "agent-2",
    organizationId: "org-1",
    name: "Deploy Runner",
    description: "Handles deploys",
    apiKeyHash: "hash-2",
    createdByUserId: "user-1",
    createdByEmail: "admin@example.com",
    status: "suspended",
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-04-02T10:00:00.000Z",
    lastActiveAt: null,
    toolsGranted: [],
    toolsPending: [],
    grantedTools: [],
    pendingTools: [],
  },
];

function apply(filters: Partial<AgentCatalogFilters>) {
  return filterAgentCatalog(AGENTS, {
    query: "",
    status: "all",
    ...filters,
  }).map((agent) => agent.id);
}

test("agent catalog filtering matches by agent name case-insensitively", () => {
  assert.deepEqual(apply({ query: "bug" }), ["agent-1"]);
  assert.deepEqual(apply({ query: "DEPLOY" }), ["agent-2"]);
});

test("agent catalog filtering applies status filters", () => {
  assert.deepEqual(apply({ status: "active" }), ["agent-1"]);
  assert.deepEqual(apply({ status: "suspended" }), ["agent-2"]);
});

test("agent catalog filtering combines text and status filters", () => {
  assert.deepEqual(
    apply({
      query: "deploy",
      status: "suspended",
    }),
    ["agent-2"],
  );
});

test("rotateAgentCatalogKey updates updatedAt in local state", () => {
  const updated = rotateAgentCatalogKey(
    AGENTS,
    "agent-1",
    "2026-04-05T10:00:00.000Z",
  );

  assert.equal(updated[0]?.updatedAt, "2026-04-05T10:00:00.000Z");
  assert.equal(updated[1]?.updatedAt, AGENTS[1]?.updatedAt);
});

test("suspendAgentInCatalog updates status and clears access lists", () => {
  const updated = suspendAgentInCatalog(
    AGENTS,
    "agent-1",
    "2026-04-06T10:00:00.000Z",
  );

  assert.deepEqual(updated[0], {
    ...AGENTS[0],
    status: "suspended",
    updatedAt: "2026-04-06T10:00:00.000Z",
    toolsGranted: [],
    toolsPending: [],
    grantedTools: [],
    pendingTools: [],
  });
});

test("revokeAgentToolInCatalog removes only the revoked granted tool", () => {
  const updated = revokeAgentToolInCatalog(AGENTS, "agent-1", "tool-1");

  assert.deepEqual(updated[0]?.toolsGranted, ["GitHub"]);
  assert.deepEqual(updated[0]?.grantedTools, [
    { toolId: "tool-2", toolName: "GitHub" },
  ]);
  assert.deepEqual(updated[0]?.pendingTools, AGENTS[0]?.pendingTools);
});

test("grantAgentToolInCatalog adds a granted tool and removes matching pending access", () => {
  const updated = grantAgentToolInCatalog(AGENTS, "agent-1", {
    toolId: "tool-3",
    toolName: "Notion",
  });

  assert.deepEqual(updated[0]?.toolsGranted, ["Linear", "GitHub", "Notion"]);
  assert.deepEqual(updated[0]?.toolsPending, []);
  assert.deepEqual(updated[0]?.grantedTools, [
    { toolId: "tool-1", toolName: "Linear" },
    { toolId: "tool-2", toolName: "GitHub" },
    { toolId: "tool-3", toolName: "Notion" },
  ]);
  assert.deepEqual(updated[0]?.pendingTools, []);
});

test("denyAgentPendingToolInCatalog removes only the matching pending tool", () => {
  const updated = denyAgentPendingToolInCatalog(AGENTS, "agent-1", "tool-3");

  assert.deepEqual(updated[0]?.toolsPending, []);
  assert.deepEqual(updated[0]?.pendingTools, []);
  assert.deepEqual(updated[0]?.grantedTools, AGENTS[0]?.grantedTools);
});
