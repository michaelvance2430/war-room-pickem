"use client";

/**
 * League Lock Timer — top of Picks.
 * Answers: "How long do I have left?" without dominating the card.
 * Locks at first scheduled kickoff on the published card.
 */

import { useEffect, useState } from "react";
import type { Game } from "@/lib/types";
import {
  firstKickoffOnCardMs,
  formatKickoff,
  formatLeagueLockCountdown,
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

export default function LeagueLockTimer({ games, hidden }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const lockAt = firstKickoffOnCardMs(games);
  const countdown = formatLeagueLockCountdown(games, now);

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
        className="mb-4 rounded-xl border border-border/70 bg-card/50 px-3.5 py-3"
        role="status"
        aria-live="polite"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
          🔒 Picks are locked
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
      className="mb-4 rounded-xl border border-border/70 bg-card/50 px-3.5 py-3"
      role="timer"
      aria-live="polite"
      aria-label={`Picks lock in ${countdown.headline}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
        🔒 Picks lock in
      </p>

      {countdown.parts ? (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {countdown.parts.map((part) => (
            <span
              key={part}
              className="text-base sm:text-lg font-black tracking-tight text-foreground tabular-nums"
            >
              {part}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
          {countdown.headline}
        </p>
      )}

      <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
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
