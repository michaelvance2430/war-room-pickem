"use client";

/**
 * Dynamic PicksClient (~2.3k lines) so Standings/Home → Picks soft-nav paints
 * a shell first instead of compiling the whole card UI before first frame.
 */

import dynamic from "next/dynamic";

const PicksClient = dynamic(() => import("./PicksClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-3xl mx-auto w-full px-3 sm:px-4 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          My Picks
        </p>
        <h1 className="text-xl font-extrabold mt-0.5 mb-4">This week&apos;s card</h1>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-3 w-48 rounded bg-card-hover animate-pulse" />
          <div className="h-16 w-full rounded bg-card-hover animate-pulse" />
          <div className="h-16 w-full rounded bg-card-hover animate-pulse" />
          <p className="text-sm text-muted pt-1">Loading the card…</p>
        </div>
      </main>
    </div>
  ),
});

export default function PicksPage() {
  return <PicksClient />;
}
