import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import { Game, Prop, UserPick } from "@/lib/types";
import { scoreWeek, GameResult } from "@/lib/scoring";

export interface CloudCard {
  weekCardId: string;
  weekNumber: number;
  games: Game[];
  prop: Prop;
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
  return {
    id: row.id,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    spread: Number(row.spread),
    favorite: row.favorite === "away" ? "away" : "home",
    startTime: start,
    commenceTime: isIso ? start : undefined,
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

  if (existing?.id) {
    weekCardId = existing.id;
    await supabase
      .from("week_cards")
      .update({
        prop_question: opts.prop.question,
        prop_option_a: opts.prop.options[0],
        prop_option_b: opts.prop.options[1],
        prop_points: opts.prop.points,
      })
      .eq("id", weekCardId);
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
      })
      .select("id")
      .single();
    if (error || !card) {
      return { ok: false, error: error?.message || "Failed to create week card" };
    }
    weekCardId = card.id;
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
  }));

  const { data: inserted, error: gamesError } = await supabase
    .from("card_games")
    .insert(rows)
    .select("id, sort_order");

  if (gamesError) {
    return { ok: false, error: gamesError.message };
  }

  const gamesWithIds = opts.games.map((g, i) => {
    const row = inserted?.find((r) => r.sort_order === i);
    return row ? { ...g, id: row.id } : g;
  });

  try {
    localStorage.setItem(
      "warroom-card-week-1",
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

  return {
    weekCardId: card.id,
    weekNumber: card.week_number,
    games: games.map(mapCardGame),
    prop: {
      id: `prop-w${weekNumber}`,
      question: card.prop_question || "Prop",
      options: [card.prop_option_a || "Over", card.prop_option_b || "Under"],
      points: card.prop_points ?? 3,
    },
  };
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
    const idx = weekNumber - 1;
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
};

/** Live league roster from Supabase memberships (not local mock players). */
export async function loadLeagueRoster(): Promise<LeagueRosterMember[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, division, total_points, profiles(display_name)")
    .eq("league_id", session.leagueId);

  if (error || !rows) return [];

  return rows
    .map((m: Record<string, unknown>) => {
      const profile = m.profiles as { display_name?: string } | null;
      const role = m.role === "commissioner" ? "commissioner" : "player";
      const division = (m.division as LeagueRosterMember["division"]) || "North";
      return {
        membershipId: m.id as string,
        userId: m.user_id as string,
        name: profile?.display_name || "Player",
        division,
        role,
        totalPoints: (m.total_points as number) || 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
