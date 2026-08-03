/**
 * Read-only week inventory audit for Foundry / trust scrubs.
 * Never deletes. Surfaces orphan week_cards the player UI now hides.
 */

import { getLeague, getSession } from "@/lib/league";
import { isFoundryBackstageUser } from "@/lib/foundry-preview";
import { createClient } from "@/lib/supabase/client";
import { loadLeagueActiveWeek } from "@/lib/cloud";
import { findOrphanPublishedWeeks } from "@/lib/week-history-trust";

export type WeekCardAuditRow = {
  id: string;
  league_id: string;
  week_number: number;
  published_at: string | null;
  prop_question: string | null;
  game_count: number;
  is_orphan: boolean;
};

export type WeekInventoryAuditReport = {
  ok: boolean;
  message: string;
  league_id: string | null;
  league_name: string | null;
  sport_id: string | null;
  current_week: number | null;
  all_published_weeks: number[];
  player_visible_weeks: number[];
  orphan_weeks: number[];
  cards: WeekCardAuditRow[];
  likely_creator_paths: string[];
};

/**
 * Audit current session league week_cards (creator/Foundry only).
 */
export async function auditWeekInventoryForCurrentLeague(): Promise<WeekInventoryAuditReport> {
  const empty = (
    message: string
  ): WeekInventoryAuditReport => ({
    ok: false,
    message,
    league_id: null,
    league_name: null,
    sport_id: null,
    current_week: null,
    all_published_weeks: [],
    player_visible_weeks: [],
    orphan_weeks: [],
    cards: [],
    likely_creator_paths: [],
  });

  const session = getSession();
  if (!session?.playerId || !session.leagueId) {
    return empty("No league session");
  }
  if (!isFoundryBackstageUser(session.playerId)) {
    return empty("Creator / Foundry only");
  }

  const league = getLeague();
  const leagueId = session.leagueId;
  const sportId = league?.sportId || "cfb";
  let currentWeek: number | null = null;
  try {
    currentWeek = await loadLeagueActiveWeek();
  } catch {
    currentWeek = null;
  }

  const supabase = createClient();
  const { data: cardRows, error } = await supabase
    .from("week_cards")
    .select("id, league_id, week_number, published_at, prop_question")
    .eq("league_id", leagueId)
    .order("week_number", { ascending: true });

  if (error) {
    return empty(error.message || "Failed to load week_cards");
  }

  const rows = (cardRows || []) as {
    id: string;
    league_id: string;
    week_number: number;
    published_at: string | null;
    prop_question: string | null;
  }[];

  const allWeeks = rows.map((r) => Number(r.week_number));
  const { visible, orphans } = findOrphanPublishedWeeks({
    published: allWeeks,
    activeWeek: currentWeek ?? 0,
    sportId,
  });
  const orphanSet = new Set(orphans);

  // game counts
  const ids = rows.map((r) => r.id);
  const gameCount = new Map<string, number>();
  if (ids.length) {
    const { data: games } = await supabase
      .from("card_games")
      .select("week_card_id")
      .in("week_card_id", ids);
    for (const g of games || []) {
      const id = (g as { week_card_id: string }).week_card_id;
      gameCount.set(id, (gameCount.get(id) || 0) + 1);
    }
  }

  const cards: WeekCardAuditRow[] = rows.map((r) => ({
    id: r.id,
    league_id: r.league_id,
    week_number: Number(r.week_number),
    published_at: r.published_at,
    prop_question: r.prop_question,
    game_count: gameCount.get(r.id) || 0,
    is_orphan: orphanSet.has(Number(r.week_number)),
  }));

  const likely: string[] = [];
  if (orphans.length) {
    likely.push(
      "publishWeekCard (Host publish for an arbitrary week_number)"
    );
    likely.push(
      "Foundry founderPostWeek / Post + score (demo slate into real league_id)"
    );
    likely.push(
      "League → Auto-score weeks (sandbox) range publish via sandbox-auto-finish"
    );
    likely.push(
      "Not Practice Mode (week 99 is client-only and never writes week_cards)"
    );
  }

  return {
    ok: true,
    message: orphans.length
      ? `Found ${orphans.length} orphan published week(s): ${orphans.join(", ")}. Player UI hides them. Rows not deleted.`
      : "No orphan published weeks relative to live week.",
    league_id: leagueId,
    league_name: league?.name || null,
    sport_id: sportId,
    current_week: currentWeek,
    all_published_weeks: [...new Set(allWeeks)].sort((a, b) => a - b),
    player_visible_weeks: visible,
    orphan_weeks: orphans,
    cards,
    likely_creator_paths: likely,
  };
}
