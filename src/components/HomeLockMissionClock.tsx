"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBestAvailableWeekCard, loadWeekCard } from "@/lib/cloud";
import { getLeague } from "@/lib/league";
import { resolvePlayerActiveWeek } from "@/lib/active-week";
import {
  firstKickoffOnCardMs,
  formatKickoff,
  formatLeagueLockCountdown,
} from "@/lib/dates";
import type { Game } from "@/lib/types";

type ClockState = {
  week: number;
  games: Game[];
};

export default function HomeLockMissionClock() {
  const [clock, setClock] = useState<ClockState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { week } = await resolvePlayerActiveWeek({ persistIfOps: false });
        let card = await loadWeekCard(week).catch(() => null);
        let liveWeek = week;

        if (!card?.publishedAt || !Array.isArray(card.games) || !card.games.length) {
          const best = await loadBestAvailableWeekCard(week).catch(() => null);
          if (best?.card?.publishedAt && Array.isArray(best.card.games) && best.card.games.length) {
            card = best.card;
            liveWeek = best.week;
          }
        }

        if (cancelled) return;
        if (!card?.publishedAt || !Array.isArray(card.games) || !card.games.length) {
          setClock(null);
          return;
        }
        setClock({ week: liveWeek, games: card.games });
      } catch {
        if (!cancelled) setClock(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const lockAt = useMemo(
    () => (clock ? firstKickoffOnCardMs(clock.games) : 0),
    [clock]
  );

  useEffect(() => {
    if (!lockAt) return;
    const remaining = lockAt - Date.now();
    const interval = remaining > 24 * 60 * 60_000 ? 60_000 : remaining > 60 * 60_000 ? 30_000 : 1_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [lockAt]);

  if (!clock || !lockAt) return null;

  const countdown = formatLeagueLockCountdown(clock.games, now);
  const sport = (getLeague()?.sportId || "cfb").toUpperCase();
  const lockLabel = formatKickoff(new Date(lockAt).toISOString()).full;

  const urgent = countdown.phase === "last_call" || countdown.phase === "locking_soon";
  const finalDay = countdown.phase === "final_day";

  return (
    <div
      className={`mx-1 mt-1.5 rounded-xl border px-3 py-2.5 backdrop-blur-md ${
        countdown.locked
          ? "border-white/15 bg-black/55"
          : urgent
            ? "border-red-400/55 bg-red-950/35"
            : finalDay
              ? "border-amber-300/55 bg-amber-950/25"
              : "border-emerald-400/35 bg-black/48"
      }`}
      role={countdown.locked ? "status" : "timer"}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">
            Mission clock · {sport} week {clock.week}
          </p>
          <p className={`mt-0.5 text-[11px] font-black uppercase tracking-[0.12em] ${countdown.locked ? "text-white/80" : urgent ? "text-red-200" : finalDay ? "text-amber-200" : "text-emerald-300"}`}>
            {countdown.locked ? "Card closed · games underway" : "Next lock"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className={`font-black tabular-nums leading-none tracking-tight ${countdown.locked ? "text-lg text-white/80" : "text-2xl text-white"}`}>
            {countdown.locked ? "LOCKED" : countdown.headline}
          </p>
          <p className="mt-1 text-[9px] font-bold tabular-nums text-white/45">
            {countdown.locked ? `Locked ${lockLabel}` : lockLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
