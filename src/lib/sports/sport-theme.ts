/**
 * Full-app sport skin — default look per pack.
 * CFB = stock green tokens (no data-sport).
 * NFL = primetime navy/crimson (data-sport=nfl).
 * WWC = Brazil palette (data-sport=soccer_wwc) when live again.
 *
 * Holiday / season themes (Halloween, etc.) still apply on top:
 * SeasonThemeApplier sets data-season-theme; CSS for seasons is loaded
 * AFTER sport skins so holidays win when chosen.
 */

import { normalizeSportId } from "./registry";
import type { SportId } from "./types";

export const SPORT_THEME_EVENT = "warroom-sport-theme";

const LEAGUE_KEY = "warroom-league";
/** After create: cloud rehydrate can briefly return DB default cfb — pin the host's pick. */
const FORCE_SPORT_KEY = "warroom-force-league-sport-v1";
const FORCE_SPORT_MS = 120_000;

type ForceSport = {
  leagueId: string;
  sportId: string;
  until: number;
};

function readForceSport(): ForceSport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORCE_SPORT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ForceSport;
    if (!p?.leagueId || !p?.sportId || !p?.until) return null;
    if (Date.now() > p.until) {
      sessionStorage.removeItem(FORCE_SPORT_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

/**
 * Pin sport for a league after create/join so async cloud sync cannot
 * flash CFB green over NFL red (DB default sport_id = cfb).
 */
export function pinLeagueSport(
  leagueId: string,
  sportId: string | null | undefined
): void {
  if (typeof window === "undefined" || !leagueId) return;
  const id = normalizeSportId(sportId);
  try {
    const payload: ForceSport = {
      leagueId,
      sportId: id,
      until: Date.now() + FORCE_SPORT_MS,
    };
    sessionStorage.setItem(FORCE_SPORT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  // Keep local league row in sync
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return;
    const lg = JSON.parse(raw) as {
      id?: string;
      sportId?: string;
      settings?: { crystalBallEnabled?: boolean };
    };
    if (lg.id === leagueId) {
      lg.sportId = id;
      if (id === "nfl" && lg.settings) {
        lg.settings.crystalBallEnabled = false;
      }
      localStorage.setItem(LEAGUE_KEY, JSON.stringify(lg));
    }
  } catch {
    /* ignore */
  }
}

/** If this league has a create pin, return that sport (else null). */
export function forcedSportForLeague(
  leagueId: string | null | undefined
): SportId | null {
  if (!leagueId) return null;
  const f = readForceSport();
  if (!f || f.leagueId !== leagueId) return null;
  return normalizeSportId(f.sportId);
}

export function getLeagueSportIdFromLocal(): SportId {
  if (typeof window === "undefined") return "cfb";
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return "cfb";
    const lg = JSON.parse(raw) as { id?: string; sportId?: string };
    const forced = forcedSportForLeague(lg?.id);
    if (forced) return forced;
    return normalizeSportId(lg?.sportId);
  } catch {
    return "cfb";
  }
}

/**
 * Paint sport default skin on <html data-sport="…">.
 * Does not clear holiday themes — those are a separate attribute.
 */
export function applySportTheme(sportId: string | null | undefined) {
  if (typeof document === "undefined") return;
  // Honor create pin over a stale argument (e.g. cloud returned cfb)
  let id = normalizeSportId(sportId);
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (raw) {
      const lg = JSON.parse(raw) as { id?: string };
      const forced = forcedSportForLeague(lg?.id);
      if (forced) id = forced;
    }
  } catch {
    /* use id */
  }
  const root = document.documentElement;

  if (id === "nfl") {
    root.setAttribute("data-sport", "nfl");
  } else if (id === "soccer_wwc") {
    root.setAttribute("data-sport", "soccer_wwc");
  } else {
    // CFB and others → college default tokens
    root.removeAttribute("data-sport");
  }

  try {
    window.dispatchEvent(
      new CustomEvent(SPORT_THEME_EVENT, { detail: id })
    );
  } catch {
    /* ignore */
  }
}

export function reapplySportThemeFromLocal() {
  applySportTheme(getLeagueSportIdFromLocal());
}
