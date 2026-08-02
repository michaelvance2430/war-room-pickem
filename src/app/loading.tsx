/**
 * Global soft-nav shell — every route transition paints something immediately
 * instead of a blank frozen frame while the next page chunk compiles.
 */
export default function GlobalLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4">
      <p className="text-sm text-muted animate-pulse">Loading…</p>
    </div>
  );
}
