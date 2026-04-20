import assert from "node:assert/strict";
import test from "node:test";

import {
  getToolSuggestionCooldownUntil,
  getToolSuggestionIdentity,
  getToolSuggestionLockKeyParts,
  getToolSuggestionLockTokens,
  normalizeToolSuggestionName,
  toolMatchesSuggestionIdentity,
  toolSuggestionsMatch,
} from "@/lib/core/tool-suggestions";
import {
  createPendingToolSuggestionSummary,
  sortPendingToolSuggestions,
} from "@/lib/services/tool-suggestions";

test("tool suggestion names are normalized for dedupe", () => {
  assert.equal(
    normalizeToolSuggestionName("  Linear, Inc.  "),
    "linear inc",
  );
  assert.equal(
    normalizeToolSuggestionName("GitHub"),
    "github",
  );
});

test("tool suggestion identity prefers normalized domain when url exists", () => {
  const suggestion = getToolSuggestionIdentity({
    name: "Linear",
    url: "linear.app",
  });

  assert.equal(suggestion.normalizedUrl, "https://linear.app/");
  assert.equal(suggestion.normalizedDomain, "linear.app");
  assert.equal(suggestion.normalizedName, "linear");
});

test("tool suggestion lock tokens overlap for name-only and domain-backed variants", () => {
  const byName = getToolSuggestionIdentity({
    name: "Linear",
  });
  const byDomain = getToolSuggestionIdentity({
    name: "Linear App",
    url: "https://linear.app",
  });

  const nameTokens = getToolSuggestionLockTokens("org-1", byName);
  const domainTokens = getToolSuggestionLockTokens("org-1", byDomain);

  assert.equal(
    nameTokens.some((token) => domainTokens.includes(token)),
    true,
  );
});

test("tool suggestion advisory lock keys are deterministic", () => {
  const [firstLeft, firstRight] = getToolSuggestionLockKeyParts(
    "name:org-1:linear",
  );
  const [secondLeft, secondRight] = getToolSuggestionLockKeyParts(
    "name:org-1:linear",
  );

  assert.equal(firstLeft, secondLeft);
  assert.equal(firstRight, secondRight);
});

test("tool suggestions match by domain before name", () => {
  assert.equal(
    toolSuggestionsMatch(
      {
        normalizedName: "linear",
        normalizedDomain: "linear.app",
      },
      {
        normalizedName: "linear issue tracker",
        normalizedDomain: "linear.app",
      },
    ),
    true,
  );

  assert.equal(
    toolSuggestionsMatch(
      {
        normalizedName: "linear",
        normalizedDomain: null,
      },
      {
        normalizedName: "linear",
        normalizedDomain: null,
      },
    ),
    true,
  );
});

test("tools can be matched against suggestion identity", () => {
  const identity = getToolSuggestionIdentity({
    name: "Linear",
    url: "https://linear.app",
  });

  assert.equal(
    toolMatchesSuggestionIdentity(
      {
        name: "Linear GraphQL",
        url: "https://linear.app",
      },
      identity,
    ),
    true,
  );

  assert.equal(
    toolMatchesSuggestionIdentity(
      {
        name: "Linear",
        url: undefined,
      },
      {
        normalizedName: "linear",
        normalizedDomain: null,
      },
    ),
    true,
  );
});

test("tool suggestion cooldown defaults to 24 hours", () => {
  const start = new Date("2026-03-29T09:00:00.000Z");
  const until = getToolSuggestionCooldownUntil(start);

  assert.equal(until.toISOString(), "2026-03-30T09:00:00.000Z");
});

test("pending suggestion summaries derive first and last request times from supporters", () => {
  const summary = createPendingToolSuggestionSummary({
    id: "suggestion-1",
    name: "Linear",
    url: "https://linear.app",
    createdAt: new Date("2026-03-28T09:00:00.000Z"),
    updatedAt: new Date("2026-03-29T09:00:00.000Z"),
    supporters: [
      {
        agentId: "agent-1",
        agentName: "Bug Bot",
        latestReason: "Track incidents in engineering.",
        firstRequestedAt: new Date("2026-03-29T10:00:00.000Z"),
        lastRequestedAt: new Date("2026-03-29T11:00:00.000Z"),
      },
      {
        agentId: "agent-2",
        agentName: "Deploy Bot",
        latestReason: "Link deploys to issues.",
        firstRequestedAt: new Date("2026-03-28T12:00:00.000Z"),
        lastRequestedAt: new Date("2026-03-29T12:30:00.000Z"),
      },
    ],
  });

  assert.equal(summary.supporterCount, 2);
  assert.equal(summary.firstRequestedAt.toISOString(), "2026-03-28T12:00:00.000Z");
  assert.equal(summary.lastRequestedAt.toISOString(), "2026-03-29T12:30:00.000Z");
  assert.equal(summary.requestedAt.toISOString(), "2026-03-29T12:30:00.000Z");
});

test("pending suggestions sort by supporter count then latest request time", () => {
  const ordered = sortPendingToolSuggestions([
    {
      supporterCount: 1,
      lastRequestedAt: "2026-03-29T12:00:00.000Z",
      name: "Gamma",
    },
    {
      supporterCount: 3,
      lastRequestedAt: "2026-03-29T11:00:00.000Z",
      name: "Beta",
    },
    {
      supporterCount: 3,
      lastRequestedAt: "2026-03-29T13:00:00.000Z",
      name: "Alpha",
    },
  ]);

  assert.deepEqual(
    ordered.map((item) => item.name),
    ["Alpha", "Beta", "Gamma"],
  );
});
