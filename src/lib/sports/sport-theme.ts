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
 * Sport stamps: local presentation memory only.
 * After league creation, Supabase `leagues.sport_id` is authoritative.
 * Stamps must follow cloud on disagreement — never the reverse via UPDATE.
 */

import { normalizeSportId } from "./registry";
import type { SportId } from "./types";

export const SPORT_THEME_EVENT = "warroom-sport-theme";

const LEAGUE_KEY = "warroom-league";
/** After create: cloud rehydrate can briefly return DB default cfb — pin the host's pick. */
const FORCE_SPORT_KEY = "warroom-force-league-sport-v1";
const FORCE_SPORT_MS = 120_000;
/**
 * Durable map: leagueId → last known sport (presentation only).
 * Survives logout. When cloud sport_id is present it always wins and
 * overwrites the stamp — never the reverse.
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
 * Local presentation stamp only. Never writes Supabase.
 * Call when cloud returns a sport, after create INSERT, or on join/switch.
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
    cloudConfirmed: !!(opts?.cloudConfirmed || prev?.cloudConfirmed || id !== "cfb"),
    updatedAt: Date.now(),
  };
  writeStamps(map);
}

/**
 * Safe diagnostic when cloud and local sport disagree.
 * Cloud wins; local is corrected by resolveLeagueSportId.
 * No PII, no Supabase writes, no player-blocking UI.
 */
export function logSportMismatch(detail: {
  leagueId: string;
  cloudSport: string;
  localSport?: string | null;
  source?: string;
}): void {
  if (typeof console === "undefined" || !console.info) return;
  try {
    const lid =
      detail.leagueId.length > 12
        ? `${detail.leagueId.slice(0, 8)}…`
        : detail.leagueId;
    console.info("[warroom-sport-mismatch]", {
      leagueId: lid,
      cloud: detail.cloudSport,
      local: detail.localSport || null,
      source: detail.source || "resolve",
      action: "cloud_wins_no_write",
    });
  } catch {
    /* ignore */
  }
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
 * Resolve a league’s sport for UI/session.
 *
 * PRODUCT LAW: When Supabase `leagues.sport_id` is present (including `cfb`),
 * it is authoritative. Local stamps / create-pins must never overwrite cloud
 * merely because they disagree — and this function never writes Supabase.
 *
 * Priority when cloud present: cloud (always).
 * When cloud missing/null: create force-pin → durable stamp → local → cfb.
 */
export function resolveLeagueSportId(opts: {
  leagueId: string;
  cloudSportId?: string | null;
  localSportId?: string | null;
}): SportId {
  const leagueId = opts.leagueId;
  if (!leagueId) return "cfb";

  const cloudRaw =
    typeof opts.cloudSportId === "string" ? opts.cloudSportId.trim() : "";
  const cloud = cloudRaw ? normalizeSportId(cloudRaw) : null;

  const localRaw =
    typeof opts.localSportId === "string" ? opts.localSportId.trim() : "";
  const local = localRaw ? normalizeSportId(localRaw) : null;
  const stampedBefore = stampedSportForLeague(leagueId);

  // Cloud present (cfb OR nfl OR other) → always wins; correct stale local stamps.
  if (cloud) {
    const stale =
      (local && local !== cloud) ||
      (stampedBefore && stampedBefore !== cloud);
    if (stale) {
      logSportMismatch({
        leagueId,
        cloudSport: cloud,
        localSport: local || stampedBefore,
        source: "resolveLeagueSportId",
      });
    }
    stampLeagueSport(leagueId, cloud, { cloudConfirmed: true });
    return cloud;
  }

  // Cloud unavailable — presentation-only fallbacks. Never invent a cloud write.
  const forced = forcedSportForLeague(leagueId);
  if (forced) {
    stampLeagueSport(leagueId, forced, { cloudConfirmed: false });
    return forced;
  }

  if (stampedBefore) return stampedBefore;

  if (local) {
    stampLeagueSport(leagueId, local, { cloudConfirmed: false });
    return local;
  }

  return "cfb";
}

/**
 * Pin sport after authorized create INSERT (local only).
 * Does not UPDATE Supabase — sport must already be correct on the new row.
 */
export function pinLeagueSport(
  leagueId: string,
  sportId: string | null | undefined
): void {
  if (!canUse() || !leagueId) return;
  const id = normalizeSportId(sportId);
  stampLeagueSport(leagueId, id, { cloudConfirmed: true });
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

  // What apply would paint on <html data-sport>
  const nextAttr =
    id === "nfl" ? "nfl" : id === "soccer_wwc" ? "soccer_wwc" : null;
  const currentAttr = root.getAttribute("data-sport");
  // CFB / default = attribute absent; treat empty/other as not nfl/wwc
  const alreadyApplied =
    nextAttr === null
      ? currentAttr !== "nfl" && currentAttr !== "soccer_wwc"
      : currentAttr === nextAttr;

  if (alreadyApplied) {
    // DOM already correct — do not re-dispatch (blocks recursive listeners)
    return;
  }

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
