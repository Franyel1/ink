export default function TabsLoading() {
  return (
    <div
      aria-label="Loading page"
      role="status"
      className="route-loading flex min-h-0 flex-1 flex-col gap-7 px-6 pb-8 pt-8 md:px-9 md:pt-9"
    >
      <span className="sr-only">Loading page…</span>
      <div className="h-8 w-36 animate-pulse rounded-md bg-surface-raised" />
      <div className="space-y-3">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-raised" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-raised" />
      </div>
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl border border-border/60 bg-surface/60" />
        <div className="h-24 animate-pulse rounded-2xl border border-border/60 bg-surface/60" />
      </div>
    </div>
  );
}
