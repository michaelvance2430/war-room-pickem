"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatCountdownCompact,
  getCountdownParts,
  SEASON_OPEN_LABEL,
  type CountdownParts,
} from "@/lib/season-countdown";

/**
 * Global strip under nav — always counting to league open (to the second).
 * After open: short “WE’RE LIVE” with path to picks.
 */
export default function SeasonCountdownTicker() {
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    function tick() {
      setParts(getCountdownParts());
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Avoid SSR/client mismatch — wait for first tick
  if (!parts) {
    return (
      <div
        className="border-b border-primary/20 bg-black/80 text-[11px] sm:text-xs text-muted"
        aria-hidden
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 h-[34px]" />
      </div>
    );
  }

  if (parts.done) {
    return (
      <div
        className="border-b border-primary/40 bg-primary/15 text-[11px] sm:text-xs"
        role="status"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center">
          <span className="font-bold uppercase tracking-[0.15em] text-primary">
            Season open
          </span>
          <span className="text-border hidden sm:inline">·</span>
          <span className="text-foreground/90">
            The War Room is live — lock up when the card drops.
          </span>
          <Link
            href="/picks"
            className="font-semibold text-primary hover:underline"
          >
            My Picks →
          </Link>
        </div>
      </div>
    );
  }

  const clock = formatCountdownCompact(parts);

  return (
    <div
      className="border-b border-primary/25 bg-black/90 text-[11px] sm:text-xs overflow-hidden"
      role="timer"
      aria-live="off"
      aria-label={`Season opens in ${clock}, ${SEASON_OPEN_LABEL}`}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2 sm:gap-3 min-w-0">
        <span className="shrink-0 font-bold uppercase tracking-[0.18em] text-primary">
          Season
        </span>
        <span className="text-border shrink-0">·</span>
        <span className="text-muted shrink-0 hidden xs:inline sm:inline">
          League opens in
        </span>
        <span
          className="font-mono font-bold text-primary tabular-nums tracking-wide text-sm sm:text-base"
          suppressHydrationWarning
        >
          {clock}
        </span>
        <span className="text-border shrink-0 hidden sm:inline">·</span>
        <span className="text-muted/90 truncate hidden sm:inline">
          {SEASON_OPEN_LABEL}
        </span>
        <span className="text-muted/70 truncate sm:hidden text-[10px]">
          Aug 23 · 12:01 AM ET
        </span>
      </div>
    </div>
  );
}
