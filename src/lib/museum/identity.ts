/**
 * Stable game identity for Museum snapshots / events / final scores.
 * Never use mutable card_games.id as the sole key.
 */

import type { Game } from "@/lib/types";
import {
  matchCfbTeamConfident,
  type CanonicalTeam,
} from "@/lib/teams/cfb-catalog";
import type { SportId } from "@/lib/sports/types";

export function buildGameIdentityKey(opts: {
  providerGameId?: string | null;
  awayTeamId?: string | null;
  homeTeamId?: string | null;
}): string | null {
  const provider = (opts.providerGameId || "").trim();
  if (provider) return provider;
  const a = (opts.awayTeamId || "").trim();
  const h = (opts.homeTeamId || "").trim();
  if (a && h) return `${a}|${h}`;
  return null;
}

export function matchCanonicalTeamForSport(
  rawName: string,
  sportId: SportId | string
): CanonicalTeam | null {
  if (sportId === "cfb") return matchCfbTeamConfident(rawName);
  // NFL / other packs: no confident catalog in Phase 1A
  return null;
}

export type ResolvedCardGameTeams = {
  awayTeamId: string;
  homeTeamId: string;
  awayTeamName: string;
  homeTeamName: string;
  awayMatched: CanonicalTeam;
  homeMatched: CanonicalTeam;
};

/**
 * Both sides must match confidently. Uncertain matches return null
 * (game excluded from Fan Favorite Rivalry candidacy).
 */
export function resolveCardGameTeams(
  game: Pick<Game, "awayTeam" | "homeTeam">,
  sportId: SportId | string
): ResolvedCardGameTeams | null {
  const awayMatched = matchCanonicalTeamForSport(game.awayTeam, sportId);
  const homeMatched = matchCanonicalTeamForSport(game.homeTeam, sportId);
  if (!awayMatched || !homeMatched) return null;
  if (awayMatched.id === homeMatched.id) return null;
  return {
    awayTeamId: awayMatched.id,
    homeTeamId: homeMatched.id,
    awayTeamName: awayMatched.name,
    homeTeamName: homeMatched.name,
    awayMatched,
    homeMatched,
  };
}

/** Card underdog for spread-upset rule (Phase 1B). Null if no clear favorite. */
export function underdogSideFromCard(
  favorite: "home" | "away" | null | undefined
): "home" | "away" | null {
  if (favorite === "home") return "away";
  if (favorite === "away") return "home";
  return null;
}

/**
 * Spread upset (Phase 1B definition, pure helper — not used for generation yet):
 * underdog on the published card wins outright.
 */
export function isSpreadUpsetOutright(opts: {
  cardFavorite: "home" | "away" | null;
  awayScore: number;
  homeScore: number;
}): boolean {
  if (!opts.cardFavorite) return false;
  if (opts.awayScore === opts.homeScore) return false;
  const outrightWinner: "home" | "away" =
    opts.homeScore > opts.awayScore ? "home" : "away";
  const dog = underdogSideFromCard(opts.cardFavorite);
  return dog != null && dog === outrightWinner;
}

export function providerGameIdFromGame(game: Game): string | null {
  const id = (game.oddsEventId || "").trim();
  // Reject app-local UUIDs accidentally stored as odds id when they look empty
  return id || null;
}
