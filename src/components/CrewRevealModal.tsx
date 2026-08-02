"use client";

/**
 * One-time "oh shit" after first season finale.
 * Not Gazette — quieter, heavier. Introduces Crew as permanent story.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import {
  crewFoundedLabel,
  completedChapterCount,
  EVENT_CREW_REVEAL,
  getChaptersForCrew,
  getCrewForLeague,
  markCrewRevealSeen,
  needsCrewRevealModal,
  sportChapterLabel,
  type Crew,
  type CrewChapter,
} from "@/lib/crew";
import { isGuestMode } from "@/lib/guest-mode";

export default function CrewRevealModal() {
  const [open, setOpen] = useState(false);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [chapter, setChapter] = useState<CrewChapter | null>(null);
  const [chapterCount, setChapterCount] = useState(1);

  function tryOpen() {
    if (isGuestMode()) return;
    const league = getLeague();
    const session = getSession();
    if (!league?.id || !session?.playerId) return;
    if (!needsCrewRevealModal(league.id, session.playerId)) return;
    const c = getCrewForLeague(league.id);
    if (!c?.revealedAt) return;
    const chapters = getChaptersForCrew(c.id);
    const completed =
      chapters.find((ch) => ch.leagueId === league.id && ch.status === "complete") ||
      chapters.find((ch) => ch.status === "complete") ||
      null;
    setCrew(c);
    setChapter(completed);
    setChapterCount(Math.max(1, completedChapterCount(c.id)));
    setOpen(true);
  }

  useEffect(() => {
    // After finale stamps reveal, event fires; also check on mount (next login)
    const t = window.setTimeout(() => tryOpen(), 400);
    function onReveal() {
      window.setTimeout(() => tryOpen(), 300);
    }
    window.addEventListener(EVENT_CREW_REVEAL, onReveal);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENT_CREW_REVEAL, onReveal);
    };
  }, []);

  function dismiss() {
    if (crew?.id) {
      markCrewRevealSeen(crew.id, getSession()?.playerId);
    }
    setOpen(false);
  }

  if (!open || !crew) return null;

  const sport = chapter
    ? sportChapterLabel(chapter.sportId)
    : getLeague()?.sportId === "nfl"
      ? "NFL"
      : "CFB";
  const year = chapter?.year || new Date().getFullYear();

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crew-reveal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        aria-label="Close"
        onClick={dismiss}
      />

      <div
        className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-amber-400/50 bg-[#0c0a08] shadow-[0_0_80px_rgba(251,191,36,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Plaque rail — not Gazette rainbow */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-700 via-amber-300 to-amber-700" />

        <div className="px-5 pt-5 pb-6 space-y-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/80">
            Chapter complete
          </p>
          <div
            className="mx-auto w-16 h-16 rounded-full border-2 border-amber-400/40 bg-amber-400/10 flex items-center justify-center text-3xl"
            aria-hidden
          >
            🏛️
          </div>
          <h2
            id="crew-reveal-title"
            className="text-2xl sm:text-3xl font-black text-amber-50 tracking-tight leading-tight"
          >
            Season 1 is in the books.
          </h2>
          <p className="text-sm text-amber-100/75 leading-relaxed px-1">
            That wasn&apos;t just a league code. It was the first chapter of a{" "}
            <strong className="text-amber-100">Crew</strong> — the same people,
            next sport whenever you&apos;re ready. Not a restart.
          </p>

          <div className="rounded-xl border border-amber-400/30 bg-black/40 px-4 py-4 text-left space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400/90">
              Your Crew
            </p>
            <p className="text-xl font-black text-amber-50">{crew.name}</p>
            <p className="text-xs text-amber-100/60">
              Founded {crewFoundedLabel(crew.foundedAt)} ·{" "}
              {chapterCount} chapter{chapterCount === 1 ? "" : "s"} together
            </p>
            {chapter && (
              <div className="pt-2 mt-2 border-t border-amber-400/15 text-xs text-amber-100/80 space-y-1">
                <p className="font-semibold text-amber-100">
                  Chapter 1 · {sport} {year}
                </p>
                {chapter.championshipName && (
                  <p>Champ · {chapter.championshipName}</p>
                )}
                {chapter.toiletName && (
                  <p>Toilet · {chapter.toiletName}</p>
                )}
              </div>
            )}
          </div>

          <p className="text-[11px] text-amber-100/50 leading-relaxed">
            Next chapter is the next sport — NFL, CFB, whatever you run. Same
            people. Same story.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <Link
              href="/crew"
              onClick={dismiss}
              className="w-full py-3.5 min-h-[52px] rounded-xl bg-amber-400 text-black text-sm font-extrabold flex items-center justify-center"
            >
              See your Crew →
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="w-full py-3 min-h-[48px] rounded-xl border border-amber-400/25 text-amber-100/80 text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
