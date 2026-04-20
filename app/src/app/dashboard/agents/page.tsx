import { Suspense } from "react";

import { AgentCatalogShell } from "@/components/dashboard/agent-catalog-shell";
import { AgentCreateForm } from "@/components/dashboard/agent-create-form";
import { requireDashboardContext } from "@/lib/auth/admin";
import { getOptionalBrandfetchClientId } from "@/lib/env";
import { getAppOrigin } from "@/lib/origin";
import { listAgents, listTools } from "@/lib/services/admin";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const baseUrl = getAppOrigin();
  const brandfetchClientId = getOptionalBrandfetchClientId();
  const selected =
    typeof params.selected === "string" ? params.selected : undefined;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
          Workspace
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
          Agents
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
          Each agent gets its own API key and its own access requests. Click a
          row to review pending requests, assign tools, or rotate the key.
        </p>
      </div>

      <Suspense fallback={<AgentsCatalogSkeleton />}>
        <AgentsCatalog
          organizationId={context.organization.id}
          baseUrl={baseUrl}
          brandfetchClientId={brandfetchClientId}
          selected={selected}
        />
      </Suspense>
    </div>
  );
}

async function AgentsCatalog({
  organizationId,
  baseUrl,
  brandfetchClientId,
  selected,
}: {
  organizationId: string;
  baseUrl: string;
  brandfetchClientId: string | undefined;
  selected: string | undefined;
}) {
  const [agentRows, toolRows] = await Promise.all([
    listAgents(organizationId),
    listTools(organizationId),
  ]);

  return (
    <AgentCatalogShell
      agents={agentRows}
      tools={toolRows}
      brandfetchClientId={brandfetchClientId}
      initialSelectedAgentId={selected}
    >
      <AgentCreateForm baseUrl={baseUrl} />
    </AgentCatalogShell>
  );
}

function AgentsCatalogSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="border border-white/10 bg-surface-container p-6">
        <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-3 w-80 max-w-full animate-pulse rounded bg-white/5" />
        <div className="mt-5 grid gap-4">
          <div className="h-10 animate-pulse rounded bg-white/5" />
          <div className="h-20 animate-pulse rounded bg-white/5" />
          <div className="h-10 w-40 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="border border-white/10 bg-surface-container">
        <div className="border-b border-white/10 px-5 py-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-b-0"
          >
            <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
            <div className="ml-auto h-3 w-16 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
