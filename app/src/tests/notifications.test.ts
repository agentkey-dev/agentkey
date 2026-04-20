import assert from "node:assert/strict";
import test from "node:test";

import {
  applyNotificationSettingsInput,
  dispatchAccessRequestNotifications,
  dispatchToolSuggestionNotifications,
  formatAccessRequestNotification,
  formatToolSuggestionNotification,
  validateDiscordWebhook,
  validateSlackWebhook,
} from "@/lib/core/notifications";

test("valid Slack and Discord webhooks are accepted", () => {
  assert.doesNotThrow(() =>
    validateSlackWebhook("https://hooks.slack.com/services/T1/B1/secret"),
  );
  assert.doesNotThrow(() =>
    validateDiscordWebhook("https://discord.com/api/webhooks/123/secret"),
  );
});

test("invalid webhook hosts are rejected", () => {
  assert.throws(
    () => validateSlackWebhook("https://example.com/services/T1/B1/secret"),
    /Slack webhook/,
  );
  assert.throws(
    () => validateDiscordWebhook("https://example.com/api/webhooks/123/secret"),
    /Discord webhook/,
  );
});

test("notification settings preserve existing destinations unless replaced or cleared", () => {
  assert.deepEqual(
    applyNotificationSettingsInput(
      {},
    ),
    {
      slackWebhook: undefined,
      discordWebhook: undefined,
      clearSlack: false,
      clearDiscord: false,
    },
  );

  assert.deepEqual(
    applyNotificationSettingsInput(
      {
        clearSlack: true,
        discordWebhook: "https://discord.com/api/webhooks/123/secret",
      },
    ),
    {
      slackWebhook: undefined,
      discordWebhook: "https://discord.com/api/webhooks/123/secret",
      clearSlack: true,
      clearDiscord: false,
    },
  );
});

test("notification message includes the dashboard review link", () => {
  const message = formatAccessRequestNotification({
    organizationName: "Acme",
    agentName: "BugBot",
    toolName: "Linear",
    reason: "Need to triage issues",
    requestedAt: new Date("2026-03-28T10:00:00.000Z"),
    requestsUrl: "https://agentkey.example.com/dashboard/requests",
  });

  assert.match(message, /Acme/);
  assert.match(message, /BugBot/);
  assert.match(message, /Linear/);
  assert.match(message, /https:\/\/agentkey\.example\.com\/dashboard\/requests/);
});

test("tool suggestion notification includes the suggested url", () => {
  const message = formatToolSuggestionNotification({
    organizationName: "Acme",
    agentName: "BugBot",
    toolName: "Linear",
    toolUrl: "https://linear.app",
    reason: "Need issue tracking",
    requestedAt: new Date("2026-03-28T10:00:00.000Z"),
    requestsUrl: "https://agentkey.example.com/dashboard/requests",
  });

  assert.match(message, /New AgentKey tool suggestion/);
  assert.match(message, /https:\/\/linear\.app/);
});

test("notification dispatch is best-effort across providers", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      body: String(init?.body ?? ""),
    });

    if (url.includes("slack")) {
      return new Response("ok", { status: 200 });
    }

    return new Response("bad webhook", { status: 500 });
  };

  const results = await dispatchAccessRequestNotifications(
    {
      slackWebhook: "https://hooks.slack.com/services/T1/B1/secret",
      discordWebhook: "https://discord.com/api/webhooks/123/secret",
    },
    {
      organizationId: "org_123",
      organizationName: "Acme",
      agentId: "agent_123",
      agentName: "BugBot",
      toolId: "tool_123",
      toolName: "Linear",
      reason: "Need to triage issues",
      requestId: "req_123",
      requestedAt: new Date("2026-03-28T10:00:00.000Z"),
      requestsUrl: "https://agentkey.example.com/dashboard/requests",
    },
    fetchImpl,
  );

  assert.equal(calls.length, 2);
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => [result.provider, result.status]),
    [
      ["slack", "success"],
      ["discord", "failed"],
    ],
  );
  assert.match(calls[0].body, /dashboard\/requests/);
  assert.match(calls[1].body, /dashboard\/requests/);
});

test("tool suggestion notification dispatch is best-effort across providers", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      body: String(init?.body ?? ""),
    });

    if (url.includes("discord")) {
      return new Response("ok", { status: 200 });
    }

    return new Response("bad webhook", { status: 500 });
  };

  const results = await dispatchToolSuggestionNotifications(
    {
      slackWebhook: "https://hooks.slack.com/services/T1/B1/secret",
      discordWebhook: "https://discord.com/api/webhooks/123/secret",
    },
    {
      organizationId: "org_123",
      organizationName: "Acme",
      agentId: "agent_123",
      agentName: "BugBot",
      toolId: "suggestion_123",
      toolName: "Linear",
      toolUrl: "https://linear.app",
      reason: "Need issue tracking",
      requestId: "suggestion_123",
      requestedAt: new Date("2026-03-28T10:00:00.000Z"),
      requestsUrl: "https://agentkey.example.com/dashboard/requests",
    },
    fetchImpl,
  );

  assert.equal(calls.length, 2);
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((result) => [result.provider, result.status]),
    [
      ["slack", "failed"],
      ["discord", "success"],
    ],
  );
  assert.match(calls[0].body, /New AgentKey tool suggestion/);
  assert.match(calls[1].body, /https:\/\/linear\.app/);
});
