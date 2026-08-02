/**
 * Instant desktop (and mobile) route chrome while the big Commish client
 * chunk downloads/parses. Without this, Gazette → Commish feels frozen
 * on soft SPA nav because the page module is huge.
 */
export default function CommissionerLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Ops desk
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold mt-0.5">
              Commish tools
            </h1>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-3 w-40 rounded bg-card-hover animate-pulse" />
          <div className="h-3 w-full max-w-md rounded bg-card-hover animate-pulse" />
          <div className="h-3 w-2/3 max-w-sm rounded bg-card-hover animate-pulse" />
          <p className="text-sm text-muted pt-2">Opening host tools…</p>
        </div>
      </main>
    </div>
  );
}
