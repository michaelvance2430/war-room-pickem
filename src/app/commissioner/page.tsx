"use client";

/**
 * Manage League — Stage 1
 * Weekly ops: Home → /week-ops (legacy ?tab=card|results redirect there).
 * Full CommissionerClient workbench is no longer the landing page.
 */

import dynamic from "next/dynamic";

const ManageLeagueClient = dynamic(() => import("./ManageLeagueClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 py-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          Manage League
        </p>
        <h1 className="text-xl font-extrabold mt-0.5 mb-4">Manage League</h1>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="h-3 w-40 rounded bg-card-hover animate-pulse" />
          <div className="h-3 w-full max-w-md rounded bg-card-hover animate-pulse" />
          <p className="text-sm text-muted pt-1">Opening management…</p>
        </div>
      </main>
    </div>
  ),
});

export default function CommissionerPage() {
  return <ManageLeagueClient />;
}
