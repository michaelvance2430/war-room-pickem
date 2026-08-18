import { getSession } from "@/lib/league";
import { createClient } from "@/lib/supabase/client";
import { canonicalSeasonYear } from "./season-identity";

export type CfbPostseasonBowlGame = {
  id: string;
  name: string;
  tier: "marquee" | "sicko";
  rank: number;
  away: string;
  home: string;
  hosts_cfp?: boolean;
};

export type CfbPostseasonSlate = {
  leagueId: string;
  seasonKey: number;
  bowlGames: CfbPostseasonBowlGame[];
  cfpSeeds: string[];
  publishedAt: string;
};

export type CfbPostseasonEntry = {
  bowlPicks: Record<string, string>;
  bowlAllocations: Record<string, number>;
  deadHand: boolean;
  bowlLockedAt: string | null;
  cfpPicks: Record<string, string>;
  cfpLockedAt: string | null;
  bowlScore: number | null;
  cfpScore: number | null;
};

export type CfbPostseasonResults = {
  bowlResults: Record<string, string>;
  cfpResults: Record<string, string>;
  updatedAt: string | null;
};

export const CFB_CFP_GAME_ORDER = [
  "r1a", "r1b", "r1c", "r1d",
  "q1", "q2", "q3", "q4",
  "s1", "s2", "final",
] as const;

export function cfpMatchups(
  seeds: string[],
  picks: Record<string, string>
): Record<(typeof CFB_CFP_GAME_ORDER)[number], readonly [string, string]> {
  const winner = (id: string) => picks[id] || "TBD";
  return {
    r1a: [seeds[4] || "Seed 5", seeds[11] || "Seed 12"],
    r1b: [seeds[7] || "Seed 8", seeds[8] || "Seed 9"],
    r1c: [seeds[6] || "Seed 7", seeds[9] || "Seed 10"],
    r1d: [seeds[5] || "Seed 6", seeds[10] || "Seed 11"],
    q1: [seeds[3] || "Seed 4", winner("r1a")],
    q2: [seeds[0] || "Seed 1", winner("r1b")],
    q3: [seeds[1] || "Seed 2", winner("r1c")],
    q4: [seeds[2] || "Seed 3", winner("r1d")],
    s1: [winner("q1"), winner("q2")],
    s2: [winner("q3"), winner("q4")],
    final: [winner("s1"), winner("s2")],
  };
}

export function sanitizeCfpPicks(
  seeds: string[],
  picks: Record<string, string>
): Record<string, string> {
  const next = { ...picks };
  for (let pass = 0; pass < 4; pass++) {
    const games = cfpMatchups(seeds, next);
    for (const id of CFB_CFP_GAME_ORDER) {
      if (next[id] && !games[id].includes(next[id])) delete next[id];
    }
  }
  return next;
}

export async function loadCfbPostseasonSlate(
  seasonKey = canonicalSeasonYear()
): Promise<CfbPostseasonSlate | null> {
  const leagueId = getSession()?.leagueId;
  if (!leagueId) return null;
  const { data, error } = await createClient()
    .from("cfb_postseason_slates")
    .select("league_id,season_key,bowl_games,cfp_seeds,published_at")
    .eq("league_id", leagueId)
    .eq("season_key", seasonKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    leagueId: String(data.league_id),
    seasonKey: Number(data.season_key),
    bowlGames: (data.bowl_games || []) as CfbPostseasonBowlGame[],
    cfpSeeds: (data.cfp_seeds || []) as string[],
    publishedAt: String(data.published_at),
  };
}

export async function publishCfbPostseasonSlate(input: {
  bowlGames: CfbPostseasonBowlGame[];
  cfpSeeds: string[];
  seasonKey?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner authority required." };
  }
  const { error } = await createClient().rpc("publish_cfb_postseason_slate", {
    p_league_id: session.leagueId,
    p_season_key: input.seasonKey ?? canonicalSeasonYear(),
    p_bowl_games: input.bowlGames,
    p_cfp_seeds: input.cfpSeeds,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadCfbPostseasonResults(
  seasonKey = canonicalSeasonYear()
): Promise<CfbPostseasonResults> {
  const leagueId = getSession()?.leagueId;
  if (!leagueId) return { bowlResults: {}, cfpResults: {}, updatedAt: null };
  const { data, error } = await createClient()
    .from("cfb_postseason_results")
    .select("bowl_results,cfp_results,updated_at")
    .eq("league_id", leagueId)
    .eq("season_key", seasonKey)
    .maybeSingle();
  if (error) throw error;
  return {
    bowlResults: (data?.bowl_results || {}) as Record<string, string>,
    cfpResults: (data?.cfp_results || {}) as Record<string, string>,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
}

export async function saveCfbPostseasonResults(input: {
  bowlResults: Record<string, string>;
  cfpResults: Record<string, string>;
  seasonKey?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner authority required." };
  }
  const { error } = await createClient().from("cfb_postseason_results").upsert({
    league_id: session.leagueId,
    season_key: input.seasonKey ?? canonicalSeasonYear(),
    bowl_results: input.bowlResults,
    cfp_results: input.cfpResults,
  }, { onConflict: "league_id,season_key" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadMyCfbPostseasonEntry(
  seasonKey = canonicalSeasonYear()
): Promise<CfbPostseasonEntry | null> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) return null;
  const { data, error } = await createClient()
    .from("cfb_postseason_entries")
    .select("bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at,bowl_score,cfp_score")
    .eq("league_id", session.leagueId)
    .eq("user_id", session.playerId)
    .eq("season_key", seasonKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    bowlPicks: (data.bowl_picks || {}) as Record<string, string>,
    bowlAllocations: Object.fromEntries(
      Object.entries((data.bowl_allocations || {}) as Record<string, unknown>)
        .map(([id, value]) => [id, Number(value)])
    ),
    deadHand: !!data.dead_hand,
    bowlLockedAt: data.bowl_locked_at ? String(data.bowl_locked_at) : null,
    cfpPicks: (data.cfp_picks || {}) as Record<string, string>,
    cfpLockedAt: data.cfp_locked_at ? String(data.cfp_locked_at) : null,
    bowlScore: data.bowl_score == null ? null : Number(data.bowl_score),
    cfpScore: data.cfp_score == null ? null : Number(data.cfp_score),
  };
}

export async function saveMyCfbPostseasonEntry(input: {
  bowlPicks: Record<string, string>;
  bowlAllocations: Record<string, number>;
  cfpPicks: Record<string, string>;
  lockBowl?: boolean;
  lockCfp?: boolean;
  deadHand?: boolean;
  seasonKey?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) return { ok: false, error: "Sign in first." };
  const existing = await loadMyCfbPostseasonEntry(input.seasonKey);
  const payload = {
    league_id: session.leagueId,
    user_id: session.playerId,
    season_key: input.seasonKey ?? canonicalSeasonYear(),
    bowl_picks: input.bowlPicks,
    bowl_allocations: input.bowlAllocations,
    dead_hand: input.deadHand ?? existing?.deadHand ?? false,
    bowl_locked_at: existing?.bowlLockedAt || (input.lockBowl ? new Date().toISOString() : null),
    cfp_picks: input.cfpPicks,
    cfp_locked_at: existing?.cfpLockedAt || (input.lockCfp ? new Date().toISOString() : null),
  };
  const { error } = await createClient().from("cfb_postseason_entries").upsert(payload, {
    onConflict: "league_id,user_id,season_key",
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
