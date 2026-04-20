import assert from "node:assert/strict";
import test from "node:test";

import {
  filterToolCatalog,
  type ToolCatalogFilters,
  type ToolCatalogItem,
} from "@/lib/tool-catalog";

const TOOLS: ToolCatalogItem[] = [
  {
    id: "tool-1",
    configKey: "linear",
    name: "Linear",
    description: "",
    url: "https://linear.app",
    authType: "api_key",
    credentialMode: "shared",
    instructions: null,
    credentialLastRotatedAt: null,
    credentialExpiresAt: null,
    healthStatus: "healthy",
    approvedAgents: 2,
    pendingAgents: 1,
    approvedAgentList: [],
    pendingAgentList: [],
  },
  {
    id: "tool-2",
    configKey: "github-enterprise",
    name: "GitHub Enterprise",
    description: "",
    url: "https://github.example.com",
    authType: "oauth_token",
    credentialMode: "per_agent",
    instructions: null,
    credentialLastRotatedAt: null,
    credentialExpiresAt: null,
    healthStatus: "healthy",
    approvedAgents: 1,
    pendingAgents: 0,
    approvedAgentList: [],
    pendingAgentList: [],
  },
  {
    id: "tool-3",
    configKey: "slack",
    name: "Slack",
    description: "",
    url: "https://slack.com",
    authType: "bot_token",
    credentialMode: "shared",
    instructions: null,
    credentialLastRotatedAt: null,
    credentialExpiresAt: null,
    healthStatus: "healthy",
    approvedAgents: 3,
    pendingAgents: 2,
    approvedAgentList: [],
    pendingAgentList: [],
  },
];

function apply(filters: Partial<ToolCatalogFilters>) {
  return filterToolCatalog(TOOLS, {
    query: "",
    authType: "all",
    credentialMode: "all",
    ...filters,
  }).map((tool) => tool.id);
}

test("tool catalog filtering matches by tool name", () => {
  assert.deepEqual(apply({ query: "linear" }), ["tool-1"]);
});

test("tool catalog filtering matches by config key", () => {
  assert.deepEqual(apply({ query: "github-enterprise" }), ["tool-2"]);
});

test("tool catalog filtering matches by url", () => {
  assert.deepEqual(apply({ query: "slack.com" }), ["tool-3"]);
});

test("tool catalog filtering applies auth type filter", () => {
  assert.deepEqual(apply({ authType: "bot_token" }), ["tool-3"]);
});

test("tool catalog filtering applies credential mode filter", () => {
  assert.deepEqual(apply({ credentialMode: "per_agent" }), ["tool-2"]);
});

test("tool catalog filtering combines text and dropdown filters", () => {
  assert.deepEqual(
    apply({
      query: "git",
      authType: "oauth_token",
      credentialMode: "per_agent",
    }),
    ["tool-2"],
  );
});
