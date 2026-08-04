/**
 * Lightweight session / league READS only.
 *
 * CRITICAL: Do NOT import @/lib/store or @/lib/badges here.
 * Profile route (and other identity-first surfaces) must stay off the
 * badges catalog module graph. Full league helpers stay in @/lib/league.
 */

export type LightLeagueSettings = {
  cutPercent: number;
  regularSeasonWeeks: number;
  gamesPerWeek: number;
  crystalBallEnabled: boolean;
  homeTaglineId: string;
  homeTaglineCustom: string;
  seasonThemeId: string;
};

export type LightLeague = {
  id: string;
  name: string;
  code: string;
  commissionerId: string;
  createdAt: string;
  settings: LightLeagueSettings;
  sportId?: string;
};

export type LightSession = {
  playerId: string;
  playerName: string;
  isCommissioner: boolean;
  isModerator?: boolean;
  isDeputy?: boolean;
  leagueId: string;
};

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";

const DEFAULT_SETTINGS: LightLeagueSettings = {
  cutPercent: 50,
  regularSeasonWeeks: 18,
  gamesPerWeek: 5,
  crystalBallEnabled: true,
  homeTaglineId: "good-teams",
  homeTaglineCustom: "",
  seasonThemeId: "default",
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Active league from localStorage — no store/badges. */
export function readLeague(): LightLeague | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return null;
    const league = JSON.parse(raw) as LightLeague;
    league.settings = { ...DEFAULT_SETTINGS, ...(league.settings || {}) };
    return league;
  } catch {
    return null;
  }
}

/** Session from localStorage — no store/badges. */
export function readSession(): LightSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LightSession) : null;
  } catch {
    return null;
  }
}
