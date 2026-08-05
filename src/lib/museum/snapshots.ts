/**
 * Allegiance snapshots at card publish (prelock) + first-kickoff freeze.
 * Phase 1A: creates/refreshes snapshots only — never museum_events.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getLeague, getSession, isOps } from "@/lib/league";
import { defaultSeasonYear } from "@/lib/trophies";
import { firstKickoffOnCardMs } from "@/lib/dates";
import type { Game } from "@/lib/types";
import { canWriteMuseumProduction } from "./gates";
import {
  buildGameIdentityKey,
  providerGameIdFromGame,
  resolveCardGameTeams,
  underdogSideFromCard,
} from "./identity";
import type {
  AllegianceSnapshotGameInput,
  FreezeSnapshotsResult,
  RebuildSnapshotsResult,
} from "./types";

/** Build RPC game payloads — only games with confident both-side catalog match. */
export function buildSnapshotGamePayloads(
  games: Game[],
  sportId: string,
  rankSource: string | null = null
): AllegianceSnapshotGameInput[] {
  const out: AllegianceSnapshotGameInput[] = [];
  for (const g of games) {
    const resolved = resolveCardGameTeams(g, sportId);
    if (!resolved) continue;
    const provider = providerGameIdFromGame(g);
    const key = buildGameIdentityKey({
      providerGameId: provider,
      awayTeamId: resolved.awayTeamId,
      homeTeamId: resolved.homeTeamId,
    });
    if (!key) continue;
    const fav =
      g.favorite === "home" || g.favorite === "away" ? g.favorite : null;
    out.push({
      cardGameId: g.id || null,
      providerGameId: provider,
      gameIdentityKey: key,
      awayTeamId: resolved.awayTeamId,
      homeTeamId: resolved.homeTeamId,
      awayTeamName: resolved.awayTeamName,
      homeTeamName: resolved.homeTeamName,
      cardFavorite: fav,
      cardSpread:
        typeof g.spread === "number" && Number.isFinite(g.spread)
          ? g.spread
          : null,
      awayRank: g.awayRank ?? null,
      homeRank: g.homeRank ?? null,
      rankSource,
    });
  }
  return out;
}

function gamesToRpcJson(games: AllegianceSnapshotGameInput[]) {
  return games.map((g) => ({
    card_game_id: g.cardGameId,
    provider_game_id: g.providerGameId,
    game_identity_key: g.gameIdentityKey,
    away_team_id: g.awayTeamId,
    home_team_id: g.homeTeamId,
    away_team_name: g.awayTeamName,
    home_team_name: g.homeTeamName,
    card_favorite: g.cardFavorite,
    card_spread: g.cardSpread,
    underdog_side: underdogSideFromCard(g.cardFavorite),
    away_rank: g.awayRank,
    home_rank: g.homeRank,
    rank_source: g.rankSource,
  }));
}

/**
 * After successful production card publish: rebuild pre-lock snapshots.
 * Legal pre-lock republish replaces prior prelock rows.
 * Frozen weeks are left untouched (RPC returns already_frozen).
 */
export async function rebuildAllegianceSnapshotsAfterPublish(opts: {
  leagueId: string;
  weekNumber: number;
  weekCardId: string;
  games: Game[];
  sportId?: string;
  season?: number;
  rankSource?: string | null;
}): Promise<RebuildSnapshotsResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Not configured" };
  }

  const gate = canWriteMuseumProduction({ source: "allegiance_snapshot" });
  if (!gate.ok) {
    return { ok: true, skipped: true, reason: gate.reason, inserted: 0 };
  }

  if (!isOps()) {
    return { ok: false, error: "Ops only" };
  }

  const session = getSession();
  if (!session?.leagueId || session.leagueId !== opts.leagueId) {
    return { ok: false, error: "Session league mismatch" };
  }

  // Eyes / guest already blocked by gate
  try {
    const eyes = await import("@/lib/creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      return { ok: true, skipped: true, reason: "eyes", inserted: 0 };
    }
  } catch {
    /* ok */
  }

  const sportId =
    opts.sportId ||
    getLeague()?.sportId ||
    "cfb";
  const season = opts.season ?? defaultSeasonYear();
  const payloads = buildSnapshotGamePayloads(
    opts.games,
    sportId,
    opts.rankSource ?? null
  );

  const firstKickMs = firstKickoffOnCardMs(opts.games);
  const firstKickoffAt =
    firstKickMs > 0 ? new Date(firstKickMs).toISOString() : null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "museum_rebuild_allegiance_snapshots",
      {
        p_league_id: opts.leagueId,
        p_week_number: opts.weekNumber,
        p_season: season,
        p_sport_id: sportId,
        p_week_card_id: opts.weekCardId,
        p_games: gamesToRpcJson(payloads),
        p_first_kickoff_at: firstKickoffAt,
      }
    );
    if (error) {
      // Migration not applied yet — soft-fail
      if (
        /function|does not exist|schema cache|museum_rebuild/i.test(
          error.message || ""
        )
      ) {
        return {
          ok: true,
          skipped: true,
          reason: "migration_pending",
          error: error.message,
          inserted: 0,
        };
      }
      return { ok: false, error: error.message };
    }
    const row = (data || {}) as RebuildSnapshotsResult;
    return {
      ok: row.ok !== false,
      skipped: row.skipped,
      reason: row.reason,
      inserted: row.inserted ?? 0,
      frozen: row.frozen,
      games: row.games ?? payloads.length,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Snapshot rebuild failed",
    };
  }
}

/**
 * Freeze prelock → frozen after first kickoff.
 * Safe to call from scoring path or opportunistic client loads.
 */
export async function freezeAllegianceSnapshotsIfLocked(opts: {
  leagueId: string;
  weekNumber: number;
  games?: Game[];
  firstKickoffAt?: string | null;
  /** When true, ops may freeze without kickoff timestamp (post-score path). */
  forceOpsVerified?: boolean;
}): Promise<FreezeSnapshotsResult> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Not configured" };
  }

  let firstKickoffAt = opts.firstKickoffAt ?? null;
  if (!firstKickoffAt && opts.games?.length) {
    const ms = firstKickoffOnCardMs(opts.games);
    if (ms > 0) firstKickoffAt = new Date(ms).toISOString();
  }

  // Without kickoff proof, only ops force path may freeze
  if (!firstKickoffAt && !opts.forceOpsVerified) {
    return { ok: true, frozen: false, reason: "no_kickoff", updated: 0 };
  }

  if (firstKickoffAt && Date.parse(firstKickoffAt) > Date.now()) {
    return { ok: true, frozen: false, reason: "kickoff_not_reached", updated: 0 };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "museum_freeze_allegiance_snapshots",
      {
        p_league_id: opts.leagueId,
        p_week_number: opts.weekNumber,
        p_first_kickoff_at: opts.forceOpsVerified
          ? firstKickoffAt || new Date(0).toISOString()
          : firstKickoffAt,
      }
    );
    if (error) {
      if (/function|does not exist|schema cache/i.test(error.message || "")) {
        return { ok: true, frozen: false, reason: "migration_pending" };
      }
      return { ok: false, error: error.message };
    }
    const row = (data || {}) as FreezeSnapshotsResult;
    return {
      ok: row.ok !== false,
      frozen: row.frozen,
      updated: row.updated,
      reason: row.reason,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Freeze failed",
    };
  }
}
