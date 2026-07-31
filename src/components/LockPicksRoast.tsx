"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadWeekCard,
  loadMyPicks,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { getSession } from "@/lib/league";
import {
  isCardLockDeadlinePassed,
  weekTitle,
} from "@/lib/dates";
import { resolvePlayerActiveWeek, weekProgressLabel } from "@/lib/active-week";
import { pickLateLockRoast, pickLockRoast } from "@/lib/picks-roast";

/**
 * Home login roast: you still haven't locked this week's card.
 */
export default function LockPicksRoast() {
  const [show, setShow] = useState(false);
  const [late, setLate] = useState(false);
  const [msg, setMsg] = useState("");
  const [week, setWeek] = useState(1);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = getSession();
        if (!session?.playerId) return;

        const { week: w } = await resolvePlayerActiveWeek({
          persistIfOps: true,
        });
        const card = await loadWeekCard(w);
        const games = card?.games || [];
        if (!games.length) return;

        // Already scored week? no roast
        let scored: number[] = [];
        try {
          scored = await listScoredWeekNumbers();
        } catch {
          scored = [];
        }
        if (scored.includes(w)) return;

        const mine = await loadMyPicks(w);
        const locked = !!(
          mine?.lockedAt && Object.keys(mine.picks || {}).length
        );
        if (locked) return;

        const frozen = isCardLockDeadlinePassed(games, Date.now());
        const seed = `${session.playerId}:${w}:${frozen ? "late" : "open"}`;
        if (cancelled) return;
        setWeek(w);
        setLate(frozen);
        setMsg(frozen ? pickLateLockRoast(seed) : pickLockRoast(seed));
        setShow(true);
      } catch {
        /* ignore */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show || dismissed) return null;

  return (
    <section
      className={`mb-6 rounded-2xl border-2 px-4 py-4 sm:px-5 ${
        late
          ? "border-danger/50 bg-danger/10"
          : "border-warning/55 bg-warning/10"
      }`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${
              late ? "text-danger" : "text-warning"
            }`}
          >
            {late ? "You ghosted" : "Picks not locked"} ·{" "}
            {weekProgressLabel(week)}
          </p>
          <p className="text-sm sm:text-base font-semibold text-foreground leading-snug">
            {msg}
          </p>
          <p className="text-xs text-muted mt-1.5">
            {weekTitle(week)}
            {late
              ? " — card is frozen. Zero until next week."
              : " — lock before first kickoff or you score 0."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-muted hover:text-foreground px-2 py-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {!late && (
        <Link
          href="/picks"
          className="mt-3 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-warning text-black text-sm font-bold"
        >
          Lock my picks →
        </Link>
      )}
      {late && (
        <Link
          href="/standings"
          className="mt-3 inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-danger/40 text-danger text-sm font-semibold"
        >
          Face the standings →
        </Link>
      )}
    </section>
  );
}
