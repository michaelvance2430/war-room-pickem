/**
 * Read-only Museum loaders for Phase 1C (and debugging).
 * Phase 1A: safe SELECT helpers; no generation.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import type { MuseumEventRow } from "./types";

export async function loadMuseumRivalryEvents(opts?: {
  leagueId?: string;
  limit?: number;
}): Promise<MuseumEventRow[]> {
  if (!hasSupabaseConfig()) return [];
  const leagueId = opts?.leagueId || getSession()?.leagueId;
  if (!leagueId) return [];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("museum_events")
      .select("*")
      .eq("league_id", leagueId)
      .eq("event_type", "fan_favorite_rivalry")
      .order("finalized_at", { ascending: false })
      .limit(opts?.limit ?? 100);
    if (error) return [];
    return ((data || []) as Record<string, unknown>[]).map(mapEventRow);
  } catch {
    return [];
  }
}

export async function countMuseumEvents(leagueId: string): Promise<number> {
  if (!hasSupabaseConfig() || !leagueId) return 0;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("museum_league_event_count", {
      p_league_id: leagueId,
    });
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

function mapEventRow(r: Record<string, unknown>): MuseumEventRow {
  return {
    id: String(r.id),
    leagueId: String(r.league_id),
    sportId: String(r.sport_id),
    season: Number(r.season) || 0,
    weekNumber: Number(r.week_number) || 0,
    eventType: "fan_favorite_rivalry",
    sourceCardId: (r.source_card_id as string) || null,
    sourceCardGameId: (r.source_card_game_id as string) || null,
    sourceProviderGameId: (r.source_provider_game_id as string) || null,
    gameIdentityKey: String(r.game_identity_key || ""),
    occurredAt: (r.occurred_at as string) || null,
    finalizedAt: String(r.finalized_at || ""),
    awayTeamId: String(r.away_team_id || ""),
    homeTeamId: String(r.home_team_id || ""),
    awayTeamNameSnapshot: String(r.away_team_name_snapshot || ""),
    homeTeamNameSnapshot: String(r.home_team_name_snapshot || ""),
    winningTeamId: (r.winning_team_id as string) || null,
    losingTeamId: (r.losing_team_id as string) || null,
    awayScore: Number(r.away_score) || 0,
    homeScore: Number(r.home_score) || 0,
    margin: Number(r.margin) || 0,
    overtime:
      r.overtime === true ? true : r.overtime === false ? false : null,
    factPayload: (r.fact_payload as Record<string, unknown>) || {},
    headline: String(r.headline || ""),
    plaque: String(r.plaque || ""),
    humorPlaque: String(r.humor_plaque || ""),
    templateKey: String(r.template_key || ""),
    templateVersion: Number(r.template_version) || 0,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdAt: String(r.created_at || ""),
  };
}
