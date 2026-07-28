import { createClient } from "@/lib/supabase/client";
import {
  League,
  LeagueSettings,
  getLeague,
  getSession,
} from "@/lib/league";

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
}): League {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    commissionerId: row.commissioner_id,
    createdAt: row.created_at,
    settings: {
      cutPercent: row.cut_percent ?? 50,
      regularSeasonWeeks: row.regular_season_weeks ?? 13,
      gamesPerWeek: row.games_per_week ?? 5,
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
  if (opts.settings?.regularSeasonWeeks !== undefined)
    patch.regular_season_weeks = opts.settings.regularSeasonWeeks;
  if (opts.settings?.gamesPerWeek !== undefined)
    patch.games_per_week = opts.settings.gamesPerWeek;

  const { data, error } = await supabase
    .from("leagues")
    .update(patch)
    .eq("id", session.leagueId)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to save" };
  }

  const league = toLocalLeague(data);
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
