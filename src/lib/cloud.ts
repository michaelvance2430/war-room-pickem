import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import { Game, Prop, UserPick } from "@/lib/types";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { weekTitle } from "@/lib/dates";
import { MAX_LEAGUE_PLAYERS, seatsRemaining } from "@/lib/league-limits";

export interface CloudCard {
  weekCardId: string;
  weekNumber: number;
  games: Game[];
  prop: Prop;
  /** ISO time card was last published/updated — used for live refresh */
  publishedAt?: string | null;
}

/** Stable string so clients can detect when the commissioner changes the card. */
export function cardRevision(card: {
  weekNumber: number;
  publishedAt?: string | null;
  games: Game[];
  prop: Prop;
}): string {
  const gamesKey = card.games
    .map(
      (g) =>
        `${g.id}|${g.awayTeam}|${g.homeTeam}|${g.spread}|${g.favorite}|${g.commenceTime || g.startTime || ""}`
    )
    .join(";");
  return [
    card.weekNumber,
    card.publishedAt || "",
    card.prop.question,
    card.prop.options.join("|"),
    gamesKey,
  ].join("::");
}

/** Commissioner sets which week everyone should see (leagues.current_week). */
export async function setLeagueActiveWeek(
  weekNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner session required" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("leagues")
    .update({ current_week: weekNumber })
    .eq("id", session.leagueId);
  if (error) return { ok: false, error: error.message };
  try {
    localStorage.setItem("warroom-active-week", String(weekNumber));
  } catch {
    /* ignore */
  }
  return { ok: true };
}

/** Active pick'em week for the league (cloud first, then localStorage). */
export async function loadLeagueActiveWeek(): Promise<number> {
  const session = getSession();
  let week = 1;
  try {
    const saved = localStorage.getItem("warroom-active-week");
    if (saved != null && saved !== "") {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) week = n;
    }
  } catch {
    /* ignore */
  }
  if (!session?.leagueId) return week;

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("leagues")
      .select("current_week")
      .eq("id", session.leagueId)
      .maybeSingle();
    if (data && data.current_week != null) {
      const n = Number(data.current_week);
      if (!Number.isNaN(n)) {
        week = n;
        try {
          localStorage.setItem("warroom-active-week", String(week));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return week;
}

export interface ScoreWeekResult {
  ok: boolean;
  scoredCount: number;
  error?: string;
  details?: { name: string; points: number }[];
}

function mapCardGame(row: {
  id: string;
  away_team: string;
  home_team: string;
  spread: number;
  favorite: string;
  start_time: string | null;
  bookmaker: string | null;
  away_rank?: number | null;
  home_rank?: number | null;
}): Game {
  const start = row.start_time || "";
  // If we stored ISO, keep it on commenceTime for date formatting
  const isIso = start.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(start);
  const oddsId = (row as { odds_event_id?: string | null }).odds_event_id;
  return {
    id: row.id,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    spread: Number(row.spread),
    favorite: row.favorite === "away" ? "away" : "home",
    startTime: start,
    commenceTime: isIso ? start : undefined,
    oddsEventId: oddsId || undefined,
    bookmaker: row.bookmaker || undefined,
    awayRank: row.away_rank ?? null,
    homeRank: row.home_rank ?? null,
  };
}

export async function publishWeekCard(opts: {
  weekNumber: number;
  games: Game[];
  prop: Prop;
}): Promise<{ ok: boolean; weekCardId?: string; games?: Game[]; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner session required" };
  }
  if (opts.games.length !== 5) {
    return { ok: false, error: "Select exactly 5 games" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;

  const { data: existing } = await supabase
    .from("week_cards")
    .select("id")
    .eq("league_id", leagueId)
    .eq("week_number", opts.weekNumber)
    .maybeSingle();

  let weekCardId: string;

  const publishedAt = new Date().toISOString();

  if (existing?.id) {
    weekCardId = existing.id;
    const { error: propErr } = await supabase
      .from("week_cards")
      .update({
        prop_question: opts.prop.question,
        prop_option_a: opts.prop.options[0],
        prop_option_b: opts.prop.options[1],
        prop_points: opts.prop.points,
        // Bump so every client can detect a card refresh
        published_at: publishedAt,
      })
      .eq("id", weekCardId);
    if (propErr) {
      return { ok: false, error: propErr.message || "Failed to update prop on week card" };
    }
    await supabase.from("card_games").delete().eq("week_card_id", weekCardId);
  } else {
    const { data: card, error } = await supabase
      .from("week_cards")
      .insert({
        league_id: leagueId,
        week_number: opts.weekNumber,
        prop_question: opts.prop.question,
        prop_option_a: opts.prop.options[0],
        prop_option_b: opts.prop.options[1],
        prop_points: opts.prop.points,
        published_at: publishedAt,
      })
      .select("id")
      .single();
    if (error || !card) {
      return { ok: false, error: error?.message || "Failed to create week card" };
    }
    weekCardId = card.id;
  }

  // Broadcast active week so My Picks / all devices follow this card
  await supabase
    .from("leagues")
    .update({ current_week: opts.weekNumber })
    .eq("id", leagueId);
  try {
    localStorage.setItem("warroom-active-week", String(opts.weekNumber));
  } catch {
    /* ignore */
  }

  const rows = opts.games.map((g, i) => ({
    week_card_id: weekCardId,
    sort_order: i,
    away_team: g.awayTeam,
    home_team: g.homeTeam,
    spread: g.spread,
    favorite: g.favorite,
    // Prefer ISO commenceTime so dates survive reload
    start_time: g.commenceTime || g.startTime || null,
    bookmaker: g.bookmaker || null,
    away_rank: g.awayRank ?? null,
    home_rank: g.homeRank ?? null,
    // Best-effort: only works after card-game-odds-id.sql is run
    odds_event_id: g.oddsEventId || g.id || null,
  }));

  let inserted: { id: string; sort_order: number }[] | null = null;
  let gamesError: { message: string } | null = null;

  {
    const first = await supabase
      .from("card_games")
      .insert(rows)
      .select("id, sort_order");
    if (
      first.error &&
      /odds_event_id|column/i.test(first.error.message || "")
    ) {
      // Column not added yet — retry without odds_event_id
      const slim = rows.map(({ odds_event_id: _o, ...rest }) => rest);
      const second = await supabase
        .from("card_games")
        .insert(slim)
        .select("id, sort_order");
      inserted = second.data;
      gamesError = second.error;
    } else {
      inserted = first.data;
      gamesError = first.error;
    }
  }

  if (gamesError) {
    return { ok: false, error: gamesError.message };
  }

  const gamesWithIds = opts.games.map((g, i) => {
    const row = inserted?.find((r) => r.sort_order === i);
    return row
      ? { ...g, id: row.id, oddsEventId: g.oddsEventId || g.id }
      : g;
  });

  try {
    // Always key by the week being published (never hardcode week 1)
    localStorage.setItem(
      `warroom-card-week-${opts.weekNumber}`,
      JSON.stringify({
        games: gamesWithIds,
        prop: opts.prop,
        weekCardId,
        weekNumber: opts.weekNumber,
      })
    );
  } catch {}

  return { ok: true, weekCardId, games: gamesWithIds };
}

export async function loadWeekCard(weekNumber = 1): Promise<CloudCard | null> {
  const session = getSession();
  if (!session?.leagueId) return null;

  const supabase = createClient();
  const { data: card, error } = await supabase
    .from("week_cards")
    .select("*")
    .eq("league_id", session.leagueId)
    .eq("week_number", weekNumber)
    .maybeSingle();

  if (error || !card) return null;

  const { data: games } = await supabase
    .from("card_games")
    .select("*")
    .eq("week_card_id", card.id)
    .order("sort_order", { ascending: true });

  if (!games?.length) return null;

  const question = ((card.prop_question as string) || "").trim() || "Prop";
  const optionA =
    ((card.prop_option_a as string) || "").trim() || "Yes";
  const optionB =
    ((card.prop_option_b as string) || "").trim() || "No";
  const points = (card.prop_points as number) ?? 3;

  return {
    weekCardId: card.id,
    weekNumber: card.week_number,
    publishedAt: (card.published_at as string) || null,
    games: games.map(mapCardGame),
    prop: {
      // Week-scoped id; matchPresetId resolves presets by question text
      id: `prop-w${weekNumber}`,
      question,
      options: [optionA, optionB] as [string, string],
      points,
    },
  };
}

/** Weeks that have a published card (for My Picks week browser). */
export async function listPublishedWeekNumbers(): Promise<number[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("week_cards")
      .select("week_number")
      .eq("league_id", session.leagueId)
      .order("week_number", { ascending: true });
    if (error || !data) return [];
    const nums = data
      .map((r) => Number(r.week_number))
      .filter((n) => !Number.isNaN(n));
    return [...new Set(nums)].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function savePicksToCloud(opts: {
  weekNumber: number;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed into a league" };
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id || session.playerId;
  const leagueId = session.leagueId;
  const pickList = Object.values(opts.picks);
  if (!pickList.length) return { ok: false, error: "No picks to save" };

  const { data: existing } = await supabase
    .from("picks")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", uid)
    .eq("week_number", opts.weekNumber)
    .maybeSingle();

  let pickId: string;
  if (existing?.id) {
    pickId = existing.id;
    const { error } = await supabase
      .from("picks")
      .update({
        prop_choice: opts.propChoice,
        best_bet_game_id: opts.bestBetId,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pickId);
    if (error) return { ok: false, error: error.message };
    await supabase.from("pick_games").delete().eq("pick_id", pickId);
  } else {
    const { data: row, error } = await supabase
      .from("picks")
      .insert({
        league_id: leagueId,
        user_id: uid,
        week_number: opts.weekNumber,
        prop_choice: opts.propChoice,
        best_bet_game_id: opts.bestBetId,
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) return { ok: false, error: error?.message || "Failed to save picks" };
    pickId = row.id;
  }

  const { error: pgError } = await supabase.from("pick_games").insert(
    pickList.map((p) => ({
      pick_id: pickId,
      card_game_id: p.gameId,
      side: p.pick,
      confidence: p.confidence,
      is_best_bet: !!(opts.bestBetId === p.gameId || p.isBestBet),
      locked_spread: p.lockedSpread,
      locked_favorite: p.lockedFavorite,
    }))
  );
  if (pgError) return { ok: false, error: pgError.message };
  return { ok: true };
}

export async function loadMyPicks(weekNumber = 1) {
  const session = getSession();
  if (!session?.leagueId) return null;
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id || session.playerId;

  const { data: pick } = await supabase
    .from("picks")
    .select("*")
    .eq("league_id", session.leagueId)
    .eq("user_id", uid)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (!pick) return null;

  const { data: games } = await supabase.from("pick_games").select("*").eq("pick_id", pick.id);
  const picks: Record<string, UserPick> = {};
  for (const g of games || []) {
    picks[g.card_game_id] = {
      gameId: g.card_game_id,
      pick: g.side === "away" ? "away" : "home",
      confidence: g.confidence,
      isBestBet: g.is_best_bet,
      lockedSpread: Number(g.locked_spread ?? 0),
      lockedFavorite: g.locked_favorite === "away" ? "away" : "home",
    };
  }
  return {
    picks,
    bestBetId: pick.best_bet_game_id as string | null,
    propChoice: pick.prop_choice as string | null,
    lockedAt: pick.locked_at as string | null,
  };
}

export type PickSubmissionStatus = {
  userId: string;
  name: string;
  division: string;
  role: "commissioner" | "player";
  /** Has a picks row for this week */
  submitted: boolean;
  /** Full card: 5 sides + confidence + best bet + prop */
  complete: boolean;
  gamePickCount: number;
  hasProp: boolean;
  hasBestBet: boolean;
  lockedAt: string | null;
};

/**
 * Commissioner only — who has locked picks for a week.
 * Does not return sides/confidence (privacy). Use for "who hasn't picked".
 */
export async function loadPickSubmissionStatus(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; rows: PickSubmissionStatus[]; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, rows: [], error: "Commissioner only" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;

  const { data: members, error: memErr } = await supabase
    .from("memberships")
    .select("user_id, role, division, profiles(display_name)")
    .eq("league_id", leagueId);

  if (memErr) return { ok: false, rows: [], error: memErr.message };

  const { data: pickRows, error: pickErr } = await supabase
    .from("picks")
    .select("id, user_id, prop_choice, best_bet_game_id, locked_at")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);

  if (pickErr) return { ok: false, rows: [], error: pickErr.message };

  const pickByUser = new Map(
    (pickRows || []).map((p) => [p.user_id as string, p])
  );
  const pickIds = (pickRows || []).map((p) => p.id as string);

  const countByPickId = new Map<string, number>();
  if (pickIds.length) {
    const { data: pgs } = await supabase
      .from("pick_games")
      .select("pick_id")
      .in("pick_id", pickIds);
    for (const row of pgs || []) {
      const id = row.pick_id as string;
      countByPickId.set(id, (countByPickId.get(id) || 0) + 1);
    }
  }

  const rows: PickSubmissionStatus[] = (members || []).map((m) => {
    const profile = m.profiles as { display_name?: string } | null;
    const userId = m.user_id as string;
    const pick = pickByUser.get(userId);
    const gamePickCount = pick ? countByPickId.get(pick.id as string) || 0 : 0;
    const hasProp = !!(pick?.prop_choice);
    const hasBestBet = !!(pick?.best_bet_game_id);
    const complete =
      !!pick &&
      gamePickCount >= expectedGames &&
      hasProp &&
      hasBestBet;

    return {
      userId,
      name: profile?.display_name || "Player",
      division: (m.division as string) || "North",
      role: m.role === "commissioner" ? "commissioner" : "player",
      submitted: !!pick,
      complete,
      gamePickCount,
      hasProp,
      hasBestBet,
      lockedAt: (pick?.locked_at as string) || null,
    };
  });

  rows.sort((a, b) => {
    // Incomplete first, then by name
    if (a.complete !== b.complete) return a.complete ? 1 : -1;
    if (a.submitted !== b.submitted) return a.submitted ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return { ok: true, rows };
}

/**
 * Commissioner posts a public announcement naming who still needs picks.
 * Does not reveal actual picks — only names + complete/partial/missing.
 */
export async function postMissingPicksAnnouncement(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; error?: string; missingCount?: number }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner || !session.playerId) {
    return { ok: false, error: "Commissioner session required" };
  }

  const status = await loadPickSubmissionStatus(weekNumber, expectedGames);
  if (!status.ok) {
    return { ok: false, error: status.error || "Could not load pick status" };
  }

  const incomplete = status.rows.filter((r) => !r.complete);
  if (!incomplete.length) {
    return {
      ok: false,
      error: "Everyone has a complete card — nothing to announce.",
      missingCount: 0,
    };
  }

  const weekLabel = weekTitle(weekNumber);
  const lines = incomplete.map((r) => {
    if (!r.submitted) return `• ${r.name} — not submitted`;
    const bits = [`${r.gamePickCount} game picks`];
    if (!r.hasBestBet) bits.push("no Best Bet");
    if (!r.hasProp) bits.push("no prop");
    return `• ${r.name} — partial (${bits.join(", ")})`;
  });

  const title = `${weekLabel}: Still need picks`;
  const body = [
    `Commissioner call-out — these players still need a complete ${weekLabel} card (all games + confidence + Best Bet + prop):`,
    "",
    ...lines,
    "",
    "Lock them in on My Picks before kickoff.",
  ].join("\n");

  const supabase = createClient();
  const { error } = await supabase.from("announcements").insert({
    league_id: session.leagueId,
    author_id: session.playerId,
    title,
    body,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, missingCount: incomplete.length };
}

/** Weeks that already have a week_results row (scored). */
export async function listScoredWeekNumbers(): Promise<number[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("week_results")
      .select("week_number")
      .eq("league_id", session.leagueId);
    if (error || !data) return [];
    return data
      .map((r) => Number(r.week_number))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Load saved ATS covers + prop result for a week (if scored). */
export async function loadWeekResultsFromCloud(
  weekNumber: number
): Promise<{
  results: Record<string, GameResult>;
  propResult: string | null;
  scoredAt: string | null;
} | null> {
  const session = getSession();
  if (!session?.leagueId) return null;
  try {
    const supabase = createClient();
    const { data: wr, error } = await supabase
      .from("week_results")
      .select("id, prop_result, scored_at")
      .eq("league_id", session.leagueId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    if (error || !wr) return null;

    const { data: gr } = await supabase
      .from("game_results")
      .select("card_game_id, winner")
      .eq("week_result_id", wr.id);

    const results: Record<string, GameResult> = {};
    for (const g of gr || []) {
      const w = g.winner as "home" | "away" | "push";
      if (w === "home" || w === "away" || w === "push") {
        results[g.card_game_id as string] = {
          gameId: g.card_game_id as string,
          winner: w,
        };
      }
    }
    return {
      results,
      propResult: (wr.prop_result as string) || null,
      scoredAt: (wr.scored_at as string) || null,
    };
  } catch {
    return null;
  }
}

export async function saveResultsAndScoreWeek(opts: {
  weekNumber: number;
  games: Game[];
  prop: Prop;
  results: Record<string, GameResult>;
  propResult: string | null;
}): Promise<ScoreWeekResult> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, scoredCount: 0, error: "Commissioner only" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;
  const weekNumber = opts.weekNumber;

  const { data: existingRes } = await supabase
    .from("week_results")
    .select("id")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber)
    .maybeSingle();

  let weekResultId: string;
  if (existingRes?.id) {
    weekResultId = existingRes.id;
    await supabase
      .from("week_results")
      .update({ prop_result: opts.propResult, scored_at: new Date().toISOString() })
      .eq("id", weekResultId);
    await supabase.from("game_results").delete().eq("week_result_id", weekResultId);
  } else {
    const { data: wr, error } = await supabase
      .from("week_results")
      .insert({ league_id: leagueId, week_number: weekNumber, prop_result: opts.propResult })
      .select("id")
      .single();
    if (error || !wr) {
      return { ok: false, scoredCount: 0, error: error?.message || "Failed to save results" };
    }
    weekResultId = wr.id;
  }

  const resultRows = opts.games
    .filter((g) => opts.results[g.id]?.winner)
    .map((g) => ({
      week_result_id: weekResultId,
      card_game_id: g.id,
      winner: opts.results[g.id].winner as string,
    }));

  if (resultRows.length) {
    const { error } = await supabase.from("game_results").insert(resultRows);
    if (error) return { ok: false, scoredCount: 0, error: error.message };
  }

  const { data: allPicks, error: picksError } = await supabase
    .from("picks")
    .select("id, user_id, prop_choice, best_bet_game_id, total_points")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);

  if (picksError) return { ok: false, scoredCount: 0, error: picksError.message };
  if (!allPicks?.length) {
    return { ok: true, scoredCount: 0, error: "No locked picks found for this week yet" };
  }

  const details: { name: string; points: number }[] = [];
  let scoredCount = 0;

  for (const pickRow of allPicks) {
    const { data: pickGames } = await supabase
      .from("pick_games")
      .select("*")
      .eq("pick_id", pickRow.id);

    const picksMap: Record<string, UserPick> = {};
    for (const pg of pickGames || []) {
      picksMap[pg.card_game_id] = {
        gameId: pg.card_game_id,
        pick: pg.side === "away" ? "away" : "home",
        confidence: pg.confidence,
        isBestBet: pg.is_best_bet,
        lockedSpread: Number(pg.locked_spread ?? 0),
        lockedFavorite: pg.locked_favorite === "away" ? "away" : "home",
      };
    }

    const weekScore = scoreWeek(
      picksMap,
      pickRow.best_bet_game_id,
      pickRow.prop_choice,
      opts.games,
      opts.results,
      opts.prop,
      opts.propResult
    );

    const previousPoints = pickRow.total_points as number | null;
    const alreadyScored = previousPoints !== null && previousPoints !== undefined;

    await supabase
      .from("picks")
      .update({ total_points: weekScore.totalPoints })
      .eq("id", pickRow.id);

    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", pickRow.user_id)
      .maybeSingle();

    if (!membership) continue;

    const pts = weekScore.totalPoints;
    const gamesCount = opts.games.length;
    const bestBetHit = weekScore.gameScores.some((g) => g.isBestBet && g.correct);
    const hadBestBet = weekScore.gameScores.some((g) => g.isBestBet);

    let weekly: number[] = Array.isArray(membership.weekly_points)
      ? [...membership.weekly_points]
      : [];
    // Week 0 → index 0, Week 1 → index 1, … (do NOT use weekNumber-1; that breaks Week 0)
    const idx = weekNumber;
    while (weekly.length <= idx) weekly.push(0);

    let totalPoints = membership.total_points || 0;
    let atsCorrect = membership.ats_correct || 0;
    let atsTotal = membership.ats_total || 0;
    let bestWeek = membership.best_week || 0;
    let worstWeek = membership.worst_week || 0;
    let perfectWeeks = membership.perfect_weeks || 0;
    let bestBetHits = membership.best_bet_hits || 0;
    let bestBetTotal = membership.best_bet_total || 0;
    let propHits = membership.prop_hits || 0;
    let propTotal = membership.prop_total || 0;
    let weeksPlayed = membership.weeks_played || 0;
    let streak = membership.current_streak || 0;

    if (alreadyScored) {
      const oldPts = weekly[idx] || previousPoints || 0;
      totalPoints = Math.max(0, totalPoints - oldPts) + pts;
      weekly[idx] = pts;
    } else {
      weekly[idx] = pts;
      totalPoints += pts;
      atsCorrect += weekScore.correctCount;
      atsTotal += gamesCount + 1;
      bestWeek = Math.max(bestWeek, pts);
      worstWeek = weeksPlayed === 0 ? pts : Math.min(worstWeek || pts, pts);
      if (pts >= 18) perfectWeeks += 1;
      if (hadBestBet) {
        bestBetTotal += 1;
        if (bestBetHit) bestBetHits += 1;
      }
      propTotal += 1;
      if (weekScore.propCorrect) propHits += 1;
      weeksPlayed += 1;
      if (pts >= 10) streak = streak > 0 ? streak + 1 : 1;
      else streak = streak < 0 ? streak - 1 : -1;
    }

    await supabase
      .from("memberships")
      .update({
        total_points: totalPoints,
        weekly_points: weekly,
        ats_correct: atsCorrect,
        ats_total: atsTotal,
        current_streak: streak,
        best_week: bestWeek,
        worst_week: worstWeek,
        perfect_weeks: perfectWeeks,
        best_bet_hits: bestBetHits,
        best_bet_total: bestBetTotal,
        prop_hits: propHits,
        prop_total: propTotal,
        weeks_played: weeksPlayed,
      })
      .eq("id", membership.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", pickRow.user_id)
      .maybeSingle();

    details.push({ name: profile?.display_name || "Player", points: pts });
    scoredCount += 1;
  }

  try {
    localStorage.setItem(
      "warroom-results-week-1",
      JSON.stringify({ results: opts.results, propResult: opts.propResult })
    );
  } catch {}

  return { ok: true, scoredCount, details };
}

export async function loadLeagueStandings() {
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("memberships")
    .select("*, profiles(display_name)")
    .eq("league_id", session.leagueId);
  if (!rows) return [];
  return rows
    .map((m: Record<string, unknown>) => {
      const profile = m.profiles as { display_name?: string } | null;
      return {
        userId: m.user_id as string,
        name: profile?.display_name || "Player",
        division: (m.division as string) || "North",
        totalPoints: (m.total_points as number) || 0,
        weeklyPoints: (m.weekly_points as number[]) || [],
        atsCorrect: (m.ats_correct as number) || 0,
        atsTotal: (m.ats_total as number) || 0,
        currentStreak: (m.current_streak as number) || 0,
        bestWeek: (m.best_week as number) || 0,
        worstWeek: (m.worst_week as number) || 0,
        perfectWeeks: (m.perfect_weeks as number) || 0,
        bestBetHits: (m.best_bet_hits as number) || 0,
        bestBetTotal: (m.best_bet_total as number) || 0,
        propHits: (m.prop_hits as number) || 0,
        propTotal: (m.prop_total as number) || 0,
        weeksPlayed: (m.weeks_played as number) || 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

/** Cloud standings mapped to Player shape for Standings / Power Rankings / Stats. */
export async function loadLeaguePlayers(): Promise<
  import("./types").Player[]
> {
  const cloud = await loadLeagueStandings();
  return cloud.map((c) => ({
    id: c.userId,
    name: c.name,
    division: (c.division as import("./types").Player["division"]) || "North",
    totalPoints: c.totalPoints,
    weeklyPoints: c.weeklyPoints || [],
    atsCorrect: c.atsCorrect,
    atsTotal: c.atsTotal,
    currentStreak: c.currentStreak,
    bestWeek: c.bestWeek,
    worstWeek: c.worstWeek,
    perfectWeeks: c.perfectWeeks,
    bestBetHits: c.bestBetHits,
    bestBetTotal: c.bestBetTotal,
    propHits: c.propHits,
    propTotal: c.propTotal,
    weeksPlayed: c.weeksPlayed,
  }));
}

export type LeagueRosterMember = {
  membershipId: string;
  userId: string;
  name: string;
  division: "North" | "South" | "East" | "West";
  role: "commissioner" | "player";
  totalPoints: number;
  avatarUrl?: string | null;
  isBot?: boolean;
};

/** Live league roster from Supabase memberships (not local mock players). */
export async function loadLeagueRoster(): Promise<LeagueRosterMember[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();

  // Preferred: security-definer roster (includes bots reliably)
  {
    const { data, error } = await supabase.rpc("get_league_roster", {
      p_league_id: session.leagueId,
    });
    if (!error && Array.isArray(data) && data.length) {
      return (data as Record<string, unknown>[])
        .map((m) => {
          const role = m.role === "commissioner" ? "commissioner" : "player";
          const division =
            (m.division as LeagueRosterMember["division"]) || "North";
          return {
            membershipId: m.membership_id as string,
            userId: m.user_id as string,
            name: (m.display_name as string) || "Player",
            division,
            role: role as "commissioner" | "player",
            totalPoints: (m.total_points as number) || 0,
            avatarUrl: (m.avatar_url as string | null) || null,
            isBot: !!m.is_bot,
          };
        })
        .sort((a, b) => {
          // Humans first, then bots; alpha within each
          if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
    }
  }

  // Fallback: direct table select
  let rows: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select(
        "id, user_id, role, division, total_points, is_bot, profiles(display_name, avatar_url)"
      )
      .eq("league_id", session.leagueId);
    if (res.error && /is_bot|schema cache|column/i.test(res.error.message)) {
      const res2 = await supabase
        .from("memberships")
        .select(
          "id, user_id, role, division, total_points, profiles(display_name, avatar_url)"
        )
        .eq("league_id", session.leagueId);
      if (res2.error) {
        console.error("loadLeagueRoster fallback failed", res2.error);
      }
      rows = (res2.data as Record<string, unknown>[] | null) || null;
    } else if (res.error) {
      console.error("loadLeagueRoster failed", res.error);
      // Last resort without embeds
      const res3 = await supabase
        .from("memberships")
        .select("id, user_id, role, division, total_points")
        .eq("league_id", session.leagueId);
      rows = (res3.data as Record<string, unknown>[] | null) || null;
    } else {
      rows = (res.data as Record<string, unknown>[] | null) || null;
    }
  }

  if (!rows?.length) return [];

  // Resolve names if embed missing
  const needsNames = rows.some((m) => !m.profiles);
  let nameById = new Map<string, string>();
  if (needsNames) {
    const ids = rows.map((m) => m.user_id as string).filter(Boolean);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profs || []) {
      nameById.set(p.id as string, (p.display_name as string) || "Player");
    }
  }

  return rows
    .map((m: Record<string, unknown>) => {
      const profile = m.profiles as {
        display_name?: string;
        avatar_url?: string | null;
      } | null;
      const role = m.role === "commissioner" ? "commissioner" : "player";
      const division = (m.division as LeagueRosterMember["division"]) || "North";
      const uid = m.user_id as string;
      return {
        membershipId: m.id as string,
        userId: uid,
        name:
          profile?.display_name ||
          nameById.get(uid) ||
          "Player",
        division,
        role,
        totalPoints: (m.total_points as number) || 0,
        avatarUrl: profile?.avatar_url || null,
        isBot: !!m.is_bot,
      };
    })
    .sort((a, b) => {
      if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

/** True only when PostgREST cannot see the RPC (not permission / runtime errors). */
function rpcMissing(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("schema cache") ||
    m.includes("could not find the function") ||
    /function public\.\w+.*does not exist/i.test(msg) ||
    /function \w+.*does not exist/i.test(msg)
  );
}

function trialBotsSetupHint(raw: string) {
  if (rpcMissing(raw)) {
    return (
      "Trial bots not visible to the API yet. In Supabase SQL Editor run " +
      "supabase/trial-bots-verify.sql (grants + notify pgrst reload schema), " +
      "wait 10s, hard-refresh the site. Raw: " +
      raw
    );
  }
  return raw;
}

/** Add trial bots up to league capacity (32). Requires trial-bots.sql. */
export async function seedTrialBotsInCloud(
  count = 50
): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  seatsRemaining?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  // Respect public 32-player cap — only empty seats, never replace humans/bots
  const roster = await loadLeagueRoster();
  const seats = seatsRemaining(roster.length);
  const existingBots = roster.filter((m) => m.isBot).length;
  if (seats <= 0) {
    return {
      ok: true,
      added: 0,
      totalBots: existingBots,
      seatsRemaining: 0,
      error: undefined,
    };
  }
  // How many NEW bots we want (empty seats only; cap request size)
  const wantAdd = Math.min(count, seats, MAX_LEAGUE_PLAYERS);
  /**
   * seed_trial_bots evolved:
   * - Older SQL: p_count is target *total bot count* → need = p_count - existing bots
   * - Newer SQL (league-capacity-32): p_count is max to add, also capped by empty seats
   * Passing existingBots + wantAdd works for both (new SQL min()s with seats left).
   */
  const pCount = existingBots + wantAdd;

  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_trial_bots", {
    p_league_id: session.leagueId,
    p_count: pCount,
  });
  if (error) {
    return { ok: false, error: trialBotsSetupHint(error.message || "RPC failed") };
  }
  const row = (data || {}) as {
    ok?: boolean;
    added?: number;
    totalBots?: number;
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "seed_trial_bots returned not ok" };
  }
  return {
    ok: true,
    added: row.added ?? 0,
    totalBots: row.totalBots ?? 0,
    seatsRemaining: seats - (row.added ?? 0),
  };
}

/**
 * Add bots for empty seats only (never replaces humans/existing bots).
 *
 * - addCount: how many NEW bots to try to add (capped by open seats)
 * - targetTotal: optional "fill until league has N players" (e.g. 16 ideal, 32 max)
 * - weekNumber: if set and a card exists, lock bot picks for that week
 *
 * Ideal totals for clean dual brackets: 8 (4+4), 16 (8+8), 32 (16+16).
 */
export async function fillLeagueWithBotsToCap(opts?: {
  weekNumber?: number;
  /** Exact number of new bots to add (preferred when set). */
  addCount?: number;
  /** Grow roster toward this total size (e.g. 16 or 32). */
  targetTotal?: number;
}): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  botsFilled?: number;
  seatsBefore?: number;
  rosterBefore?: number;
  rosterAfter?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const roster = await loadLeagueRoster();
  const rosterBefore = roster.length;
  const seatsBefore = seatsRemaining(rosterBefore);
  if (seatsBefore <= 0) {
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      seatsBefore: 0,
      rosterBefore,
      rosterAfter: rosterBefore,
    };
  }

  let want = seatsBefore; // default: fill to 32
  if (opts?.addCount != null && Number.isFinite(opts.addCount)) {
    want = Math.max(0, Math.floor(opts.addCount));
  } else if (opts?.targetTotal != null && Number.isFinite(opts.targetTotal)) {
    const target = Math.min(
      MAX_LEAGUE_PLAYERS,
      Math.max(0, Math.floor(opts.targetTotal))
    );
    want = Math.max(0, target - rosterBefore);
  }
  want = Math.min(want, seatsBefore);

  if (want <= 0) {
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      seatsBefore,
      rosterBefore,
      rosterAfter: rosterBefore,
    };
  }

  const seed = await seedTrialBotsInCloud(want);
  if (!seed.ok) {
    return { ok: false, error: seed.error || "Failed to add bots" };
  }

  let botsFilled = 0;
  if (opts?.weekNumber != null) {
    const card = await loadWeekCard(opts.weekNumber);
    if (card && card.games.length > 0) {
      const fill = await seedBotPicksForWeekInCloud(opts.weekNumber);
      if (fill.ok) botsFilled = fill.botsFilled ?? 0;
      else if (seed.added === 0 && (seed.totalBots ?? 0) === 0) {
        return { ok: false, error: fill.error || "No bots to fill picks" };
      }
    }
  }

  const added = seed.added ?? 0;
  return {
    ok: true,
    added,
    totalBots: seed.totalBots ?? 0,
    botsFilled,
    seatsBefore,
    rosterBefore,
    rosterAfter: rosterBefore + added,
  };
}

/** Known trial-bot display names (from seed_trial_bots). */
const TRIAL_BOT_NAMES = new Set(
  [
    "DJ Chaos",
    "Couch QB",
    "Line Shopper",
    "Fade Master",
    "Late Lock",
    "Sunday Scaries",
    "Vegas Vic",
    "Confidence King",
    "Dog Walker",
    "Pick Wizard",
    "Spread Sheet",
    "Over Under",
    "Locksmith",
    "Parlay Pete",
    "Unit Manager",
    "Prime Time",
    "Red Zone Ron",
    "Blown Cover",
    "Juice Box",
    "Steam Chaser",
    "Home Cooker",
    "Road Warrior",
    "Weather Guy",
    "Injury Report",
    "Sharp Adjacent",
    "Public Heat",
    "Contrarian Cat",
    "Midweek Mike",
    "Kickoff Kate",
    "Prop Queen",
    "ATS Andy",
    "Moneyline Max",
    "Teaser Tina",
    "Hedge Fund",
    "Live Bet Larry",
    "Closing Line",
    "Opening Line",
    "Bad Beat Bill",
    "Lucky Bounce",
    "No Look Nick",
    "Deep Dive Dana",
    "Rivalry Rex",
    "Division Dom",
    "Prime Rib",
    "Noonball",
    "Late Window",
    "TNF Terror",
    "MNF Machine",
    "Bye Week Bob",
    "Commissioner Bot",
  ].map((n) => n.toLowerCase())
);

/**
 * Remove trial bots only — real logged-in players stay.
 * 1) Tries clear_trial_bots RPC if installed
 * 2) Always falls back to commissioner membership deletes for is_bot + known bot names
 *    (works even when the RPC was never run / is broken)
 */
export async function clearTrialBotsInCloud(): Promise<{
  ok: boolean;
  removed?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const supabase = createClient();
  let removed = 0;
  let rpcNote = "";

  // Preferred path: security-definer wipe (also deletes orphan bot auth users)
  try {
    const { data, error } = await supabase.rpc("clear_trial_bots", {
      p_league_id: session.leagueId,
    });
    if (!error && data && (data as { ok?: boolean }).ok !== false) {
      removed = Math.max(
        removed,
        Number((data as { removed?: number }).removed) || 0
      );
    } else if (error) {
      rpcNote = error.message || "";
    }
  } catch {
    /* fall through to membership delete */
  }

  // Fallback / second pass: remove anyone still on the roster who looks like a bot
  const roster = await loadLeagueRoster();
  const targets = roster.filter(
    (m) =>
      m.userId !== session.playerId &&
      (m.isBot === true || TRIAL_BOT_NAMES.has(m.name.trim().toLowerCase()))
  );

  const failures: string[] = [];
  for (const bot of targets) {
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("league_id", session.leagueId)
      .eq("user_id", bot.userId);
    if (error) {
      failures.push(`${bot.name}: ${error.message}`);
    } else {
      removed += 1;
    }
  }

  if (removed === 0 && targets.length === 0 && !rpcNote) {
    return {
      ok: true,
      removed: 0,
    };
  }

  if (removed === 0 && failures.length > 0) {
    return {
      ok: false,
      error:
        "Could not delete bot memberships (permission). Run supabase/clear-trial-bots-now.sql in Supabase SQL Editor, or run supabase/commissioner-remove-member.sql once. " +
        failures[0],
    };
  }

  if (removed === 0 && rpcNote && targets.length === 0) {
    return {
      ok: false,
      error:
        "No bots found via app, and database clear failed. Run supabase/clear-trial-bots-now.sql in Supabase SQL Editor (pastes wipe all @warroom.trial bots). " +
        rpcNote,
    };
  }

  return { ok: true, removed };
}

/** Auto-lock valid pick slips for every bot for a published week. */
export async function seedBotPicksForWeekInCloud(
  weekNumber: number
): Promise<{ ok: boolean; botsFilled?: number; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_bot_picks_for_week", {
    p_league_id: session.leagueId,
    p_week_number: weekNumber,
  });
  if (error) {
    return { ok: false, error: trialBotsSetupHint(error.message || "RPC failed") };
  }
  const row = (data || {}) as {
    ok?: boolean;
    botsFilled?: number;
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "Failed to fill bot picks" };
  }
  return { ok: true, botsFilled: row.botsFilled ?? 0 };
}

export async function updateMemberDivision(
  userId: string,
  division: "North" | "South" | "East" | "West"
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can change divisions" };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ division })
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeLeagueMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can remove players" };
  }
  if (userId === session.playerId) {
    return { ok: false, error: "Can't remove yourself (use Account to leave or delete the league)" };
  }

  const supabase = createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("commissioner_id")
    .eq("id", session.leagueId)
    .maybeSingle();

  if (league?.commissioner_id === userId) {
    return { ok: false, error: "Can't remove the commissioner" };
  }

  // Drop their picks so standings don't keep ghost scores (bots or humans)
  await supabase
    .from("picks")
    .delete()
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  try {
    await supabase
      .from("crystal_ball_picks")
      .delete()
      .eq("league_id", session.leagueId)
      .eq("user_id", userId);
  } catch {
    /* table may not exist / RLS */
  }

  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("league_id", session.leagueId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Round-robin assign North/South/East/West by name. Commissioner only. */
export async function autoBalanceDivisions(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can auto-balance" };
  }

  const roster = await loadLeagueRoster();
  if (!roster.length) return { ok: false, error: "No players in this league" };

  const divisions: LeagueRosterMember["division"][] = [
    "North",
    "South",
    "East",
    "West",
  ];
  const sorted = [...roster].sort((a, b) => a.name.localeCompare(b.name));
  const supabase = createClient();

  for (let i = 0; i < sorted.length; i++) {
    const member = sorted[i];
    const division = divisions[i % 4];
    if (member.division === division) continue;
    const { error } = await supabase
      .from("memberships")
      .update({ division })
      .eq("id", member.membershipId);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export type ResetSeasonResult = {
  ok: boolean;
  error?: string;
  membersKept?: number;
  picksDeleted?: number;
  cardsDeleted?: number;
  resultsDeleted?: number;
};

/**
 * Wipe season data (picks, cards, results, scores) but KEEP all members.
 * Commissioner only. Requires reset-season.sql RPC in Supabase.
 */
export async function resetSeasonInCloud(): Promise<ResetSeasonResult> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can reset the season" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("reset_league_season", {
    p_league_id: session.leagueId,
  });

  if (error) {
    const msg = error.message || "";
    if (/function|does not exist|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Reset function missing. Run supabase/reset-season.sql in the Supabase SQL Editor, then try again.",
      };
    }
    return { ok: false, error: msg || "Failed to reset season" };
  }

  const row = (data || {}) as {
    ok?: boolean;
    membersKept?: number;
    picksDeleted?: number;
    cardsDeleted?: number;
    resultsDeleted?: number;
  };

  // Clear local week caches so this device matches cloud
  try {
    for (let w = 0; w <= 16; w++) {
      localStorage.removeItem(`warroom-card-week-${w}`);
      localStorage.removeItem(`warroom-results-week-${w}`);
      localStorage.removeItem(`warroom-picks-week-${w}`);
    }
    localStorage.setItem("warroom-active-week", "0");
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    membersKept: row.membersKept,
    picksDeleted: row.picksDeleted,
    cardsDeleted: row.cardsDeleted,
    resultsDeleted: row.resultsDeleted,
  };
}
