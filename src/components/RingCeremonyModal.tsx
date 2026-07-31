"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import {
  loadLeagueActiveWeek,
  listScoredWeekNumbers,
} from "@/lib/cloud";
import { loadLeagueTrophies } from "@/lib/trophies";
import { getDefendingChampion } from "@/lib/player-history";
import { isSeasonOpen } from "@/lib/season-countdown";

/**
 * Opening Day / ring ceremony.
 * Only once per player · league · season year, and only while the
 * first week of the live season is open (active week 0 or 1, season doors open).
 * Does not re-fire midseason or on every login after dismissal.
 */
const SEEN_KEY = "warroom-ring-ceremony-seen-v2";

/** League active week counts as "opening week" */
const OPENING_WEEKS = new Set([0, 1]);

function storageKey(
  leagueId: string,
  playerId: string,
  champYear: number
) {
  return `${SEEN_KEY}:${leagueId || "default"}:${playerId}:${champYear}`;
}

export default function RingCeremonyModal() {
  const [open, setOpen] = useState(false);
  const [champ, setChamp] = useState<{
    year: number;
    name: string;
    userId: string | null;
  } | null>(null);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        // Real season only — no preseason sandbox spam
        if (!isSeasonOpen()) return;

        const league = getLeague();
        const session = getSession();
        if (!session?.playerId || !league?.id) return;

        // First week open only (Week 0 openers or Week 1)
        const activeWeek = await loadLeagueActiveWeek();
        if (!OPENING_WEEKS.has(activeWeek)) return;

        // If the room has already scored past opening, skip even if active week lag
        try {
          const scored = await listScoredWeekNumbers();
          const pastOpening = scored.some((w) => w >= 2);
          if (pastOpening) return;
        } catch {
          /* ignore scored check */
        }

        const trophies = await loadLeagueTrophies();
        const d = getDefendingChampion(trophies);
        if (!d || cancelled) return;

        const key = storageKey(league.id, session.playerId, d.year);
        if (localStorage.getItem(key) === "1") return;

        await new Promise((r) => setTimeout(r, 700));
        if (cancelled) return;

        setChamp(d);
        setLeagueName(league.name || "War Room");
        setOpen(true);
      } catch {
        /* ignore */
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    try {
      const league = getLeague();
      const session = getSession();
      if (league?.id && session?.playerId && champ) {
        localStorage.setItem(
          storageKey(league.id, session.playerId, champ.year),
          "1"
        );
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open || !champ) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ring-ceremony-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-amber-400/50 bg-card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300 text-center">
          Opening day
        </p>
        <div className="text-center">
          <div className="text-5xl mb-2" aria-hidden>
            💍
          </div>
          <h2
            id="ring-ceremony-title"
            className="text-xl font-black text-foreground"
          >
            Welcome back
          </h2>
          <p className="text-sm text-muted mt-1">{leagueName}</p>
        </div>

        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
            Defending champion · {champ.year}
          </p>
          {champ.userId ? (
            <Link
              href={`/profile/${champ.userId}`}
              className="text-2xl font-black text-amber-300 hover:underline block mt-1"
              onClick={dismiss}
            >
              {champ.name}
            </Link>
          ) : (
            <p className="text-2xl font-black text-amber-300 mt-1">
              {champ.name}
            </p>
          )}
          <p className="text-xs text-muted mt-2 leading-relaxed">
            First week is live. The ring is theirs until someone takes it.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/trophy-room"
            onClick={dismiss}
            className="w-full py-3 rounded-xl font-bold bg-amber-400 text-black text-center min-h-[48px] flex items-center justify-center"
          >
            View championship banner
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground"
          >
            Enter the room
          </button>
        </div>
      </div>
    </div>
  );
}
