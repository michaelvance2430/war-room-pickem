"use client";

/**
 * League Lock Timer — top of Picks.
 * Answers: "How long do I have left?" without dominating the card.
 * Personality shifts as kickoff approaches — story of the week.
 */

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Optional Home masthead slot. Picks omits this and renders in place. */
  portalTargetId?: string;
};

function tickMs(lockAt: number, now: number): number {
  const rem = lockAt - now;
  if (rem <= 0) return 60_000;
  if (rem < 10 * 60_000) return 1_000;
  if (rem < 60 * 60_000) return 5_000;
  if (rem < 24 * 60 * 60_000) return 30_000;
  return 60_000;
}

export default function LeagueLockTimer({
  games,
  hidden,
  portalTargetId,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const lockAt = firstKickoffOnCardMs(games);
  const countdown = formatLeagueLockCountdown(games, now);
  const remaining = Math.max(0, lockAt - now);
  const urgent = remaining > 0 && remaining <= 12 * 60 * 60_000;

  useLayoutEffect(() => {
    if (!portalTargetId) {
      setPortalTarget(null);
      return;
    }
    setPortalTarget(document.getElementById(portalTargetId));
  }, [portalTargetId]);

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

  const content = countdown.locked ? (
    <div
      className="home-mission-countdown picks-lock-control is-live"
      role="status"
      aria-live="polite"
    >
      <div className="home-mission-countdown-topline">
        <span>Game feed</span><i aria-hidden /><span>First kickoff</span>
      </div>
      <strong>LIVE</strong>
      <p>{lockLabel ? `Card froze · ${lockLabel}` : "Games underway"}</p>
    </div>
  ) : (
    <div
      className={`home-mission-countdown picks-lock-control ${urgent ? "is-urgent" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={`Picks lock in ${countdown.headline}.`}
    >
      <div className="home-mission-countdown-topline">
        <span>Lock control</span><i aria-hidden /><span>First kickoff</span>
      </div>
      <strong>
        {countdown.segments.map((seg) => (
          <b key={seg.unit + seg.value}>
            {seg.value}<small>{seg.unit.slice(0, 1).toUpperCase()}</small>
          </b>
        ))}
      </strong>
      <p>{lockLabel ? `Card freezes · ${lockLabel}` : "Card freezes at zero"}</p>
    </div>
  );

  return portalTarget ? createPortal(content, portalTarget) : content;
}
