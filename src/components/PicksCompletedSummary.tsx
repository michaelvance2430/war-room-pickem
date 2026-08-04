"use client";

/**
 * Minimalist "YOUR CARD IS IN" / "PICKS LOCKED" receipt for Picks.
 * Renders from the same in-memory saved picks as the editor — no second source of truth.
 */

import type { Game, Prop, UserPick } from "@/lib/types";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";
import { matchCfbTeamConfident } from "@/lib/teams/cfb-catalog";
import { formatCardLockDeadline, weekTitle } from "@/lib/dates";
import { formatRankedTeam } from "@/lib/rankings";

const FAV_BLUE = "#3b82f6";

export type PicksCompletedPhase =
  | "in"
  | "locked"
  | "in_progress" // reserved
  | "week_complete"; // reserved

type Props = {
  phase: PicksCompletedPhase;
  sportId: string;
  weekNumber: number;
  games: Game[];
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  prop: Prop;
  propChoice: string | null;
  /** Authoritative picks.locked_at — omit display if null */
  lockedAt: string | null;
  favoriteTeam: CanonicalTeam | null;
  /** Brief fade-in after a successful save this session */
  animateIn?: boolean;
  reducedMotion?: boolean;
  onChangePicks?: () => void;
};

/**
 * picks.locked_at is first successful submission time (app “lock your card”),
 * not the kickoff freeze. Re-saves keep the original stamp (see savePicksToCloud).
 * Label carefully — never “locked at kickoff”.
 */
function formatSubmittedLine(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = d.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return `Submitted ${weekday} at ${time}`;
}

function sideSpread(
  game: Game,
  side: "home" | "away",
  pick: UserPick
): string {
  const spread = pick.lockedSpread ?? game.spread;
  const favorite = pick.lockedFavorite ?? game.favorite;
  const isFav = favorite === side;
  if (isFav) {
    return spread < 0 ? `${spread}` : `-${Math.abs(spread)}`;
  }
  return `+${Math.abs(spread)}`;
}

export default function PicksCompletedSummary({
  phase,
  sportId,
  weekNumber,
  games,
  picks,
  bestBetId,
  prop,
  propChoice,
  lockedAt,
  favoriteTeam,
  animateIn = false,
  reducedMotion = false,
  onChangePicks,
}: Props) {
  const sportLabel =
    sportId === "nfl" ? "NFL" : sportId === "cfb" ? "CFB" : sportId.toUpperCase();
  const weekLabel = weekTitle(weekNumber, sportId) || `Week ${weekNumber}`;
  const submittedLine = formatSubmittedLine(lockedAt);
  const lockWhen = formatCardLockDeadline(games);
  const canChange = phase === "in" && typeof onChangePicks === "function";

  const headline =
    phase === "locked"
      ? "🔒 PICKS LOCKED"
      : phase === "in_progress"
        ? "GAMES IN PROGRESS"
        : phase === "week_complete"
          ? "WEEK COMPLETE"
          : "✓ YOUR CARD IS IN";

  const statusLine =
    phase === "locked"
      ? lockWhen
        ? `Frozen at first kickoff · ${lockWhen}`
        : "Card is frozen — no more changes."
      : lockWhen
        ? `Editable until first kickoff · ${lockWhen}`
        : "Changes remain available until the card freezes at first kickoff.";

  // Confidence high → low (5…1)
  const rows = [...games]
    .map((g) => {
      const p = picks[g.id];
      if (!p?.pick) return null;
      return { game: g, pick: p };
    })
    .filter(Boolean) as { game: Game; pick: UserPick }[];
  rows.sort((a, b) => (b.pick.confidence || 0) - (a.pick.confidence || 0));

  return (
    <div
      className={`rounded-2xl border border-primary/35 bg-card p-4 sm:p-5 transition-opacity duration-500 ${
        animateIn && !reducedMotion ? "opacity-100" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label={
        phase === "locked"
          ? "Picks locked"
          : "Your card is in"
      }
    >
      <p className="text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-primary mb-1">
        {headline}
      </p>
      <p className="text-sm text-muted">
        {sportLabel} · {weekLabel}
      </p>
      {submittedLine && (
        <p className="text-xs text-muted mt-0.5">{submittedLine}</p>
      )}
      <p className="text-xs text-muted/90 mt-1 leading-snug">{statusLine}</p>

      <ul className="mt-5 space-y-2.5">
        {rows.map(({ game, pick }) => {
          const selectedSide = pick.pick;
          const selectedName =
            selectedSide === "away" ? game.awayTeam : game.homeTeam;
          const selectedRank =
            selectedSide === "away" ? game.awayRank : game.homeRank;
          const oppName =
            selectedSide === "away" ? game.homeTeam : game.awayTeam;
          const oppRank =
            selectedSide === "away" ? game.homeRank : game.awayRank;
          const spread = sideSpread(game, selectedSide, pick);
          const isBest = bestBetId === game.id;

          const matchSel =
            sportId === "cfb" && favoriteTeam
              ? matchCfbTeamConfident(selectedName)
              : null;
          const matchOpp =
            sportId === "cfb" && favoriteTeam
              ? matchCfbTeamConfident(oppName)
              : null;
          const selIsFav =
            !!matchSel &&
            !!favoriteTeam &&
            matchSel.id === favoriteTeam.id;
          const oppIsFav =
            !!matchOpp &&
            !!favoriteTeam &&
            matchOpp.id === favoriteTeam.id;
          const rowHasFav = selIsFav || oppIsFav;

          return (
            <li
              key={game.id}
              className="flex gap-3 rounded-xl border border-border/80 bg-background/40 px-3 py-2.5"
              style={
                rowHasFav
                  ? {
                      borderColor: "rgba(59, 130, 246, 0.45)",
                      boxShadow: `inset 3px 0 0 0 ${FAV_BLUE}`,
                    }
                  : undefined
              }
            >
              <span
                className="w-9 shrink-0 text-center text-xl sm:text-2xl font-black text-primary tabular-nums leading-none pt-0.5"
                aria-label={`Confidence ${pick.confidence}`}
              >
                {pick.confidence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className="font-bold text-[15px] sm:text-base text-foreground leading-snug break-words"
                    style={selIsFav ? { color: FAV_BLUE } : undefined}
                  >
                    {formatRankedTeam(selectedName, selectedRank)}
                  </span>
                  <span className="text-sm font-semibold text-muted tabular-nums">
                    {spread}
                  </span>
                  {isBest && (
                    <span className="text-[10px] font-black uppercase tracking-wide text-primary border border-primary/40 bg-primary/10 px-1.5 py-0.5 rounded">
                      Best Bet
                    </span>
                  )}
                </div>
                <p
                  className="text-xs text-muted mt-0.5 leading-snug"
                  style={oppIsFav ? { color: FAV_BLUE } : undefined}
                >
                  vs {formatRankedTeam(oppName, oppRank)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {prop.question && propChoice && (
        <div className="mt-4 rounded-xl border border-border/80 px-3 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted mb-1">
            Prop
          </p>
          <p className="text-sm font-bold text-foreground leading-snug">
            {propChoice}
          </p>
          <p className="text-xs text-muted mt-1 leading-snug">
            {prop.question}
          </p>
        </div>
      )}

      {canChange && (
        <button
          type="button"
          onClick={onChangePicks}
          className="mt-5 w-full py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground hover:border-muted touch-manipulation transition"
        >
          CHANGE PICKS
        </button>
      )}
    </div>
  );
}
