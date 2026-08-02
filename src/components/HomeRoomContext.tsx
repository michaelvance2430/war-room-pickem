"use client";

/**
 * Sticky room plaque — league name LOUD, sport as a chip.
 * Multi-league users scan for the room name, not "War Room".
 */

import Link from "next/link";
import { getSportPack } from "@/lib/sports/registry";
import { setViewAsPlayer } from "@/lib/view-as-player";

type Props = {
  leagueName: string | null;
  sportId: string;
  isCommish: boolean;
  /** True host (not view-as-player) — show player-view escape */
  actuallyCommish?: boolean;
  leagueCode?: string | null;
};

export default function HomeRoomContext({
  leagueName,
  sportId,
  isCommish,
  actuallyCommish,
  leagueCode,
}: Props) {
  const pack = getSportPack(sportId || "cfb");
  const name = (leagueName || "War Room").trim();
  const isNfl = pack.id === "nfl";
  const isWwc = pack.id === "soccer_wwc";

  const chipClass = isNfl
    ? "border-red-500/45 bg-red-500/15 text-red-100"
    : isWwc
      ? "border-yellow-400/50 bg-emerald-600/20 text-yellow-100"
      : "border-primary/45 bg-primary/15 text-primary";

  return (
    <div className="mb-4 rounded-2xl border-2 border-primary/35 bg-black/55 px-3.5 py-3.5 sm:px-4 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-[0_0_28px_rgba(34,197,94,0.08)]">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border ${chipClass}`}
          >
            <span aria-hidden>{pack.emoji}</span>
            {pack.shortLabel}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            Active room
          </span>
        </div>
        <p className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight break-words">
          {name}
        </p>
        <p className="text-[12px] text-muted mt-1">
          {isCommish ? (
            <>
              <span className="text-amber-200 font-semibold">You&apos;re hosting</span>
              {leagueCode ? (
                <>
                  {" "}
                  · code{" "}
                  <span className="font-mono tracking-wider text-foreground/95 font-bold">
                    {leagueCode}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span>You&apos;re a player in this room</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {actuallyCommish && isCommish && (
          <button
            type="button"
            onClick={() => {
              setViewAsPlayer(true);
              window.location.href = "/";
            }}
            className="min-h-[44px] px-3.5 rounded-lg border border-warning/40 text-warning text-xs font-bold touch-manipulation"
          >
            Player view
          </button>
        )}
        {isCommish && (
          <Link
            href="/commissioner"
            className="min-h-[44px] px-3.5 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-bold inline-flex items-center touch-manipulation"
          >
            Commish tools
          </Link>
        )}
      </div>
    </div>
  );
}
