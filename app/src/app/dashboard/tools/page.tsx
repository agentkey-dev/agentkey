import { Suspense } from "react";

import { ToolCatalogShell } from "@/components/dashboard/tool-catalog-shell";
import { ToolCatalogActions } from "@/components/dashboard/tool-catalog-actions";
import { requireDashboardContext } from "@/lib/auth/admin";
import { getOptionalBrandfetchClientId, isAiDraftingEnabled } from "@/lib/env";
import {
  getPendingToolInstructionSuggestion,
  listAgents,
  listTools,
} from "@/lib/services/admin";
import { listPendingToolSuggestions } from "@/lib/services/tool-suggestions";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireDashboardContext();
  const params = await searchParams;
  const suggestionId =
    typeof params.suggestionId === "string" ? params.suggestionId : undefined;
  const instructionSuggestionId =
    typeof params.instructionSuggestionId === "string"
      ? params.instructionSuggestionId
      : undefined;
  const selected =
    typeof params.selected === "string" ? params.selected : undefined;
  const brandfetchClientId = getOptionalBrandfetchClientId();
  const brandfetchConfigured = Boolean(brandfetchClientId);
  const aiDraftingEnabled = isAiDraftingEnabled();

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
          Tool catalog
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
          Tools
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-on-surface-variant">
          Add the SaaS tools your agents can request credentials for. Each tool
          carries a usage guide — company-specific context sent only when an
          agent fetches the credential.
        </p>
      </div>

      {!brandfetchConfigured ? (
        <div className="max-w-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Brandfetch logos are disabled because
          <code className="mx-1 text-xs">
            NEXT_PUBLIC_BRANDFETCH_CLIENT_ID
          </code>
          is not set in the app environment.
        </div>
      ) : null}

      <Suspense fallback={<ToolsCatalogSkeleton />}>
        <ToolsCatalog
          organizationId={context.organization.id}
          suggestionId={suggestionId}
          instructionSuggestionId={instructionSuggestionId}
          selected={selected}
          brandfetchClientId={brandfetchClientId}
          aiDraftingEnabled={aiDraftingEnabled}
        />
      </Suspense>
    </div>
  );
}

async function ToolsCatalog({
  organizationId,
  suggestionId,
  instructionSuggestionId,
  selected,
  brandfetchClientId,
  aiDraftingEnabled,
}: {
  organizationId: string;
  suggestionId: string | undefined;
  instructionSuggestionId: string | undefined;
  selected: string | undefined;
  brandfetchClientId: string | undefined;
  aiDraftingEnabled: boolean;
}) {
  const [toolRows, agentRows, pendingSuggestions, pendingInstructionSuggestion] =
    await Promise.all([
      listTools(organizationId),
      listAgents(organizationId),
      listPendingToolSuggestions(organizationId),
      instructionSuggestionId
        ? getPendingToolInstructionSuggestion(
            organizationId,
            instructionSuggestionId,
          )
        : Promise.resolve(null),
    ]);
  const initialSuggestionId = pendingSuggestions.some(
    (suggestion) => suggestion.id === suggestionId,
  )
    ? suggestionId
    : undefined;

  return (
    <ToolCatalogShell
      tools={toolRows}
      agents={agentRows}
      suggestions={pendingSuggestions}
      initialSelectedToolId={selected}
      initialSuggestionId={initialSuggestionId}
      initialInstructionSuggestion={pendingInstructionSuggestion}
      brandfetchClientId={brandfetchClientId}
      aiDraftingEnabled={aiDraftingEnabled}
    >
      <ToolCatalogActions />
    </ToolCatalogShell>
  );
}

function ToolsCatalogSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="border border-white/10 bg-surface-container p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded bg-white/5" />
        <div className="mt-5 grid gap-4">
          <div className="h-10 animate-pulse rounded bg-white/5" />
          <div className="h-10 animate-pulse rounded bg-white/5" />
          <div className="h-24 animate-pulse rounded bg-white/5" />
          <div className="h-10 w-32 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="border border-white/10 bg-surface-container">
        <div className="border-b border-white/10 px-5 py-3">
          <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
        </div>
        {[0, 1, 2, 3].map((i) => (
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
