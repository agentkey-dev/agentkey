import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCS_GETTING_STARTED_ITEMS,
  DOCS_REFERENCE_CALLOUT,
  DOCS_REFERENCE_ITEMS,
} from "@/lib/dashboard-docs";
import { getOrganizationOnboardingState } from "@/lib/dashboard-onboarding";
import { getSidebarNavigation } from "@/lib/dashboard-navigation";
import { organizations } from "@/lib/db/schema";
import {
  getOrganizationSettingsLinkClassName,
  isOrganizationSettingsPath,
  ORGANIZATION_SETTINGS_HREF,
} from "@/components/dashboard/sidebar-organization-settings-link";
import {
  dismissOrganizationOnboarding,
  getOrganizationDashboardOnboardingState,
} from "@/lib/services/admin";

function createCountDb(counts: number[]) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return Promise.resolve([{ value: counts.shift() ?? 0 }]);
            },
          };
        },
      };
    },
  };
}

function createDismissDb(options?: { dismissedAt?: Date | null }) {
  const dismissedAt = options?.dismissedAt ?? null;

  return {
    update(table: unknown) {
      assert.equal(table, organizations);

      return {
        set(values: { onboardingDismissedAt: Date; updatedAt: Date }) {
          return {
            where() {
              return {
                returning: async () =>
                  dismissedAt
                    ? []
                    : [{ onboardingDismissedAt: values.onboardingDismissedAt }],
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          assert.equal(table, organizations);

          return {
            where() {
              return {
                limit: async () =>
                  dismissedAt ? [{ onboardingDismissedAt: dismissedAt }] : [],
              };
            },
          };
        },
      };
    },
  };
}

// ── Onboarding state derivation ──

test("onboarding state shows checklist when no steps are complete", () => {
  assert.deepEqual(
    getOrganizationOnboardingState({
      totalAgentCount: 0,
      toolCount: 0,
      onboardingDismissedAt: null,
    }),
    {
      agentsDone: false,
      toolsDone: false,
      completedStepCount: 0,
      isComplete: false,
      isDismissed: false,
      showChecklist: true,
      highlightDocsNav: true,
    },
  );
});

test("onboarding state stays active while partially complete", () => {
  const state = getOrganizationOnboardingState({
    totalAgentCount: 1,
    toolCount: 0,
    onboardingDismissedAt: null,
  });

  assert.equal(state.completedStepCount, 1);
  assert.equal(state.showChecklist, true);
  assert.equal(state.highlightDocsNav, true);
});

test("onboarding state hides checklist when all steps are complete", () => {
  const state = getOrganizationOnboardingState({
    totalAgentCount: 1,
    toolCount: 1,
    onboardingDismissedAt: null,
  });

  assert.equal(state.isComplete, true);
  assert.equal(state.showChecklist, false);
  assert.equal(state.highlightDocsNav, false);
});

test("onboarding state hides checklist when dismissed early", () => {
  const state = getOrganizationOnboardingState({
    totalAgentCount: 0,
    toolCount: 0,
    onboardingDismissedAt: new Date("2026-04-04T09:00:00.000Z"),
  });

  assert.equal(state.isDismissed, true);
  assert.equal(state.showChecklist, false);
  assert.equal(state.highlightDocsNav, false);
});

// ── Dashboard onboarding service ──

test("dashboard onboarding service maps queried counts into onboarding state", async () => {
  // getDashboardOverviewSummary runs 6 count queries in order:
  // activeAgents, totalAgents, tools, pendingGrants, pendingSuggestions, approvedGrants
  const state = await getOrganizationDashboardOnboardingState(
    {
      organizationId: "org-1",
      onboardingDismissedAt: null,
    },
    createCountDb([1, 2, 3, 0, 0, 0]) as never,
  );

  assert.equal(state.agentsDone, true);
  assert.equal(state.toolsDone, true);
  assert.equal(state.showChecklist, false);
  assert.equal(state.isComplete, true);
});

// ── Dismiss onboarding ──

test("dismiss onboarding writes the timestamp for active onboarding", async () => {
  const result = await dismissOrganizationOnboarding(
    "org-1",
    createDismissDb() as never,
  );

  assert.ok(result.onboardingDismissedAt instanceof Date);
});

test("dismiss onboarding is idempotent when already dismissed", async () => {
  const dismissedAt = new Date("2026-04-04T10:00:00.000Z");
  const result = await dismissOrganizationOnboarding(
    "org-1",
    createDismissDb({ dismissedAt }) as never,
  );

  assert.equal(
    result.onboardingDismissedAt?.toISOString(),
    dismissedAt.toISOString(),
  );
});

// ── Sidebar navigation ──

test("docs navigation uses Docs label and highlights it only during onboarding", () => {
  const idleDocsItem = getSidebarNavigation({ highlightDocsNav: false }).find(
    (item) => item.href === "/dashboard/docs",
  );
  const highlightedDocsItem = getSidebarNavigation({
    highlightDocsNav: true,
  }).find((item) => item.href === "/dashboard/docs");

  assert.equal(idleDocsItem?.label, "Docs");
  assert.equal(idleDocsItem?.showIndicator, false);
  assert.equal(highlightedDocsItem?.label, "Docs");
  assert.equal(highlightedDocsItem?.showIndicator, true);
});

test("sidebar navigation no longer includes organization", () => {
  assert.equal(
    getSidebarNavigation().some(
      (item) => item.href === ORGANIZATION_SETTINGS_HREF,
    ),
    false,
  );
});

// ── Organization settings ──

test("organization settings path detection covers nested routes", () => {
  assert.equal(ORGANIZATION_SETTINGS_HREF, "/dashboard/organization");
  assert.equal(isOrganizationSettingsPath("/dashboard/organization"), true);
  assert.equal(
    isOrganizationSettingsPath("/dashboard/organization/members"),
    true,
  );
  assert.equal(isOrganizationSettingsPath("/dashboard/tools"), false);
});

test("organization settings link styling reflects active state", () => {
  const idleClassName = getOrganizationSettingsLinkClassName(false);
  const activeClassName = getOrganizationSettingsLinkClassName(true);

  assert.match(idleClassName, /text-on-surface-variant/);
  assert.match(idleClassName, /hover:text-on-surface/);
  assert.match(activeClassName, /text-primary/);
  assert.match(activeClassName, /bg-primary\/10/);
});

// ── Docs TOC structure ──

test("docs TOC groups use agent-first order and exclude setup guide item", () => {
  assert.equal(
    DOCS_GETTING_STARTED_ITEMS.some((item) => item.label === "Setup guide"),
    false,
  );
  assert.deepEqual(
    DOCS_GETTING_STARTED_ITEMS.map((item) => item.label),
    [
      "1. Create an agent",
      "2. Configure the agent",
      "3. Add tools to the catalog",
      "4. Agent requests access",
      "5. Approve or deny",
      "6. Agent fetches credentials",
    ],
  );
  assert.deepEqual(
    DOCS_REFERENCE_ITEMS.map((item) => item.label),
    [
      "Access management",
      "Writing usage guides",
      "Tool suggestions",
      "Instruction suggestions",
      "Webhook notifications",
      "Schema discovery",
      "Rate limits",
      "Export & import",
      "AI-assisted setup",
      "API reference",
      "Troubleshooting",
      "Key concepts",
    ],
  );
  assert.equal(
    DOCS_REFERENCE_CALLOUT,
    "You're all set! The sections below cover advanced features and API details.",
  );
});
