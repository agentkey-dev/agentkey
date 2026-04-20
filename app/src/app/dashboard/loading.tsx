export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="max-w-3xl space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-80 max-w-full animate-pulse rounded bg-white/10" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-white/5" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-white/10 bg-surface-container p-6">
      <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/5" />
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="border border-white/10 bg-surface-container">
      <div className="border-b border-white/10 px-6 py-4">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
      </div>
      <div className="divide-y divide-white/5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 px-6 py-5">
            <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-full max-w-xs animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
