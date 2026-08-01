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
  sport_id?: string | null;
}): League {
  let sportId = "cfb";
  if (typeof row.sport_id === "string" && row.sport_id.trim()) {
    sportId = row.sport_id.trim();
  } else if (canUseStorage()) {
    try {
      const prev = JSON.parse(
        localStorage.getItem(LEAGUE_KEY) || "null"
      ) as League | null;
      if (prev?.sportId) sportId = prev.sportId;
    } catch {
      /* default cfb */
    }
  }
  // Prefer cloud flag; if column missing from select, keep prior local value
  let crystalBallEnabled = true;
  let homeTaglineId = "good-teams";
  let homeTaglineCustom = "";
  let seasonThemeId = "default";
  if (typeof row.crystal_ball_enabled === "boolean") {
    crystalBallEnabled = row.crystal_ball_enabled;
  } else if (canUseStorage()) {
    try {
      const prev = JSON.parse(
        localStorage.getItem(LEAGUE_KEY) || "null"
      ) as League | null;
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
    } catch {
      /* default true */
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
  } else if (canUseStorage() && !row.season_theme_id) {
    try {
      const prev = JSON.parse(
        localStorage.getItem(LEAGUE_KEY) || "null"
      ) as League | null;
      if (prev?.settings?.seasonThemeId) {
        seasonThemeId = prev.settings.seasonThemeId;
      }
    } catch {
      /* keep default */
    }
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
    },
  };
}

/** Load league from Supabase by id and cache in localStorage */
export async function fetchLeagueFromCloud(
  leagueId: string
): Promise<League | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (error || !data) return null;

  const league = toLocalLeague(data);
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
  return league;
}

/** Refresh current session league from Supabase */
export async function syncLeagueFromCloud(): Promise<League | null> {
  const session = getSession();
  if (!session?.leagueId) return getLeague();
  return fetchLeagueFromCloud(session.leagueId);
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

  const supabase = createClient();
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
      error.message.includes("schema cache") ||
      error.code === "PGRST204")
  ) {
    delete patch.crystal_ball_enabled;
    delete patch.home_tagline_id;
    delete patch.home_tagline_custom;
    delete patch.season_theme_id;
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
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
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
