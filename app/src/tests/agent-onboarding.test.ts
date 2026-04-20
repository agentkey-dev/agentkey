import assert from "node:assert/strict";
import test from "node:test";

import {
  getAgentEnvBlock,
  getAgentSystemPromptBlock,
  getClaudeMdBlock,
} from "@/lib/agent-onboarding";
import { getAppOrigin } from "@/lib/origin";

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
  const previousAppUrl = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  process.env.APP_URL = "https://agentkey.example.com/";
  process.env.NODE_ENV = "production";

  try {
    assert.equal(getAppOrigin(), "https://agentkey.example.com");
  } finally {
    process.env.APP_URL = previousAppUrl;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("getAppOrigin rejects missing APP_URL in production", () => {
  const previousAppUrl = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  delete process.env.APP_URL;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => getAppOrigin(), /APP_URL environment variable is required/);
  } finally {
    process.env.APP_URL = previousAppUrl;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("getAppOrigin falls back to localhost in development", () => {
  const previousAppUrl = process.env.APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  delete process.env.APP_URL;
  process.env.NODE_ENV = "development";

  try {
    assert.equal(getAppOrigin(), "http://localhost:3000");
  } finally {
    process.env.APP_URL = previousAppUrl;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
