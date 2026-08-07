"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadCrystalBall,
  type CrystalBallState,
} from "@/lib/crystal-ball";
import { formatCountdownToDeadline } from "@/lib/dates";
import { getLeague } from "@/lib/league";
import { isCrystalBallOpeningWeek } from "@/lib/league-hub-actions";

type Props = { weekNumber: number };

export default function PicksCrystalBallSummary({ weekNumber }: Props) {
  const league = getLeague();
  const sportId = league?.sportId || "cfb";
  const enabled = league?.settings?.crystalBallEnabled !== false;
  const openingWeek = isCrystalBallOpeningWeek(sportId, weekNumber);
  const [state, setState] = useState<CrystalBallState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || !openingWeek) return;
    let cancelled = false;
    void loadCrystalBall()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, openingWeek]);

  useEffect(() => {
    if (!state?.lockAtMs || state.locked) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [state?.lockAtMs, state?.locked]);

  const countdown = useMemo(
    () => formatCountdownToDeadline(state?.lockAtMs, now),
    [state?.lockAtMs, now]
  );
  const locked = !!state && (state.locked || countdown.locked);

  if (!enabled || !openingWeek || !state) return null;

  const label = sportId === "nfl" ? "Super Bowl Pick" : "Crystal Ball";
  const museumHref = "/museum";

  return (
    <section
      className="mb-4 rounded-xl border border-amber-400/35 bg-gradient-to-r from-amber-500/10 via-card to-card px-4 py-3"
      aria-label={`${label} status`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.17em] text-amber-300">
            Your {label}
          </p>
          <p className="mt-1 truncate text-sm font-bold text-foreground">
            {state.myTeam || "No pick yet"}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            {locked
              ? "Locked at kickoff · permanent season record"
              : !countdown.unknown
                ? `Editable for ${countdown.headline}`
                : state.lockLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`block text-[10px] font-black uppercase tracking-wider ${
              locked ? "text-muted" : "text-primary"
            }`}
          >
            {locked ? "🔒 Locked" : "Open"}
          </span>
          <Link
            href={locked ? museumHref : "/crystal-ball"}
            className="mt-1 inline-flex min-h-[36px] items-center text-xs font-bold text-primary hover:underline"
          >
            {locked ? "View history" : state.myTeam ? "Change Pick" : "Make Pick"}
          </Link>
        </div>
      </div>
    </section>
  );
}
