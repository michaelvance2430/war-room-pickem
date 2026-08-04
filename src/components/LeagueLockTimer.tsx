"use client";

/**
 * League Lock Timer — top of Picks.
 * Answers: "How long do I have left?" without dominating the card.
 * Personality shifts as kickoff approaches — story of the week.
 */

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types";
import {
  firstKickoffOnCardMs,
  formatKickoff,
  formatLeagueLockCountdown,
  type LeagueLockPhase,
} from "@/lib/dates";

type Props = {
  games: Game[];
  /** Hide for practice / archive / no card */
  hidden?: boolean;
};

function tickMs(lockAt: number, now: number): number {
  const rem = lockAt - now;
  if (rem <= 0) return 60_000;
  if (rem < 10 * 60_000) return 1_000;
  if (rem < 60 * 60_000) return 5_000;
  if (rem < 24 * 60 * 60_000) return 30_000;
  return 60_000;
}

type PhaseChrome = {
  dot: string;
  mood: string;
  shell: string;
  number: string;
  unit: string;
  title: string;
};

function chromeFor(phase: LeagueLockPhase): PhaseChrome {
  switch (phase) {
    case "locked":
      return {
        dot: "⚫",
        mood: "Picks locked",
        shell: "border-border/80 bg-card/40",
        number: "text-muted",
        unit: "text-muted/70",
        title: "text-muted",
      };
    case "last_call":
      return {
        dot: "🔴",
        mood: "Last call",
        shell: "border-red-500/35 bg-red-500/10",
        number: "text-red-200",
        unit: "text-red-200/70",
        title: "text-red-300/90",
      };
    case "locking_soon":
      return {
        dot: "🟠",
        mood: "Locking soon",
        shell: "border-orange-400/35 bg-orange-500/10",
        number: "text-orange-100",
        unit: "text-orange-200/70",
        title: "text-orange-200/90",
      };
    case "final_day":
      return {
        dot: "🟡",
        mood: "Final day",
        shell: "border-amber-400/30 bg-amber-500/10",
        number: "text-amber-100",
        unit: "text-amber-200/70",
        title: "text-amber-200/90",
      };
    default:
      return {
        dot: "🟢",
        mood: "Plenty of time",
        shell: "border-border/70 bg-card/50",
        number: "text-foreground",
        unit: "text-muted",
        title: "text-muted",
      };
  }
}

export default function LeagueLockTimer({ games, hidden }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const lockAt = firstKickoffOnCardMs(games);
  const countdown = formatLeagueLockCountdown(games, now);
  const chrome = chromeFor(countdown.phase);

  useEffect(() => {
    if (hidden || !lockAt) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (cancelled) return;
      const t = Date.now();
      setNow(t);
      timeoutId = setTimeout(schedule, tickMs(lockAt, t));
    }
    schedule();
    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [hidden, lockAt]);

  if (hidden || !games.length || countdown.unknown) return null;

  const lockLabel =
    lockAt > 0
      ? formatKickoff(new Date(lockAt).toISOString()).full
      : null;

  if (countdown.locked) {
    return (
      <div
        className={`mb-4 rounded-xl border px-3.5 py-3 ${chrome.shell}`}
        role="status"
        aria-live="polite"
      >
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.16em] ${chrome.title}`}
        >
          {chrome.dot} Picks are locked
        </p>
        <p className="text-sm font-semibold text-foreground mt-1">
          Games are underway.
        </p>
        {lockLabel && (
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Card froze at first kickoff · {lockLabel}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mb-4 rounded-xl border px-3.5 py-3 ${chrome.shell}`}
      role="timer"
      aria-live="polite"
      aria-label={`Picks lock in ${countdown.headline}. ${chrome.mood}.`}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`text-[10px] font-bold uppercase tracking-[0.16em] ${chrome.title}`}
        >
          🔒 Picks lock in
        </p>
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${chrome.title}`}
        >
          {chrome.dot} {chrome.mood}
        </p>
      </div>

      {/* Large numbers, small labels — eye catches the countdown */}
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        {countdown.segments.map((seg) => (
          <div key={seg.unit + seg.value} className="min-w-[2.75rem]">
            <p
              className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums leading-none ${chrome.number}`}
            >
              {seg.value}
            </p>
            <p
              className={`text-[9px] font-bold uppercase tracking-[0.14em] mt-1 ${chrome.unit}`}
            >
              {seg.unit}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
        Picks lock at the first kickoff. You may edit your card until then.
      </p>
      {lockLabel && (
        <p className="text-[10px] text-muted/80 mt-0.5 tabular-nums">
          First kickoff · {lockLabel}
        </p>
      )}
    </div>
  );
}
