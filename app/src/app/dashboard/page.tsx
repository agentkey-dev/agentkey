import { Suspense } from "react";

import {
  DashboardOnboardingChecklist,
  OnboardingCodeBlock,
  type OnboardingStepConfig,
} from "@/components/dashboard/dashboard-onboarding-checklist";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { requireDashboardContext } from "@/lib/auth/admin";
import { getAgentEnvBlock } from "@/lib/agent-onboarding";
import { getActionLabel } from "@/lib/audit-labels";
import { getAppOrigin } from "@/lib/origin";
import {
  getDashboardSummary,
  listPendingRequests,
  listRecentAuditForDashboard,
} from "@/lib/services/admin";

function buildOnboardingSteps(
  onboarding: {
    agentsDone: boolean;
    toolsDone: boolean;
  },
  baseUrl: string,
): OnboardingStepConfig[] {
  return [
    {
      key: "create-agent",
      label: "Create and configure your first agent",
      complete: onboarding.agentsDone,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            An agent in AgentKey represents your AI agent&apos;s identity — its
            API key and the tools it can access. Go to the Agents page, create a
            new agent, and you&apos;ll receive an API key (shown once),
            environment variables, and a system prompt snippet.
          </p>
          <p className="text-sm text-on-surface-variant">
            Then add the API key and system prompt to your agent&apos;s runtime.
            Your agent handles all AgentKey API calls automatically using this
            prompt.
          </p>
          <OnboardingCodeBlock>
            {`# Add to your agent's .env or secrets manager\n${getAgentEnvBlock("sk_agent_••••••••")}\nAGENTKEY_BASE_URL=${baseUrl}`}
          </OnboardingCodeBlock>
          <a
            href="/dashboard/agents"
            className="inline-block border border-primary/30 bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            Go to Agents
          </a>
        </div>
      ),
      doneContent: (
        <p className="text-sm text-on-surface-variant">
          Done. Your workspace has at least one agent. Make sure to add the API
          key and system prompt to your agent&apos;s runtime.
        </p>
      ),
    },
    {
      key: "add-tool",
      label: "Add your first tool",
      complete: onboarding.toolsDone,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            Add the SaaS tools your agent needs access to — GitHub, Linear,
            Notion, Slack, or any service with an API. Your agent can also
            suggest missing tools from the API once it&apos;s running, so you
            don&apos;t need to add everything upfront.
          </p>
          <a
            href="/dashboard/tools"
            className="inline-block border border-primary/30 bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            Go to Tools
          </a>
        </div>
      ),
      doneContent: (
        <p className="text-sm text-on-surface-variant">
          Done. Your catalog has at least one tool.
        </p>
      ),
    },
  ];
}

export default async function DashboardPage() {
  const context = await requireDashboardContext();
  const summary = await getDashboardSummary(
    context.organization.id,
    context.organization.onboardingDismissedAt,
  );
  const baseUrl = getAppOrigin();
  const showChecklist = summary.onboarding.showChecklist;

  if (showChecklist) {
    return (
      <div className="space-y-10">
        <section className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary">
            You&apos;re in
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">
            Two steps. About 60 seconds.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-on-surface-variant">
            Create your first agent, add one tool, and you&apos;ll have a
            governed credential flow your agents can call end-to-end.
          </p>
        </section>

        <DashboardOnboardingChecklist
          steps={buildOnboardingSteps(summary.onboarding, baseUrl)}
          allComplete={summary.onboarding.isComplete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
            Overview
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            {context.organization.name}
          </h1>
        </div>
      </section>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsSection
          organizationId={context.organization.id}
          onboardingDismissedAt={context.organization.onboardingDismissedAt}
        />
      </Suspense>

      <section className="grid gap-6 xl:grid-cols-2">
        <Suspense fallback={<PanelSkeleton title="Pending requests" />}>
          <PendingRequestsPanel organizationId={context.organization.id} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Recent audit activity" />}>
          <RecentAuditPanel organizationId={context.organization.id} />
        </Suspense>
      </section>
    </div>
  );
}

async function MetricsSection({
  organizationId,
  onboardingDismissedAt,
}: {
  organizationId: string;
  onboardingDismissedAt: Date | null;
}) {
  const { counts } = await getDashboardSummary(
    organizationId,
    onboardingDismissedAt,
  );

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Agents"
        value={counts.agents}
        detail="Active agent identities"
      />
      <MetricCard
        label="Tools"
        value={counts.tools}
        detail="Catalog entries available to request"
      />
      <MetricCard
        label="Pending"
        value={counts.pendingRequests}
        detail="Requests waiting for human review"
      />
      <MetricCard
        label="Granted"
        value={counts.grantedAccess}
        detail="Approved access relationships"
      />
    </section>
  );
}

async function PendingRequestsPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const requests = (await listPendingRequests(organizationId)).slice(0, 5);

  return (
    <Panel title="Pending requests">
      {requests.length === 0 ? (
        <p className="px-6 py-8 text-sm text-on-surface-variant">
          No pending requests right now.
        </p>
      ) : (
        requests.map((request) => (
          <div
            key={request.id}
            className="space-y-2 px-6 py-5 text-sm text-on-surface-variant"
          >
            {request.kind === "access_request" ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-on-surface">
                    {request.agentName}
                  </span>
                  <StatusBadge tone="warning">{request.toolName}</StatusBadge>
                </div>
                <p>{request.reason}</p>
              </>
            ) : request.kind === "tool_suggestion" ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-on-surface">
                    {request.name}
                  </span>
                  <StatusBadge tone="warning">tool suggestion</StatusBadge>
                </div>
                <p>
                  {request.supporters[0]?.latestReason ??
                    "No reason provided."}
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-on-surface">
                    {request.toolName}
                  </span>
                  <StatusBadge tone="warning">
                    instruction suggestion
                  </StatusBadge>
                </div>
                <p>
                  {request.supporters[0]?.latestWhy ?? "No reason provided."}
                </p>
              </>
            )}
          </div>
        ))
      )}
    </Panel>
  );
}

async function RecentAuditPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const events = await listRecentAuditForDashboard(organizationId);

  return (
    <Panel title="Recent audit activity">
      {events.length === 0 ? (
        <p className="px-6 py-8 text-sm text-on-surface-variant">
          Audit activity will appear here as agents and admins act.
        </p>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className="space-y-1 px-6 py-5 text-sm text-on-surface-variant"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-on-surface">
                {getActionLabel(event.action)}
              </span>
              <StatusBadge>{event.actorType}</StatusBadge>
            </div>
            <p>{event.actorLabel}</p>
            <p>{new Date(event.createdAt).toLocaleString()}</p>
          </div>
        ))
      )}
    </Panel>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-surface-container">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="border border-white/10 bg-surface-container p-6">
          <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
          <div className="mt-4 h-8 w-16 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </section>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <Panel title={title}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 px-6 py-5" aria-busy="true">
          <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-full max-w-xs animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </Panel>
  );
}
