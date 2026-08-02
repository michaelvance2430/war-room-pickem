/**
 * Per-league championship hardware overrides.
 *
 * Default NFL rooms → standard Super Bowl (Lombardi) art.
 * Vonnagio Family Vacay ONLY → the gold family form the room posted.
 *
 * Match order (any hit = gold):
 *  1) Invite code HAT42A (stable even if name renames)
 *  2) League id pin (optional)
 *  3) Name: Vonnagio / Vonnaggio / Family Vacay / Family Vacation
 */

import { getLeague } from "@/lib/league";

/**
 * Gold family hardware (user-posted trophy).
 * Bump ?v= when the binary changes so CDN/browser cannot keep Lombardi.
 */
export const VONNAGGIO_CHAMPIONSHIP_IMG =
  "/trophies/vonnaggio-championship.jpg?v=gold5";

export const NFL_LOMBARDI_IMG = "/trophies/nfl-lombardi.jpg";

/** Live invite code from the app (screenshot) — never rely on name alone. */
export const VONNAGIO_INVITE_CODES = new Set(
  ["HAT42A", "hat42a"].map((c) => c.toUpperCase())
);

/**
 * Match this room by name (case-insensitive, emoji-stripped).
 * Live room title: "Vonnagio Family Vacay"
 */
const VONNAGGIO_NAME_RE =
  /vonnagg?io|family\s*vac(?:ay|ation)|vonnagg?io\s*family/i;

/** Optional explicit league UUIDs if code/name ever change. */
const VONNAGGIO_LEAGUE_IDS = new Set<string>([]);

export type LeagueTrophyOverride = {
  championshipImg: string;
  hardwareLabel: string;
  hardwareName: string;
  glow: "gold" | "silver";
};

function stripDecor(s: string): string {
  return (s || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVonnaggioLeague(
  leagueName?: string | null,
  leagueId?: string | null,
  leagueCode?: string | null
): boolean {
  const code = (leagueCode ?? "").trim().toUpperCase();
  if (code && VONNAGIO_INVITE_CODES.has(code)) return true;

  const id = (leagueId ?? "").trim();
  if (id && VONNAGGIO_LEAGUE_IDS.has(id)) return true;

  const name = stripDecor(leagueName ?? "");
  if (name && VONNAGGIO_NAME_RE.test(name)) return true;

  return false;
}

/**
 * Resolve championship art for the active (or given) league.
 * Only NFL + Vonnagio → gold form. Every other NFL room → Lombardi.
 */
export function resolveLeagueChampionshipOverride(opts?: {
  sportId?: string | null;
  leagueName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
}): LeagueTrophyOverride | null {
  const league =
    typeof window !== "undefined" ? getLeague() : null;

  const name = opts?.leagueName ?? league?.name ?? null;
  const id = opts?.leagueId ?? league?.id ?? null;
  const code = opts?.leagueCode ?? league?.code ?? null;

  // Invite code / name first — HAT42A is the hard pin
  if (!isVonnaggioLeague(name, id, code)) return null;

  const sport = opts?.sportId ?? league?.sportId ?? null;
  // Only reject when we *know* this is a CFB room — never block on missing sport
  if (sport === "cfb") return null;

  return {
    championshipImg: VONNAGGIO_CHAMPIONSHIP_IMG,
    hardwareLabel: "Vonnagio championship trophy",
    hardwareName: "Family Vacay hardware",
    glow: "gold",
  };
}

/** Image path for NFL championship — override or standard Lombardi. */
export function nflChampionshipTrophySrc(opts?: {
  leagueName?: string | null;
  leagueId?: string | null;
  leagueCode?: string | null;
}): string {
  const o = resolveLeagueChampionshipOverride({
    sportId: "nfl",
    leagueName: opts?.leagueName,
    leagueId: opts?.leagueId,
    leagueCode: opts?.leagueCode,
  });
  return o?.championshipImg ?? NFL_LOMBARDI_IMG;
}
