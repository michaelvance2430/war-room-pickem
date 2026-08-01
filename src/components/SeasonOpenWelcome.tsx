"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import {
  hasSeenSeasonOpenWelcome,
  isSeasonOpen,
  markSeasonOpenWelcomeSeen,
  SEASON_DISPLAY_YEAR,
  getSeasonOpenLabel,
} from "@/lib/season-countdown";
import { isPreLockCalm } from "@/lib/first-week";

/**
 * First login after countdown expires: huge welcome splash once per league.
 * Ticker is gone; this is the “doors open” moment.
 */
export default function SeasonOpenWelcome() {
  const [open, setOpen] = useState(false);
  const [leagueName, setLeagueName] = useState("the War Room");
  const [isNfl, setIsNfl] = useState(false);

  useEffect(() => {
    const league = getLeague();
    const sid = league?.sportId || "cfb";
    if (!isSeasonOpen(Date.now(), sid)) return;
    const session = getSession();
    if (!session?.playerId || !session.leagueId) return;
    if (hasSeenSeasonOpenWelcome(session.leagueId)) return;
    // First 10 minutes: lock a card first — huge splash after
    if (isPreLockCalm(session.playerId)) return;

    const name = league?.name?.trim() || "the War Room";
    setLeagueName(name);
    setIsNfl(sid === "nfl");

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

      {/* Glow layers — green CFB vs crimson NFL */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background: isNfl
            ? "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(193,18,31,0.28), transparent 60%)"
            : "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(34,197,94,0.25), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-3xl text-center px-2">
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-primary mb-4 sm:mb-6 animate-pulse">
          {isNfl ? "Primetime is open" : "Doors are open"}
        </p>

        <p className="text-sm sm:text-base uppercase tracking-[0.25em] text-muted mb-3 sm:mb-4">
          Welcome to
        </p>

        <h1
          id="season-open-title"
          className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.05] mb-4 sm:mb-6"
          style={{
            filter: isNfl
              ? "drop-shadow(0 0 40px rgba(193,18,31,0.4))"
              : "drop-shadow(0 0 40px rgba(34,197,94,0.35))",
          }}
        >
          {leagueName}
        </h1>

        <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-primary tracking-tight mb-6 sm:mb-8">
          {SEASON_DISPLAY_YEAR} SEASON
        </p>

        <p className="text-sm sm:text-base text-muted max-w-md mx-auto leading-relaxed mb-8">
          {isNfl
            ? "The countdown is over. Lock picks before first kickoff. Late windows, Sunday Gazette, Locker — the room is yours. Don’t ghost week one."
            : "The countdown is over. Lock picks before first kickoff. Standings, Gazette, Locker — the room is yours. Don’t ghost week one."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            href="/picks"
            onClick={dismiss}
            className="px-8 py-4 rounded-xl bg-primary text-black text-base sm:text-lg font-bold hover:opacity-90 transition"
            style={{
              boxShadow: isNfl
                ? "0 0 30px rgba(193,18,31,0.4)"
                : "0 0 30px rgba(34,197,94,0.35)",
            }}
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
