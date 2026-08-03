/**
 * The last resort: shown only when the service worker has no cached copy of the
 * route you asked for. Anything you've already visited comes back from cache
 * instead, and anything you write offline is queued, so this page is a dead end
 * by design rather than a warning about losing work.
 */
export default function OfflinePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 text-center">
      <p className="font-script text-4xl text-muted">No signal.</p>
      <p className="mt-3 text-sm text-faint">
        This page hasn&apos;t been opened on this device yet, so there&apos;s
        nothing saved to show. Anything you write still keeps — it sends itself
        when you&apos;re back.
      </p>
    </div>
  );
}
