export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="border border-white/10 bg-surface-container p-6">
      <div className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
        {value}
      </div>
      <div className="mt-2 text-sm text-on-surface-variant">{detail}</div>
    </div>
  );
}

