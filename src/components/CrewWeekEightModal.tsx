"use client";

/**
 * Mid-season (week 8+) login briefing: Crews outlive a single sport/league.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  claimSessionDrama,
  clearSessionDrama,
} from "@/lib/session-drama";
import {
  CREW_WEEK8_COPY,
  markCrewWeekEightDismissed,
  markCrewWeekEightSession,
  readLocalActiveWeek,
  shouldOfferCrewWeekEightBriefing,
} from "@/lib/crew-week8";
import { ensureCrewForLeague } from "@/lib/crew";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/smooth";

export default function CrewWeekEightModal() {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  function dismiss(forever = true) {
    const league = getLeague();
    if (forever) markCrewWeekEightDismissed(league?.id);
    else markCrewWeekEightSession(league?.id);
    clearSessionDrama("crew_week8");
    openRef.current = false;
    setOpen(false);
    unlockBodyScroll();
  }

  useEffect(() => {
    if (isGuestMode()) return;

    function tryOpen() {
      if (openRef.current) return;
      if (!shouldOfferCrewWeekEightBriefing()) return;
      if (!claimSessionDrama("crew_week8")) return;

      const league = getLeague();
      const session = getSession();
      if (league?.id) {
        ensureCrewForLeague({
          leagueId: league.id,
          leagueName: league.name || "War Room",
          sportId: league.sportId,
          createdBy: session?.playerId,
          foundedAt: league.createdAt,
        });
      }

      markCrewWeekEightSession(league?.id);
      openRef.current = true;
      setOpen(true);
      lockBodyScroll();
    }

    const t = window.setTimeout(tryOpen, 2_200);
    // Fail-safe: never trap more than 20s
    const fail = window.setTimeout(() => {
      if (openRef.current) dismiss(true);
    }, 20_000);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        dismiss(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(fail);
      window.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const week = readLocalActiveWeek();
  const leagueName = getLeague()?.name || "this room";

  return (
    <div
      className="fixed inset-0 z-[112] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crew-week8-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/88 backdrop-blur-md"
        aria-label="Close"
        onClick={() => dismiss(true)}
      />
      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-amber-400/45 bg-[#0c0a08] shadow-[0_0_70px_rgba(251,191,36,0.14)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700" />
        <div className="px-5 pt-5 pb-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
                {CREW_WEEK8_COPY.kicker} · Week {week}
              </p>
              <h2
                id="crew-week8-title"
                className="text-xl font-black text-foreground mt-1 leading-snug"
              >
                {CREW_WEEK8_COPY.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="min-w-[44px] min-h-[44px] rounded-lg text-muted hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-muted">
            Room:{" "}
            <span className="text-foreground font-semibold">{leagueName}</span>
          </p>

          <div className="space-y-3 text-sm text-muted leading-relaxed">
            {CREW_WEEK8_COPY.body.map((p) => (
              <p key={p.slice(0, 24)} className="text-foreground/90">
                {p}
              </p>
            ))}
          </div>

          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-3.5 py-3 text-xs text-muted leading-relaxed">
            Crew marks land on{" "}
            <strong className="text-foreground">profile</strong> and{" "}
            <strong className="text-foreground">Museum</strong> — who stayed,
            who burned the most points, who&apos;s still in the foxhole.
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-amber-400 text-black font-extrabold text-sm touch-manipulation"
            >
              {CREW_WEEK8_COPY.cta}
            </button>
            <Link
              href="/crew"
              onClick={() => dismiss(true)}
              className="flex w-full items-center justify-center min-h-[48px] rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-card-hover"
            >
              {CREW_WEEK8_COPY.secondary}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
