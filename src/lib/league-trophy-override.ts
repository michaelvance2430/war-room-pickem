/**
 * Per-league championship hardware overrides.
 *
 * Default NFL rooms → standard Super Bowl (Lombardi) art.
 * Vonnaggio Family Vacation ONLY → the gold family form the room posted.
 */

import { getLeague } from "@/lib/league";

/**
 * Gold family hardware (user-posted trophy, cut out).
 * Cache-bust query so deploys don't keep serving old Lombardi from CDN/browser.
 */
export const VONNAGGIO_CHAMPIONSHIP_IMG =
  "/trophies/vonnaggio-championship.png?v=gold3";

export const NFL_LOMBARDI_IMG = "/trophies/nfl-lombardi.jpg";

/**
 * Match this room by name (case-insensitive).
 * Covers Vonnaggio / Vonnagio / Family Vacation.
 */
const VONNAGGIO_NAME_RE =
  /vonnaggi?o|family\s*vacation|vonnaggi?o\s*family/i;

/** Optional explicit league ids (fill in if name ever changes). */
const VONNAGGIO_LEAGUE_IDS = new Set<string>([
  // e.g. "uuid-here" if name is renamed later
]);

export type LeagueTrophyOverride = {
  /** Championship image (transparent PNG preferred) */
  championshipImg: string;
  /** Short hardware label under art */
  hardwareLabel: string;
  /** Share / plaque subtitle flavor */
  hardwareName: string;
  /** Gold glow vs silver */
  glow: "gold" | "silver";
};

export function isVonnaggioLeague(
  leagueName?: string | null,
  leagueId?: string | null
): boolean {
  const name = (leagueName ?? "").trim();
  const id = (leagueId ?? "").trim();
  if (id && VONNAGGIO_LEAGUE_IDS.has(id)) return true;
  if (name && VONNAGGIO_NAME_RE.test(name)) return true;
  return false;
}

/**
 * Resolve championship art for the active (or given) league.
 * Only NFL + Vonnaggio → gold form. Every other NFL room → Lombardi.
 */
export function resolveLeagueChampionshipOverride(opts?: {
  sportId?: string | null;
  leagueName?: string | null;
  leagueId?: string | null;
}): LeagueTrophyOverride | null {
  const league = typeof window !== "undefined" ? getLeague() : null;
  const sport = opts?.sportId ?? league?.sportId ?? null;
  // NFL only — never put the gold form on CFB hardware
  if (sport && sport !== "nfl") return null;

  const name = opts?.leagueName ?? league?.name;
  const id = opts?.leagueId ?? league?.id;
  if (!isVonnaggioLeague(name, id)) return null;

  // Name matched but sport unknown: only apply if active league is NFL
  if (!sport && league?.sportId && league.sportId !== "nfl") return null;

  return {
    championshipImg: VONNAGGIO_CHAMPIONSHIP_IMG,
    hardwareLabel: "Vonnaggio championship trophy",
    hardwareName: "Family Vacation hardware",
    glow: "gold",
  };
}

/** Image path for NFL championship — override or standard Lombardi. */
export function nflChampionshipTrophySrc(opts?: {
  leagueName?: string | null;
  leagueId?: string | null;
}): string {
  const o = resolveLeagueChampionshipOverride({
    sportId: "nfl",
    leagueName: opts?.leagueName,
    leagueId: opts?.leagueId,
  });
  return o?.championshipImg ?? NFL_LOMBARDI_IMG;
}
