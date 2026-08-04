"use client";

/**
 * Restrained blue league-interest markers for card-builder game rows.
 * Informational only — never green selection chrome.
 */

import type { CSSProperties } from "react";
import type { GameLeagueInterest } from "@/lib/league-favorite-interest";
import { leagueInterestBadgeLabel } from "@/lib/league-favorite-interest";

const BLUE = "#3b82f6";

type Props = {
  interest: GameLeagueInterest;
  /** Show per-team lines under the matchup title */
  showSides?: boolean;
};

export default function LeagueInterestGameMeta({
  interest,
  showSides = true,
}: Props) {
  if (interest.combined <= 0) return null;
  const badge = leagueInterestBadgeLabel(interest);
  return (
    <div className="mt-1.5 space-y-1">
      {showSides && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {interest.away && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: BLUE }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: BLUE }}
                aria-hidden
              />
              {interest.away.matched.name}
              <span className="tabular-nums font-bold opacity-90">
                · {interest.away.count}
              </span>
            </span>
          )}
          {interest.home && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: BLUE }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: BLUE }}
                aria-hidden
              />
              {interest.home.matched.name}
              <span className="tabular-nums font-bold opacity-90">
                · {interest.home.count}
              </span>
            </span>
          )}
        </div>
      )}
      {badge && (
        <p
          className="text-[10px] font-black uppercase tracking-[0.12em]"
          style={{ color: BLUE }}
        >
          {badge}
        </p>
      )}
    </div>
  );
}

/** Thin blue border when either side has interest; never overrides selected green. */
export function leagueInterestShellClass(
  interest: GameLeagueInterest,
  selected: boolean
): string {
  if (selected || interest.combined <= 0) return "";
  return "border-sky-500/45";
}

export function leagueInterestShellStyle(
  interest: GameLeagueInterest,
  selected: boolean
): CSSProperties | undefined {
  if (selected || interest.combined <= 0) return undefined;
  return {
    borderColor: "rgba(59, 130, 246, 0.55)",
    boxShadow: interest.bothSides
      ? "inset 0 0 0 1px rgba(59, 130, 246, 0.25)"
      : "inset 3px 0 0 0 rgba(59, 130, 246, 0.75)",
  };
}
