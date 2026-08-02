"use client";

/**
 * Thin route shell — Commish client is ~5k lines. Dynamic-load it so soft nav
 * (Gazette/Home → Commish) paints a shell first instead of compiling the whole
 * desk on the main thread before first paint.
 */

import dynamic from "next/dynamic";

const CommissionerClient = dynamic(() => import("./CommissionerClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-4 py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          Ops desk
        </p>
        <h1 className="text-xl font-extrabold mt-0.5 mb-4">Commish tools</h1>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-3 w-40 rounded bg-card-hover animate-pulse" />
          <div className="h-3 w-full max-w-md rounded bg-card-hover animate-pulse" />
          <div className="h-3 w-2/3 max-w-sm rounded bg-card-hover animate-pulse" />
          <p className="text-sm text-muted pt-1">Opening host tools…</p>
        </div>
      </main>
    </div>
  ),
});

export default function CommissionerPage() {
  return <CommissionerClient />;
}
