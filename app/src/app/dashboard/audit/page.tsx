import { Suspense } from "react";

import { requireDashboardContext } from "@/lib/auth/admin";
import { getActionLabel, getActionOptions } from "@/lib/audit-labels";
import { listAgents, listAuditEvents, listTools } from "@/lib/services/admin";
import { StatusBadge } from "@/components/dashboard/status-badge";

function getMetadataContext(event: {
  action: string;
  metadata: Record<string, unknown> | null;
  actorLabel: string | null;
  actorType: string;
}): string | null {
  const m = event.metadata;
  if (!m) return null;

  const toolName = typeof m.toolName === "string" ? m.toolName : null;
  const name = typeof m.name === "string" ? m.name : null;

  switch (event.action) {
    case "agent.created":
      return name ? `Created agent "${name}"` : null;
    case "agent.suspended":
      return name ? `Suspended "${name}"` : null;
    case "agent.key_rotated":
      return name ? `Rotated key for "${name}"` : null;
    case "tool.created":
      return name ? `Added "${name}" to catalog` : null;
    case "tool.deleted":
      return name ? `Removed "${name}" from catalog` : null;
    case "tool.updated":
      return name ? `Updated "${name}"` : null;
    case "grant.requested":
    case "grant.requested_from_suggestion":
    case "grant.approved":
    case "grant.denied":
    case "grant.revoked":
    case "credential.vended":
      return toolName ? `Tool: ${toolName}` : null;
    case "tool_suggestion.created":
    case "tool_suggestion.supported":
    case "tool_suggestion.dismissed":
    case "tool_suggestion.accepted":
    case "tool_suggestion.auto_resolved":
      return toolName ?? name ? `Tool: ${toolName ?? name}` : null;
    default:
      return null;
  }
}

type AuditFilters = {
  action?: string;
  agent_id?: string;
  tool_id?: string;
  from?: string;
  to?: string;
};

function pickFilters(
  params: Record<string, string | string[] | undefined>,
): AuditFilters {
  const pick = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  return {
    action: pick("action"),
    agent_id: pick("agent_id"),
    tool_id: pick("tool_id"),
    from: pick("from"),
    to: pick("to"),
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const filters = pickFilters(params);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-primary">
          Audit log
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-on-surface">
          Every action, every actor, every timestamp.
        </h1>
      </div>

      <Suspense fallback={<FilterFormSkeleton />}>
        <FilterForm
          organizationId={context.organization.id}
          filters={filters}
        />
      </Suspense>

      <Suspense fallback={<EventListSkeleton />}>
        <EventList
          organizationId={context.organization.id}
          filters={filters}
        />
      </Suspense>
    </div>
  );
}

async function FilterForm({
  organizationId,
  filters,
}: {
  organizationId: string;
  filters: AuditFilters;
}) {
  const [agents, tools] = await Promise.all([
    listAgents(organizationId),
    listTools(organizationId),
  ]);
  const actionOptions = getActionOptions();

  return (
    <form className="space-y-4 border border-white/10 bg-surface-container p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          Action
          <select
            name="action"
            defaultValue={filters.action ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          >
            <option value="">All actions</option>
            {actionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          Agent
          <select
            name="agent_id"
            defaultValue={filters.agent_id ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          Tool
          <select
            name="tool_id"
            defaultValue={filters.tool_id ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          >
            <option value="">All tools</option>
            {tools.map((tool) => (
              <option key={tool.id} value={tool.id}>
                {tool.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          From
          <input
            type="datetime-local"
            name="from"
            defaultValue={filters.from ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-on-surface-variant">
          To
          <input
            type="datetime-local"
            name="to"
            defaultValue={filters.to ?? ""}
            className="border border-white/10 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
        </label>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="flex-1 bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            Filter
          </button>
          <a
            href="/dashboard/audit"
            className="inline-flex items-center justify-center border border-white/10 px-4 py-2 text-sm text-on-surface transition-colors hover:border-primary/40"
          >
            Clear
          </a>
        </div>
      </div>
    </form>
  );
}

async function EventList({
  organizationId,
  filters,
}: {
  organizationId: string;
  filters: AuditFilters;
}) {
  const events = await listAuditEvents(organizationId, {
    action: filters.action,
    agentId: filters.agent_id,
    toolId: filters.tool_id,
    from: filters.from,
    to: filters.to,
  });

  return (
    <section className="border border-white/10 bg-surface-container">
      <div className="divide-y divide-white/5">
        {events.length === 0 ? (
          <p className="px-6 py-8 text-sm text-on-surface-variant">
            No events match the current filters.
          </p>
        ) : (
          events.map((event) => {
            const contextInfo = getMetadataContext(event);

            return (
              <div
                key={event.id}
                className="grid gap-3 px-6 py-5 md:grid-cols-[180px_minmax(0,1fr)_180px]"
              >
                <div className="text-sm text-on-surface-variant">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-on-surface">
                      {getActionLabel(event.action)}
                    </span>
                    <StatusBadge
                      tone={
                        event.actorType === "agent" ? "warning" : "default"
                      }
                    >
                      {event.actorType}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-on-surface-variant">
                    {event.actorLabel}
                    {contextInfo ? (
                      <span className="ml-2 text-on-surface-variant/70">
                        — {contextInfo}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="font-mono text-xs text-on-surface-variant/50">
                  {event.action}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function FilterFormSkeleton() {
  return (
    <div
      className="space-y-4 border border-white/10 bg-surface-container p-6"
      aria-busy="true"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
            <div className="h-10 animate-pulse rounded bg-white/5" />
          </div>
        ))}
        <div className="flex items-end gap-3">
          <div className="h-10 flex-1 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-20 animate-pulse rounded bg-white/5" />
        </div>
      </div>
    </div>
  );
}

function EventListSkeleton() {
  return (
    <section
      className="border border-white/10 bg-surface-container"
      aria-busy="true"
    >
      <div className="divide-y divide-white/5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="grid gap-3 px-6 py-5 md:grid-cols-[180px_minmax(0,1fr)_180px]"
          >
            <div className="h-4 w-36 animate-pulse rounded bg-white/5" />
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-full max-w-xs animate-pulse rounded bg-white/5" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </section>
  );
}
