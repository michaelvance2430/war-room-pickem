"use client";

/**
 * One clear line: which room + sport + host/player mode.
 * Kills "which league am I in?" and stacks host chrome into one chip.
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

  return (
    <div className="mb-4 rounded-xl border border-border/70 bg-black/40 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mb-0.5">
          This room
        </p>
        <p className="text-sm font-bold text-foreground truncate">
          <span
            className={
              isNfl ? "text-blue-300" : "text-primary"
            }
          >
            {pack.emoji} {pack.shortLabel}
          </span>
          <span className="text-muted font-normal"> · </span>
          {name}
        </p>
        <p className="text-[11px] text-muted mt-0.5">
          {isCommish ? (
            <>
              <span className="text-amber-200 font-semibold">You&apos;re hosting</span>
              {leagueCode ? (
                <>
                  {" "}
                  · code{" "}
                  <span className="font-mono tracking-wider text-foreground/90">
                    {leagueCode}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span>You&apos;re a player here</span>
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
            className="min-h-[40px] px-3 rounded-lg border border-warning/40 text-warning text-xs font-bold touch-manipulation"
          >
            Player view
          </button>
        )}
        {isCommish && (
          <Link
            href="/commissioner"
            className="min-h-[40px] px-3 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-bold inline-flex items-center touch-manipulation"
          >
            Host tools
          </Link>
        )}
      </div>
    </div>
  );
}
