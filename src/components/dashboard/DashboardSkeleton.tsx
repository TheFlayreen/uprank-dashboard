/** Shown while the dashboard streams in. Mirrors the real layout to avoid layout shift. */
export function DashboardSkeleton() {
  return (
    <div
      className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-12"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="hidden h-64 animate-pulse rounded-lg bg-surface-2 lg:block" />
      <div className="space-y-10">
        <div className="h-16 w-64 animate-pulse rounded bg-surface-2" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse bg-surface-2" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}
