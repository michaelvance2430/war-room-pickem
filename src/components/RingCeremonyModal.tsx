"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueTrophies } from "@/lib/trophies";
import { getDefendingChampion } from "@/lib/player-history";
import { isSeasonOpen } from "@/lib/season-countdown";

const SEEN_KEY = "warroom-ring-ceremony-seen-v1";

function storageKey(leagueId: string, year: number) {
  return `${SEEN_KEY}:${leagueId || "default"}:${year}`;
}

/**
 * Opening Day / ring ceremony — shows defending champ once per league+year.
 * Light ritual; full animation can layer later.
 */
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
        const league = getLeague();
        const session = getSession();
        if (!session?.playerId || !league?.id) return;

        const trophies = await loadLeagueTrophies();
        const d = getDefendingChampion(trophies);
        if (!d || cancelled) return;

        // Only show once the calendar says season is open, OR always in sandbox
        // as a "practice ring" if champ exists — prefer real open.
        // Show whenever we have a defending champ and user hasn't dismissed this year plaque.
        const key = storageKey(league.id, d.year);
        if (localStorage.getItem(key) === "1") return;

        // Delay slightly so Home paints first
        await new Promise((r) => setTimeout(r, 600));
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
      if (league?.id && champ) {
        localStorage.setItem(storageKey(league.id, champ.year), "1");
      }
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open || !champ) return null;

  const seasonLive = isSeasonOpen();

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
          {seasonLive ? "Opening day" : "Ring ceremony · preview"}
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
            The ring is theirs until someone takes it. Crystal Ball is free
            pride. The board is watching.
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
