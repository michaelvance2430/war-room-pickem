"use client";

/**
 * Guided weekly commissioner workflow.
 * Not the old dashboard — numbered steps: games → details → prop → preview → done.
 * Score path when the week needs scoring.
 */

import { Suspense } from "react";
import WeekOpsClient from "./WeekOpsClient";

export default function WeekOpsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col">
          <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
            <p className="text-sm text-muted">Opening week ops…</p>
          </main>
        </div>
      }
    >
      <WeekOpsClient />
    </Suspense>
  );
}
