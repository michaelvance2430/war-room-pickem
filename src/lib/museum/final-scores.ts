/**
 * Durable numeric final scores — Phase 1A.
 * Written only from authorized scoring path. Survives season reset.
 * Does not change ATS scoring semantics.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getLeague, getSession, isOps } from "@/lib/league";
import { defaultSeasonYear } from "@/lib/trophies";
import type { Game } from "@/lib/types";
import { canWriteMuseumProduction } from "./gates";
import {
  buildGameIdentityKey,
  providerGameIdFromGame,
  resolveCardGameTeams,
  underdogSideFromCard,
} from "./identity";
import type { DurableFinalScoreInput, UpsertFinalScoresResult } from "./types";

export function buildDurableScoreInputs(opts: {
  games: Game[];
  finalBoxes: { gameId: string; homeScore: number; awayScore: number }[];
  sportId: string;
  scoreSource?: string;
}): DurableFinalScoreInput[] {
  const byId = new Map(opts.finalBoxes.map((b) => [b.gameId, b]));
  const out: DurableFinalScoreInput[] = [];

  for (const g of opts.games) {
    const box = byId.get(g.id);
    if (!box) continue;
    const awayScore = Number(box.awayScore);
    const homeScore = Number(box.homeScore);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) continue;
    if (awayScore < 0 || homeScore < 0) continue;

    const resolved = resolveCardGameTeams(g, opts.sportId);
    const provider = providerGameIdFromGame(g);
    const key = buildGameIdentityKey({
      providerGameId: provider,
      awayTeamId: resolved?.awayTeamId,
      homeTeamId: resolved?.homeTeamId,
    });
    // Prefer identity even without catalog match (names still stored)
    const identity =
      key ||
      (provider ? provider : null) ||
      `${(g.awayTeam || "").trim()}|${(g.homeTeam || "").trim()}`;
    if (!identity || identity === "|") continue;

    const fav =
      g.favorite === "home" || g.favorite === "away" ? g.favorite : null;

    out.push({
      cardGameId: g.id || null,
      providerGameId: provider,
      gameIdentityKey: identity,
      awayTeamId: resolved?.awayTeamId ?? null,
      homeTeamId: resolved?.homeTeamId ?? null,
      awayTeamName: resolved?.awayTeamName || g.awayTeam || "Away",
      homeTeamName: resolved?.homeTeamName || g.homeTeam || "Home",
      awayScore: Math.round(awayScore),
      homeScore: Math.round(homeScore),
      overtime: null, // unknown unless a trustworthy source sets it later
      sourceTimestamp: new Date().toISOString(),
      cardFavorite: fav,
      cardSpread:
        typeof g.spread === "number" && Number.isFinite(g.spread)
          ? g.spread
          : null,
      underdogSide: underdogSideFromCard(fav),
      awayRank: g.awayRank ?? null,
      homeRank: g.homeRank ?? null,
      rankSource: null,
    });
  }
  return out;
}

/**
 * Persist numeric finals after ATS game_results write succeeds.
 * Idempotent upsert on (league_id, week_number, game_identity_key).
 */
export async function persistDurableFinalScores(opts: {
  leagueId: string;
  weekNumber: number;
  weekResultId: string | null;
  weekCardId?: string | null;
  games: Game[];
  finalBoxes?: { gameId: string; homeScore: number; awayScore: number }[];
  sportId?: string;
  season?: number;
  scoreSource?: string;
}): Promise<UpsertFinalScoresResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Not configured" };
  }
  if (!opts.finalBoxes?.length) {
    return { ok: true, upserted: 0 };
  }

  // Durable scores: allow on production leagues only (same permanence rule)
  const gate = canWriteMuseumProduction({ source: "game_final_scores" });
  if (!gate.ok) {
    // Still allow non-production to skip silently — ATS path already wrote winners
    return { ok: true, upserted: 0 };
  }

  if (!isOps()) {
    return { ok: false, error: "Ops only" };
  }

  const session = getSession();
  if (!session?.leagueId || session.leagueId !== opts.leagueId) {
    return { ok: false, error: "Session league mismatch" };
  }

  try {
    const eyes = await import("@/lib/creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return { ok: true, upserted: 0 };
    }
  } catch {
    /* ok */
  }

  const sportId = opts.sportId || getLeague()?.sportId || "cfb";
  const season = opts.season ?? defaultSeasonYear();
  const inputs = buildDurableScoreInputs({
    games: opts.games,
    finalBoxes: opts.finalBoxes,
    sportId,
  });
  if (!inputs.length) {
    return { ok: true, upserted: 0 };
  }

  const payload = inputs.map((s) => ({
    card_game_id: s.cardGameId,
    provider_game_id: s.providerGameId,
    game_identity_key: s.gameIdentityKey,
    away_team_id: s.awayTeamId,
    home_team_id: s.homeTeamId,
    away_team_name: s.awayTeamName,
    home_team_name: s.homeTeamName,
    away_score: s.awayScore,
    home_score: s.homeScore,
    overtime: s.overtime,
    source_timestamp: s.sourceTimestamp,
    card_favorite: s.cardFavorite,
    card_spread: s.cardSpread,
    underdog_side: s.underdogSide,
    away_rank: s.awayRank,
    home_rank: s.homeRank,
    rank_source: s.rankSource,
  }));

  try {
    const supabase = createClient();
    // Resolve week_card_id if not provided
    let weekCardId = opts.weekCardId ?? null;
    if (!weekCardId) {
      const { data: card } = await supabase
        .from("week_cards")
        .select("id")
        .eq("league_id", opts.leagueId)
        .eq("week_number", opts.weekNumber)
        .maybeSingle();
      weekCardId = (card?.id as string) || null;
    }

    const { data, error } = await supabase.rpc(
      "museum_upsert_game_final_scores",
      {
        p_league_id: opts.leagueId,
        p_week_number: opts.weekNumber,
        p_season: season,
        p_sport_id: sportId,
        p_week_result_id: opts.weekResultId,
        p_week_card_id: weekCardId,
        p_scores: payload,
        p_score_source: opts.scoreSource || "scoring_path",
      }
    );
    if (error) {
      if (
        /function|does not exist|schema cache|museum_upsert/i.test(
          error.message || ""
        )
      ) {
        return {
          ok: true,
          upserted: 0,
          error: `migration_pending: ${error.message}`,
        };
      }
      return { ok: false, error: error.message };
    }
    const row = (data || {}) as UpsertFinalScoresResult;
    return { ok: row.ok !== false, upserted: row.upserted ?? 0 };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Final score persist failed",
    };
  }
}
