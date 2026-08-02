/**
 * Full-app sport skin — default look per pack.
 * CFB = stock green tokens (no data-sport).
 * NFL = primetime navy/crimson (data-sport=nfl).
 * WWC = Brazil palette (data-sport=soccer_wwc) when live again.
 *
 * Holiday / season themes (Halloween, etc.) still apply on top:
 * SeasonThemeApplier sets data-season-theme; CSS for seasons is loaded
 * AFTER sport skins so holidays win when chosen.
 *
 * Sport stamps: durable per-leagueId memory so logout / cloud default `cfb`
 * cannot make an NFL room vanish from the NFL desk or paint the wrong skin.
 */

import { normalizeSportId } from "./registry";
import type { SportId } from "./types";

export const SPORT_THEME_EVENT = "warroom-sport-theme";

const LEAGUE_KEY = "warroom-league";
/** After create: cloud rehydrate can briefly return DB default cfb — pin the host's pick. */
const FORCE_SPORT_KEY = "warroom-force-league-sport-v1";
const FORCE_SPORT_MS = 120_000;
/**
 * Durable map: leagueId → last known sport.
 * Survives logout. Cloud non-cfb always wins; cloud cfb cannot clobber a
 * stamped non-cfb until cloud itself returns that non-cfb (or host re-creates).
 */
const STAMPS_KEY = "warroom-league-sport-stamps-v1";

type ForceSport = {
  leagueId: string;
  sportId: string;
  until: number;
};

type SportStamp = {
  sportId: string;
  /** True once cloud SELECT returned this non-cfb value for the league */
  cloudConfirmed: boolean;
  updatedAt: number;
};

type StampMap = Record<string, SportStamp>;

function canUse(): boolean {
  return typeof window !== "undefined";
}

function readForceSport(): ForceSport | null {
  if (!canUse()) return null;
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

function readStamps(): StampMap {
  if (!canUse() || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STAMPS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as StampMap;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeStamps(map: StampMap) {
  if (!canUse() || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STAMPS_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

/**
 * Durable stamp for a league. Call on create, join, switch, and whenever
 * cloud returns a definitive non-cfb sport_id.
 */
export function stampLeagueSport(
  leagueId: string,
  sportId: string | null | undefined,
  opts?: { cloudConfirmed?: boolean }
): void {
  if (!canUse() || !leagueId) return;
  const id = normalizeSportId(sportId);
  const map = readStamps();
  const prev = map[leagueId];
  map[leagueId] = {
    sportId: id,
    // Non-cfb stamps are trusted across logout (create/join/switch/cloud)
    cloudConfirmed:
      id !== "cfb"
        ? true
        : !!(opts?.cloudConfirmed || prev?.cloudConfirmed),
    updatedAt: Date.now(),
  };
  writeStamps(map);
}

export function stampedSportForLeague(
  leagueId: string | null | undefined
): SportId | null {
  if (!leagueId) return null;
  const s = readStamps()[leagueId];
  if (!s?.sportId) return null;
  return normalizeSportId(s.sportId);
}

export function stampCloudConfirmed(
  leagueId: string | null | undefined
): boolean {
  if (!leagueId) return false;
  return !!readStamps()[leagueId]?.cloudConfirmed;
}

/**
 * Single source of truth for a league's sport.
 * Priority: create pin → cloud non-cfb → durable stamp (non-cfb) → cloud/local → cfb.
 */
export function resolveLeagueSportId(opts: {
  leagueId: string;
  cloudSportId?: string | null;
  localSportId?: string | null;
}): SportId {
  const leagueId = opts.leagueId;
  if (!leagueId) return "cfb";

  const forced = forcedSportForLeague(leagueId);
  if (forced) {
    stampLeagueSport(leagueId, forced, { cloudConfirmed: false });
    return forced;
  }

  const cloudRaw =
    typeof opts.cloudSportId === "string" ? opts.cloudSportId.trim() : "";
  const cloud = cloudRaw ? normalizeSportId(cloudRaw) : null;

  // Cloud has an explicit non-cfb value — trust & stamp forever
  if (cloud && cloud !== "cfb") {
    stampLeagueSport(leagueId, cloud, { cloudConfirmed: true });
    return cloud;
  }

  const stamped = stampedSportForLeague(leagueId);
  if (stamped && stamped !== "cfb") {
    // Cloud missing or still default cfb — keep NFL/WWC stamp
    return stamped;
  }

  const localRaw =
    typeof opts.localSportId === "string" ? opts.localSportId.trim() : "";
  const local = localRaw ? normalizeSportId(localRaw) : null;
  if (local && local !== "cfb") {
    stampLeagueSport(leagueId, local, { cloudConfirmed: false });
    return local;
  }

  if (cloud) return cloud;
  if (local) return local;
  return "cfb";
}

/**
 * If local stamp says non-cfb but cloud still has cfb, push the stamp up.
 * Best-effort; never blocks UI.
 */
export async function reassertLeagueSportToCloud(
  leagueId: string,
  sportId: SportId
): Promise<void> {
  if (!leagueId || sportId === "cfb") return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("leagues")
      .update({
        sport_id: sportId,
        // Crystal Ball is CFB pride pick; NFL uses Super Bowl pride (still bool column)
        crystal_ball_enabled: true,
      })
      .eq("id", leagueId);
    if (!error) {
      stampLeagueSport(leagueId, sportId, { cloudConfirmed: true });
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Pin sport for a league after create/join so async cloud sync cannot
 * flash CFB green over NFL red (DB default sport_id = cfb).
 * Also writes durable stamp (survives logout).
 */
export function pinLeagueSport(
  leagueId: string,
  sportId: string | null | undefined
): void {
  if (!canUse() || !leagueId) return;
  const id = normalizeSportId(sportId);
  stampLeagueSport(leagueId, id, { cloudConfirmed: id !== "cfb" });
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
  // Keep local league row in sync when it's this room
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
      if (!lg.settings) lg.settings = {};
      // Default pride pick on for every sport; League Build can turn off
      if (lg.settings.crystalBallEnabled === undefined) {
        lg.settings.crystalBallEnabled = true;
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
  if (!canUse()) return "cfb";
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return "cfb";
    const lg = JSON.parse(raw) as { id?: string; sportId?: string };
    if (!lg?.id) return normalizeSportId(lg?.sportId);
    return resolveLeagueSportId({
      leagueId: lg.id,
      localSportId: lg.sportId,
    });
  } catch {
    return "cfb";
  }
}

/**
 * Paint sport default skin on <html data-sport="…">.
 * Does not clear holiday themes — those are a separate attribute.
 * Always driven by the ACTIVE league only (never a global sticky NFL).
 */
export function applySportTheme(sportId: string | null | undefined) {
  if (typeof document === "undefined") return;
  let id = normalizeSportId(sportId);
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (raw) {
      const lg = JSON.parse(raw) as { id?: string; sportId?: string };
      if (lg?.id) {
        id = resolveLeagueSportId({
          leagueId: lg.id,
          localSportId: sportId || lg.sportId,
        });
      }
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
