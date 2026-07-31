"use client";

import { useEffect, useState } from "react";
import {
  formatCountdownCompact,
  getCountdownParts,
  getSeasonOpenLabel,
  type CountdownParts,
} from "@/lib/season-countdown";
import { getLeague } from "@/lib/league";

/**
 * Global strip under nav — counts to league open (to the second).
 * CFB → Aug 23 doors. NFL → Sep 9 Kickoff (first regular-season game).
 * When the clock hits zero: ticker is GONE (welcome splash takes over once).
 */
export default function SeasonCountdownTicker() {
  const [parts, setParts] = useState<CountdownParts | null>(null);
  const [label, setLabel] = useState(getSeasonOpenLabel());
  const [sportId, setSportId] = useState<string>("cfb");

  useEffect(() => {
    function tick() {
      const sid = getLeague()?.sportId || "cfb";
      setSportId(sid);
      setLabel(getSeasonOpenLabel(sid));
      setParts(getCountdownParts(Date.now(), sid));
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Hydration placeholder only while counting (not after open)
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

  // Countdown over — remove ticker entirely
  if (parts.done) return null;

  const clock = formatCountdownCompact(parts);
  const shortLabel =
    sportId === "nfl" ? "Sep 9 · Kickoff" : "Aug 23 · 12:01 AM ET";

  return (
    <div
      className="border-b border-primary/25 bg-black/90 text-[11px] sm:text-xs overflow-hidden"
      role="timer"
      aria-live="off"
      aria-label={`Season opens in ${clock}, ${label}`}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-center gap-2 sm:gap-3 min-w-0">
        <span className="shrink-0 font-bold uppercase tracking-[0.18em] text-primary">
          {sportId === "nfl" ? "NFL" : "Season"}
        </span>
        <span className="text-border shrink-0">·</span>
        <span className="text-muted shrink-0 hidden sm:inline">
          {sportId === "nfl" ? "Kickoff in" : "League opens in"}
        </span>
        <span
          className="font-mono font-bold text-primary tabular-nums tracking-wide text-sm sm:text-base"
          suppressHydrationWarning
        >
          {clock}
        </span>
        <span className="text-border shrink-0 hidden sm:inline">·</span>
        <span className="text-muted/90 truncate hidden sm:inline">{label}</span>
        <span className="text-muted/70 truncate sm:hidden text-[10px]">
          {shortLabel}
        </span>
      </div>
    </div>
  );
}
