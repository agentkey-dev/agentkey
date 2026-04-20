import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_TOOL_SETUP_FORM,
  canContinueFromGuideStep,
  getSuggestionAgentContext,
  normalizeGuideMarkdown,
  withCredentialMode,
} from "@/lib/tool-setup";

test("guide step requires a credential for shared tools", () => {
  assert.equal(canContinueFromGuideStep(EMPTY_TOOL_SETUP_FORM), false);
  assert.equal(
    canContinueFromGuideStep({
      ...EMPTY_TOOL_SETUP_FORM,
      credential: "lin_api_key_123",
    }),
    true,
  );
});

test("switching to per-agent clears the shared credential", () => {
  const updated = withCredentialMode(
    {
      ...EMPTY_TOOL_SETUP_FORM,
      credential: "secret-token",
    },
    "per_agent",
  );

  assert.equal(updated.credentialMode, "per_agent");
  assert.equal(updated.credential, "");
  assert.equal(canContinueFromGuideStep(updated), true);
});

test("suggestion supporter reasons become deduplicated agent context", () => {
  assert.deepEqual(
    getSuggestionAgentContext({
      id: "suggestion-1",
      name: "Linear",
      url: "https://linear.app",
      supporterCount: 3,
      firstRequestedAt: new Date("2026-03-29T10:00:00Z"),
      lastRequestedAt: new Date("2026-03-29T11:00:00Z"),
      supporters: [
        {
          agentId: "agent-1",
          agentName: "Bug Bot",
          latestReason: "Create and update issues",
          firstRequestedAt: new Date("2026-03-29T10:00:00Z"),
          lastRequestedAt: new Date("2026-03-29T10:30:00Z"),
        },
        {
          agentId: "agent-2",
          agentName: "Planning Bot",
          latestReason: "Read project boards",
          firstRequestedAt: new Date("2026-03-29T10:15:00Z"),
          lastRequestedAt: new Date("2026-03-29T11:00:00Z"),
        },
        {
          agentId: "agent-3",
          agentName: "Another Bot",
          latestReason: "Create and update issues",
          firstRequestedAt: new Date("2026-03-29T10:20:00Z"),
          lastRequestedAt: new Date("2026-03-29T10:50:00Z"),
        },
      ],
    }),
    ["Create and update issues", "Read project boards"],
  );
});

test("guide markdown normalization unwraps a fenced markdown response", () => {
  assert.equal(
    normalizeGuideMarkdown("```markdown\n# Setup\n\n1. Open settings\n```"),
    "# Setup\n\n1. Open settings",
  );
  assert.equal(normalizeGuideMarkdown("# Setup\n\n1. Open settings"), "# Setup\n\n1. Open settings");
});
