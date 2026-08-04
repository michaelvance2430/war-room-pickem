/**
 * Anonymous league favorite-team interest for commissioner card building.
 * Aggregate only — never names or user ids.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getLeague, getSession, isActuallyOps } from "@/lib/league";
import type { SportId } from "@/lib/sports/types";
import type { Game } from "@/lib/types";
import {
  matchCfbTeamConfident,
  type CanonicalTeam,
} from "@/lib/teams/cfb-catalog";
import { NO_TEAM_ID } from "@/lib/favorite-teams";

/** team_id → count of distinct active human members who favor that team */
export type LeagueFavoriteCounts = Record<string, number>;

export type SideInterest = {
  teamId: string;
  count: number;
  matched: CanonicalTeam;
};

export type GameLeagueInterest = {
  away: SideInterest | null;
  home: SideInterest | null;
  combined: number;
  bothSides: boolean;
};

/**
 * One RPC: active human memberships ∩ favorite rows for sport.
 * Empty map if unauthorized, wrong sport, or no favorites.
 */
export async function loadLeagueFavoriteTeamCounts(
  sportId: SportId | string = "cfb",
  leagueId?: string | null
): Promise<LeagueFavoriteCounts> {
  if (!hasSupabaseConfig()) return {};
  const lid = leagueId || getSession()?.leagueId || getLeague()?.id;
  if (!lid || !sportId) return {};
  // Local UI gate — server still enforces commissioner/deputy
  if (!isActuallyOps()) return {};

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "get_league_favorite_team_counts",
      {
        p_league_id: lid,
        p_sport_id: sportId,
      }
    );
    if (error) {
      if (
        /relation|does not exist|schema cache|function|not authorized|Not authorized/i.test(
          error.message || ""
        )
      ) {
        return {};
      }
      console.warn("loadLeagueFavoriteTeamCounts", error.message);
      return {};
    }
    const out: LeagueFavoriteCounts = {};
    for (const row of (data as { team_id?: string; supporter_count?: number }[]) ||
      []) {
      const id = (row.team_id || "").trim();
      const n = Number(row.supporter_count) || 0;
      if (!id || id === NO_TEAM_ID || n <= 0) continue;
      out[id] = n;
    }
    return out;
  } catch (e) {
    console.warn("loadLeagueFavoriteTeamCounts failed", e);
    return {};
  }
}

/** Confident catalog match for the current sport only. */
export function matchScheduleTeamForSport(
  rawName: string,
  sportId: SportId | string
): CanonicalTeam | null {
  if (sportId === "cfb") return matchCfbTeamConfident(rawName);
  // NFL catalog not in Phase 1
  return null;
}

export function resolveGameLeagueInterest(
  game: Pick<Game, "awayTeam" | "homeTeam">,
  counts: LeagueFavoriteCounts,
  sportId: SportId | string
): GameLeagueInterest {
  const empty: GameLeagueInterest = {
    away: null,
    home: null,
    combined: 0,
    bothSides: false,
  };
  if (!counts || !Object.keys(counts).length) return empty;
  if (sportId !== "cfb") return empty;

  const awayMatch = matchScheduleTeamForSport(game.awayTeam, sportId);
  const homeMatch = matchScheduleTeamForSport(game.homeTeam, sportId);

  const away =
    awayMatch && counts[awayMatch.id]
      ? {
          teamId: awayMatch.id,
          count: counts[awayMatch.id],
          matched: awayMatch,
        }
      : null;
  const home =
    homeMatch && counts[homeMatch.id]
      ? {
          teamId: homeMatch.id,
          count: counts[homeMatch.id],
          matched: homeMatch,
        }
      : null;

  return {
    away,
    home,
    combined: (away?.count || 0) + (home?.count || 0),
    bothSides: !!(away && home),
  };
}

/**
 * Sort: both sides → highest combined → one side → none.
 * Stable for equal interest (kickoff then id).
 */
export function sortGamesByLeagueInterest<T extends Game>(
  games: T[],
  counts: LeagueFavoriteCounts,
  sportId: SportId | string
): T[] {
  const scored = games.map((g, index) => {
    const interest = resolveGameLeagueInterest(g, counts, sportId);
    return { g, index, interest };
  });
  scored.sort((a, b) => {
    const ai = a.interest;
    const bi = b.interest;
    if (ai.bothSides !== bi.bothSides) return ai.bothSides ? -1 : 1;
    if (ai.combined !== bi.combined) return bi.combined - ai.combined;
    const aOne = (ai.away ? 1 : 0) + (ai.home ? 1 : 0);
    const bOne = (bi.away ? 1 : 0) + (bi.home ? 1 : 0);
    if (aOne !== bOne) return bOne - aOne;
    const at = a.g.commenceTime || a.g.startTime || "";
    const bt = b.g.commenceTime || b.g.startTime || "";
    if (at !== bt) return at.localeCompare(bt);
    return a.index - b.index;
  });
  return scored.map((x) => x.g);
}

export function leagueInterestBadgeLabel(
  interest: GameLeagueInterest
): string | null {
  if (interest.combined <= 0) return null;
  if (interest.bothSides) {
    return `BOTH SIDES REPRESENTED · ${interest.combined} INTERESTED`;
  }
  const n = interest.away?.count || interest.home?.count || 0;
  return `LEAGUE FAVORITE · ${n}`;
}
