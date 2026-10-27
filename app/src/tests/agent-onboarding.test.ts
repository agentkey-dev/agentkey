import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgentEnvBlock,
  getAgentSystemPromptBlock,
  getClaudeMdBlock,
} from "@/lib/agent-onboarding";
import { getAppOrigin } from "@/lib/origin";

function withEnvironment(values: Record<string, string | undefined>, callback: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        Reflect.set(process.env, key, value);
      }
    }
  };
  apply(values);
  try {
    callback();
  } finally {
    apply(previous);
  }
}

test("agent onboarding env block only includes the API key", () => {
  assert.equal(
    getAgentEnvBlock("sk_agent_123"),
    "AGENTKEY_API_KEY=sk_agent_123",
  );
});

test("agent system prompt inlines the concrete endpoint", () => {
  const prompt = getAgentSystemPromptBlock("https://agentkey.example.com/");

  assert.match(prompt, /\*\*API endpoint:\*\* https:\/\/agentkey\.example\.com/);
  assert.doesNotMatch(prompt, /\$\{AGENTKEY_URL\}/);
  assert.match(prompt, /AGENTKEY_API_KEY/);
  assert.match(prompt, /GET \/api\/tools\/\{tool_id\}\/request/);
  assert.match(prompt, /GET \/api\/tools\/suggest/);
  assert.match(prompt, /Shared tools return the shared credential/);
  assert.match(prompt, /Per-agent tools may require the admin/);
});

test("claude snippet uses the normalized endpoint", () => {
  const snippet = getClaudeMdBlock("https://agentkey.example.com/");

  assert.match(snippet, /https:\/\/agentkey\.example\.com\/api\/tools/);
  assert.doesNotMatch(snippet, /https:\/\/agentkey\.example\.com\/\/api\/tools/);
  assert.match(snippet, /Discover the request schema first if needed/);
  assert.match(snippet, /Discover the suggestion schema first if needed/);
});

test("getAppOrigin uses APP_URL when configured", () => {
  withEnvironment({ APP_URL: "https://agentkey.example.com/", NODE_ENV: "production" }, () => {
    assert.equal(getAppOrigin(), "https://agentkey.example.com");
  });
});

test("getAppOrigin rejects missing APP_URL in production", () => {
  withEnvironment({ APP_URL: undefined, NODE_ENV: "production" }, () => {
    assert.throws(() => getAppOrigin(), /APP_URL environment variable is required/);
  });
});

test("getAppOrigin falls back to localhost in development", () => {
  withEnvironment({ APP_URL: undefined, NODE_ENV: "development" }, () => {
    assert.equal(getAppOrigin(), "http://localhost:3000");
  });
});
