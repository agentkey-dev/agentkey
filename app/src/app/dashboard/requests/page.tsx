import { Suspense } from "react";

import { RequestsInbox } from "@/components/dashboard/requests-inbox";
import { requireDashboardContext } from "@/lib/auth/admin";
import { listPendingRequests } from "@/lib/services/admin";

export default async function RequestsPage() {
  const context = await requireDashboardContext();

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-on-surface-variant">
          Workspace
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface">
          Requests
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          Every access request and suggestion from your agents lands here.
          Approve in one click for shared credentials, paste a credential for
          per-agent ones, deny with an optional note.
        </p>
      </div>

      <Suspense fallback={<RequestsInboxSkeleton />}>
        <RequestsInboxSection organizationId={context.organization.id} />
      </Suspense>
    </div>
  );
}

async function RequestsInboxSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const requests = await listPendingRequests(organizationId);
  const accessCount = requests.filter(
    (request) => request.kind === "access_request",
  ).length;
  const suggestionCount = requests.length - accessCount;

  return (
    <>
      {requests.length > 0 ? (
        <div className="max-w-3xl font-mono text-[11px] uppercase tracking-widest text-on-surface-variant/60">
          {accessCount} access
          {suggestionCount > 0 ? ` · ${suggestionCount} suggestions` : ""}
        </div>
      ) : null}
      <RequestsInbox initialRequests={requests} />
    </>
  );
}

function RequestsInboxSkeleton() {
  return (
    <div
      className="divide-y divide-white/5 border border-white/10 bg-surface-container"
      aria-busy="true"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-white/5" />
          </div>
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-white/5" />
          <div className="flex gap-3">
            <div className="h-8 w-20 animate-pulse rounded bg-white/5" />
            <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
