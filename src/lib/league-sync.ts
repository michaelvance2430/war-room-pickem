import { createClient } from "@/lib/supabase/client";
import {
  League,
  LeagueSettings,
  getLeague,
  getSession,
} from "@/lib/league";
import { SEASON_MAX_WEEK } from "@/lib/season-calendar";

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readPrevLocalLeague(): League | null {
  if (!canUseStorage()) return null;
  try {
    return JSON.parse(localStorage.getItem(LEAGUE_KEY) || "null") as League | null;
  } catch {
    return null;
  }
}

function toLocalLeague(row: {
  id: string;
  name: string;
  code: string;
  commissioner_id: string;
  created_at: string;
  cut_percent: number;
  regular_season_weeks: number;
  games_per_week: number;
  crystal_ball_enabled?: boolean | null;
  home_tagline_id?: string | null;
  home_tagline_custom?: string | null;
  season_theme_id?: string | null;
  championship_trophy_id?: string | null;
  sport_id?: string | null;
}): League {
  const prev = readPrevLocalLeague();
  const sameRoom = !!prev?.id && prev.id === row.id;

  // Cloud sport_id is authoritative when present. Never UPDATE leagues here.
  let sportId = "cfb";
  try {
    const { resolveLeagueSportId } = require("./sports/sport-theme") as typeof import("./sports/sport-theme");
    const cloudSport =
      typeof row.sport_id === "string" && row.sport_id.trim()
        ? row.sport_id.trim()
        : null;
    const localSport =
      sameRoom && prev?.sportId
        ? prev.sportId
        : prev?.id === row.id
          ? prev?.sportId
          : null;
    sportId = resolveLeagueSportId({
      leagueId: row.id,
      cloudSportId: cloudSport,
      localSportId: localSport,
    });
  } catch {
    if (typeof row.sport_id === "string" && row.sport_id.trim()) {
      sportId = row.sport_id.trim();
    } else if (sameRoom && prev?.sportId) {
      sportId = prev.sportId;
    }
  }

  // Prefer cloud flag; if column missing from select, keep prior local value.
  // Product default: CFB + NFL pride pick ON when the column is absent.
  // Never invent false for NFL solely because sport is non-cfb.
  let crystalBallEnabled =
    sportId === "cfb" || sportId === "nfl" || sportId === "march_madness";
  let homeTaglineId = "good-teams";
  let homeTaglineCustom = "";
  let seasonThemeId = "default";
  if (typeof row.crystal_ball_enabled === "boolean") {
    crystalBallEnabled = row.crystal_ball_enabled;
  } else if (sameRoom) {
    if (typeof prev?.settings?.crystalBallEnabled === "boolean") {
      crystalBallEnabled = prev.settings.crystalBallEnabled;
    }
    if (prev?.settings?.homeTaglineId) {
      homeTaglineId = prev.settings.homeTaglineId;
    }
    if (typeof prev?.settings?.homeTaglineCustom === "string") {
      homeTaglineCustom = prev.settings.homeTaglineCustom;
    }
    if (prev?.settings?.seasonThemeId) {
      seasonThemeId = prev.settings.seasonThemeId;
    }
  }

  if (typeof row.home_tagline_id === "string" && row.home_tagline_id) {
    homeTaglineId = row.home_tagline_id;
  }
  if (typeof row.home_tagline_custom === "string") {
    homeTaglineCustom = row.home_tagline_custom;
  }
  if (typeof row.season_theme_id === "string" && row.season_theme_id) {
    seasonThemeId = row.season_theme_id;
  } else if (sameRoom && prev?.settings?.seasonThemeId) {
    seasonThemeId = prev.settings.seasonThemeId;
  }

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    commissionerId: row.commissioner_id,
    createdAt: row.created_at,
    sportId,
    settings: {
      cutPercent: row.cut_percent ?? 50,
      // Fixed CFB calendar — never trust a short value from the DB
      regularSeasonWeeks: SEASON_MAX_WEEK,
      gamesPerWeek: row.games_per_week ?? 5,
      crystalBallEnabled,
      homeTaglineId,
      homeTaglineCustom,
      seasonThemeId,
      championshipTrophyId: row.championship_trophy_id || null,
    },
  };
}

const LEAGUE_FETCH_TTL_MS = 25_000;
const leagueFetchCache = new Map<
  string,
  { at: number; league: League | null }
>();
const leagueFetchInflight = new Map<string, Promise<League | null>>();

/** Load league from Supabase by id and cache in localStorage */
export async function fetchLeagueFromCloud(
  leagueId: string
): Promise<League | null> {
  const hit = leagueFetchCache.get(leagueId);
  if (hit && Date.now() - hit.at < LEAGUE_FETCH_TTL_MS) return hit.league;

  const inflight = leagueFetchInflight.get(leagueId);
  if (inflight) return inflight;

  const promise = (async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("id", leagueId)
      .single();

    if (error || !data) {
      leagueFetchCache.set(leagueId, { at: Date.now(), league: null });
      return null;
    }

    const league = toLocalLeague(data);
    if (canUseStorage()) {
      localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
    }
    leagueFetchCache.set(leagueId, { at: Date.now(), league });
    return league;
  })().finally(() => {
    leagueFetchInflight.delete(leagueId);
  });

  leagueFetchInflight.set(leagueId, promise);
  return promise;
}

/** Refresh current session league from Supabase */
export async function syncLeagueFromCloud(): Promise<League | null> {
  const session = getSession();
  if (!session?.leagueId) return getLeague();
  return fetchLeagueFromCloud(session.leagueId);
}

/** Drop league cloud cache (after settings save / switch). */
export function invalidateLeagueCloudCache(leagueId?: string | null) {
  if (!leagueId) {
    leagueFetchCache.clear();
    leagueFetchInflight.clear();
    return;
  }
  leagueFetchCache.delete(leagueId);
  leagueFetchInflight.delete(leagueId);
}

/** Push name + settings to Supabase and update local cache */
export async function saveLeagueToCloud(opts: {
  name?: string;
  settings?: Partial<LeagueSettings>;
  code?: string;
}): Promise<{ ok: boolean; league?: League; error?: string }> {
  const local = getLeague();
  const session = getSession();
  if (!local || !session?.leagueId) {
    return { ok: false, error: "No league loaded" };
  }
  if (!session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can change settings" };
  }

  invalidateLeagueCloudCache(session.leagueId);
  const supabase = createClient();
  /**
   * Whitelist only — never include sport_id, commissioner_id, current_week,
   * or other identity/config that must not change via general settings saves.
   */
  const patch: Record<string, unknown> = {};
  if (opts.name !== undefined) patch.name = opts.name.trim() || local.name;
  if (opts.code !== undefined) patch.code = opts.code;
  if (opts.settings?.cutPercent !== undefined)
    patch.cut_percent = opts.settings.cutPercent;
  // Season length is fixed at SEASON_MAX_WEEK in the app — do not write
  // regular_season_weeks (old DB check max 16 blocked saves; app ignores column).
  if (opts.settings?.gamesPerWeek !== undefined)
    patch.games_per_week = opts.settings.gamesPerWeek;
  if (opts.settings?.crystalBallEnabled !== undefined)
    patch.crystal_ball_enabled = opts.settings.crystalBallEnabled;
  if (opts.settings?.homeTaglineId !== undefined)
    patch.home_tagline_id = opts.settings.homeTaglineId;
  if (opts.settings?.homeTaglineCustom !== undefined)
    patch.home_tagline_custom = opts.settings.homeTaglineCustom;
  if (opts.settings?.seasonThemeId !== undefined)
    patch.season_theme_id = opts.settings.seasonThemeId;
  if (opts.settings?.championshipTrophyId !== undefined)
    patch.championship_trophy_id = opts.settings.championshipTrophyId;

  // Defense in depth: strip any accidental sport / identity fields
  delete patch.sport_id;
  delete patch.commissioner_id;
  delete patch.current_week;
  delete patch.regular_season_weeks;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to save" };
  }

  let { data, error } = await supabase
    .from("leagues")
    .update(patch)
    .eq("id", session.leagueId)
    .select()
    .single();

  // Column not migrated yet — strip unknown columns and retry
  if (
    error &&
    (error.message.includes("crystal_ball_enabled") ||
      error.message.includes("home_tagline") ||
      error.message.includes("season_theme") ||
      error.message.includes("championship_trophy_id") ||
      error.message.includes("schema cache") ||
      error.code === "PGRST204")
  ) {
    delete patch.crystal_ball_enabled;
    delete patch.home_tagline_id;
    delete patch.home_tagline_custom;
    delete patch.season_theme_id;
    delete patch.championship_trophy_id;
    const retry = await supabase
      .from("leagues")
      .update(patch)
      .eq("id", session.leagueId)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to save" };
  }

  const league = toLocalLeague(data);
  // Always stamp from the save request (covers pre-migration DB)
  if (opts.settings?.crystalBallEnabled !== undefined) {
    league.settings.crystalBallEnabled = opts.settings.crystalBallEnabled;
  }
  if (opts.settings?.homeTaglineId !== undefined) {
    league.settings.homeTaglineId = opts.settings.homeTaglineId;
  }
  if (opts.settings?.homeTaglineCustom !== undefined) {
    league.settings.homeTaglineCustom = opts.settings.homeTaglineCustom;
  }
  if (opts.settings?.seasonThemeId !== undefined) {
    league.settings.seasonThemeId = opts.settings.seasonThemeId;
  }
  if (opts.settings?.championshipTrophyId !== undefined) {
    league.settings.championshipTrophyId = opts.settings.championshipTrophyId;
  }
  // Cloud sport_id wins when present. Local stamps never overwrite cloud here.
  {
    const cloudSport =
      typeof (data as { sport_id?: string | null }).sport_id === "string"
        ? String((data as { sport_id?: string }).sport_id).trim()
        : "";
    if (cloudSport) {
      try {
        const { resolveLeagueSportId } = await import("./sports/sport-theme");
        league.sportId = resolveLeagueSportId({
          leagueId: league.id,
          cloudSportId: cloudSport,
          localSportId: local.sportId,
        });
      } catch {
        league.sportId = cloudSport;
      }
    }
    // If cloud omitted sport_id from the response, keep prior local presentation only.
  }
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
  // Never UPDATE leagues.sport_id from save settings / sync — create path owns writes.
  return { ok: true, league };
}

/** Regenerate invite code in cloud */
export async function regenerateCodeInCloud(): Promise<{
  ok: boolean;
  league?: League;
  error?: string;
}> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return saveLeagueToCloud({ code });
}
