"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import {
  hasSeenSeasonOpenWelcome,
  isSeasonOpen,
  markSeasonOpenWelcomeSeen,
  SEASON_DISPLAY_YEAR,
} from "@/lib/season-countdown";

/**
 * First login after countdown expires: huge welcome splash once per league.
 * Ticker is gone; this is the “doors open” moment.
 */
export default function SeasonOpenWelcome() {
  const [open, setOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("the War Room");

  useEffect(() => {
    if (!isSeasonOpen()) return;
    const session = getSession();
    if (!session?.playerId || !session.leagueId) return;
    if (hasSeenSeasonOpenWelcome(session.leagueId)) return;

    const league = getLeague();
    const name = league?.name?.trim() || "the War Room";
    setLeagueName(name);

    // Let the page paint, then hit them with the splash
    const t = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    const session = getSession();
    if (session?.leagueId) {
      markSeasonOpenWelcomeSeen(session.leagueId);
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-open-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        aria-label="Close welcome"
        onClick={dismiss}
      />

      {/* Glow layers */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(34,197,94,0.25), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-3xl text-center px-2">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-primary mb-4 sm:mb-6 animate-pulse">
          Doors are open
        </p>

        <p className="text-sm sm:text-base uppercase tracking-[0.25em] text-muted mb-3 sm:mb-4">
          Welcome to
        </p>

        <h1
          id="season-open-title"
          className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.05] mb-4 sm:mb-6 drop-shadow-[0_0_40px_rgba(34,197,94,0.35)]"
        >
          {leagueName}
        </h1>

        <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-primary tracking-tight mb-6 sm:mb-8">
          {SEASON_DISPLAY_YEAR} SEASON
        </p>

        <p className="text-sm sm:text-base text-muted max-w-md mx-auto leading-relaxed mb-8">
          The countdown is over. Lock picks before first kickoff. Standings,
          Gazette, Locker — the room is yours. Don&apos;t ghost week one.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            href="/picks"
            onClick={dismiss}
            className="px-8 py-4 rounded-xl bg-primary text-black text-base sm:text-lg font-bold hover:opacity-90 transition shadow-[0_0_30px_rgba(34,197,94,0.35)]"
          >
            Enter the War Room
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="px-6 py-3 rounded-xl border border-border text-sm text-muted hover:text-foreground hover:bg-card/50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
