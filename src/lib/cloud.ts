import { createClient } from "@/lib/supabase/client";
import { getSession, isOps } from "@/lib/league";
import {
  countByDivision,
  pickLeastPopulatedDivision,
  planAutoBalance,
  type DivisionName,
} from "@/lib/divisions";
import { Game, Prop, UserPick } from "@/lib/types";
import { scoreWeek, GameResult } from "@/lib/scoring";
import { weekTitle } from "@/lib/dates";
import { MAX_LEAGUE_PLAYERS, seatsRemaining } from "@/lib/league-limits";

/** weekly_points from Postgres may be int[] or a JSON object map. */
function normalizeWeeklyPointsField(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj)
      .map((k) => parseInt(k, 10))
      .filter((k) => !Number.isNaN(k));
    if (!keys.length) return [];
    const max = Math.max(...keys);
    const arr = new Array(max + 1).fill(0);
    for (const k of keys) {
      const n = Number(obj[String(k)]);
      arr[k] = Number.isFinite(n) ? n : 0;
    }
    return arr;
  }
  return [];
}

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

/** Ops (commissioner or deputy) set which week everyone should see. */
export async function setLeagueActiveWeek(
  weekNumber: number
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, error: "Commissioner or deputy required" };
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
  // Tenure for Elite Commish — true commissioner only (not deputies)
  if (session.isCommissioner && session.playerId) {
    try {
      const { recordCommissionerWeek } = await import("./commish-tenure");
      recordCommissionerWeek({
        userId: session.playerId,
        leagueId: session.leagueId,
        weekNumber,
      });
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

/** Active pick'em week for the league (cloud first, then localStorage). */
export async function loadLeagueActiveWeek(): Promise<number> {
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const saved = localStorage.getItem("warroom-active-week");
      const n = saved != null ? parseInt(saved, 10) : 9;
      return Number.isNaN(n) ? 9 : n;
    }
  } catch {
    /* ignore */
  }
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
  if (!session?.leagueId || !isOps()) {
    return { ok: false, error: "Commissioner or deputy required" };
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

  // Guest demo: local cards only
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const raw = localStorage.getItem(`warroom-card-week-${weekNumber}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as {
        games?: Game[];
        prop?: Prop;
        weekNumber?: number;
      };
      if (!data.games?.length) return null;
      return {
        weekCardId: `guest-card-w${weekNumber}`,
        weekNumber,
        publishedAt: new Date().toISOString(),
        games: data.games,
        prop: data.prop || {
          id: `prop-w${weekNumber}`,
          question: "Demo prop",
          options: ["Yes", "No"],
          points: 3,
        },
      };
    }
  } catch {
    /* fall through to cloud */
  }

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
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const { GUEST_SCORED_WEEKS, GUEST_ACTIVE_WEEK } = await import(
        "./guest-demo-seed"
      );
      return [...GUEST_SCORED_WEEKS, GUEST_ACTIVE_WEEK];
    }
  } catch {
    /* ignore */
  }
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
  /** Chaos Mode lock — pure random card, 2× week points */
  isChaos?: boolean;
}): Promise<{
  ok: boolean;
  error?: string;
  /** First & Final rare badge outcome for this save */
  firstFinal?: "earned" | "held" | "forfeit" | "not_first" | "ignored";
  /** Career/season pts added (+) or removed (−) for First & Final */
  firstFinalPointsDelta?: number;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) {
    return { ok: false, error: "Not signed into a league" };
  }

  // Guest demo: save picks locally so the player tutorial can complete
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const pickList = Object.values(opts.picks);
      if (!pickList.length) return { ok: false, error: "No picks to save" };
      const payload = {
        picks: opts.picks,
        bestBetId: opts.bestBetId,
        propChoice: opts.propChoice,
        lockedAt: new Date().toISOString(),
        isChaos: !!opts.isChaos,
      };
      localStorage.setItem(
        `warroom-picks-week-${opts.weekNumber}`,
        JSON.stringify(payload)
      );
      if (opts.isChaos) {
        try {
          const { spendChaosUse, CHAOS_BADGE_ID } = await import("./chaos-mode");
          spendChaosUse(opts.weekNumber, session.leagueId, session.playerId);
          const { grantPermanentBadgeId } = await import("./permanent-badges");
          grantPermanentBadgeId(session.playerId, CHAOS_BADGE_ID);
        } catch {
          /* ignore */
        }
      }
      try {
        const { markEngagement } = await import("./engagement");
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) {
          markEngagement(session.playerId, "locked_after_22");
        }
      } catch {
        /* ignore */
      }
      return { ok: true, firstFinal: "ignored" };
    }
  } catch {
    /* fall through to cloud */
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id || session.playerId;
  const leagueId = session.leagueId;
  const pickList = Object.values(opts.picks);
  if (!pickList.length) return { ok: false, error: "No picks to save" };

  const { data: existing } = await supabase
    .from("picks")
    .select("id, locked_at")
    .eq("league_id", leagueId)
    .eq("user_id", uid)
    .eq("week_number", opts.weekNumber)
    .maybeSingle();

  const isFirstSave = !existing?.id;
  let pickId: string;
  // Chaos spend + badge before write (so flames fire even if column missing)
  if (opts.isChaos) {
    try {
      const { spendChaosUse, CHAOS_BADGE_ID } = await import("./chaos-mode");
      const spent = spendChaosUse(opts.weekNumber, leagueId, uid);
      if (!spent.ok) return { ok: false, error: spent.error };
      const { grantPermanentBadgeId } = await import("./permanent-badges");
      grantPermanentBadgeId(uid, CHAOS_BADGE_ID);
    } catch {
      /* ignore badge */
    }
  }

  if (existing?.id) {
    pickId = existing.id;
    // Keep original locked_at — re-save is an edit, not a new first-lock time
    // Once Chaos, stay Chaos (no silent un-chaos on edit — use already spent)
    const updatePayload: Record<string, unknown> = {
      prop_choice: opts.propChoice,
      best_bet_game_id: opts.bestBetId,
      updated_at: new Date().toISOString(),
    };
    if (opts.isChaos) updatePayload.is_chaos = true;
    const { error } = await supabase
      .from("picks")
      .update(updatePayload)
      .eq("id", pickId);
    if (error) {
      // Column missing: retry without is_chaos
      if (/is_chaos|column/i.test(error.message || "")) {
        const { error: e2 } = await supabase
          .from("picks")
          .update({
            prop_choice: opts.propChoice,
            best_bet_game_id: opts.bestBetId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pickId);
        if (e2) return { ok: false, error: e2.message };
      } else {
        return { ok: false, error: error.message };
      }
    }
    await supabase.from("pick_games").delete().eq("pick_id", pickId);
  } else {
    const insertPayload: Record<string, unknown> = {
      league_id: leagueId,
      user_id: uid,
      week_number: opts.weekNumber,
      prop_choice: opts.propChoice,
      best_bet_game_id: opts.bestBetId,
      locked_at: new Date().toISOString(),
    };
    if (opts.isChaos) insertPayload.is_chaos = true;
    let { data: row, error } = await supabase
      .from("picks")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error && /is_chaos|column/i.test(error.message || "")) {
      delete insertPayload.is_chaos;
      const retry = await supabase
        .from("picks")
        .insert(insertPayload)
        .select("id")
        .single();
      row = retry.data;
      error = retry.error;
    }
    if (error || !row) return { ok: false, error: error?.message || "Failed to save picks" };
    pickId = row.id as string;
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

  // —— First & Final rare: first human lock + never change the slip ——
  let firstFinal: "earned" | "held" | "forfeit" | "not_first" | "ignored" =
    "ignored";
  let firstFinalPointsDelta = 0;
  try {
    const {
      onPicksSavedForFirstFinal,
      slipFingerprint,
    } = await import("./first-final");
    const hash = slipFingerprint(opts.picks, opts.bestBetId, opts.propChoice);
    let wasFirstInLeague = false;

    if (isFirstSave) {
      // Try claim table (first insert wins). Requires supabase/first-lock-badge.sql
      const { data: claimRow, error: claimErr } = await supabase
        .from("first_lock_claims")
        .insert({
          league_id: leagueId,
          week_number: opts.weekNumber,
          user_id: uid,
          slip_hash: hash,
          dirty: false,
        })
        .select("user_id")
        .maybeSingle();

      if (!claimErr && claimRow?.user_id === uid) {
        wasFirstInLeague = true;
      } else if (claimErr) {
        // PK conflict = someone else already first, or table missing
        const { data: existingClaim } = await supabase
          .from("first_lock_claims")
          .select("user_id, dirty, slip_hash")
          .eq("league_id", leagueId)
          .eq("week_number", opts.weekNumber)
          .maybeSingle();
        wasFirstInLeague = existingClaim?.user_id === uid;
      }
    } else {
      // Re-save: if we own the claim, mark dirty when slip hash changes
      const { data: existingClaim } = await supabase
        .from("first_lock_claims")
        .select("user_id, dirty, slip_hash")
        .eq("league_id", leagueId)
        .eq("week_number", opts.weekNumber)
        .maybeSingle();
      if (existingClaim?.user_id === uid) {
        wasFirstInLeague = true;
        if (existingClaim.slip_hash !== hash && !existingClaim.dirty) {
          await supabase
            .from("first_lock_claims")
            .update({ dirty: true, slip_hash: hash })
            .eq("league_id", leagueId)
            .eq("week_number", opts.weekNumber)
            .eq("user_id", uid);
        }
      }
    }

    const result = onPicksSavedForFirstFinal({
      userId: uid,
      leagueId,
      weekNumber: opts.weekNumber,
      isFirstSave,
      wasFirstInLeague,
      picks: opts.picks,
      bestBetId: opts.bestBetId,
      propChoice: opts.propChoice,
    });
    firstFinal = result.status;

    // Career points: bank on earn, unbank only when badge fully lost
    // Season pts follow live badge eval (earned → +25, lost → 0 for this badge)
    try {
      const { bankCareerBadgeId, unbankCareerBadgeId } = await import(
        "./career-cheevo"
      );
      const {
        FIRST_FINAL_BADGE_ID,
        firstFinalEarned,
      } = await import("./first-final");
      const PTS = 25;

      if (result.status === "earned") {
        const banked = bankCareerBadgeId(uid, FIRST_FINAL_BADGE_ID, PTS);
        firstFinalPointsDelta = banked.banked ? PTS : 0;
      } else if (result.status === "forfeit") {
        if (!firstFinalEarned(uid)) {
          const un = unbankCareerBadgeId(uid, FIRST_FINAL_BADGE_ID, PTS);
          firstFinalPointsDelta = un.removed ? -PTS : 0;
        }
      }
    } catch {
      /* career bank optional */
    }
  } catch {
    firstFinal = "ignored";
  }

  try {
    const { markEngagement } = await import("./engagement");
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) {
      markEngagement(uid, "locked_after_22");
    }
  } catch {
    /* ignore */
  }

  return { ok: true, firstFinal, firstFinalPointsDelta };
}

export async function loadMyPicks(weekNumber = 1) {
  const session = getSession();
  if (!session?.leagueId) return null;

  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const raw = localStorage.getItem(`warroom-picks-week-${weekNumber}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as {
        picks?: Record<string, UserPick>;
        bestBetId?: string | null;
        propChoice?: string | null;
        lockedAt?: string | null;
        isChaos?: boolean;
      };
      if (!data.picks || !Object.keys(data.picks).length) return null;
      return {
        picks: data.picks,
        bestBetId: data.bestBetId ?? null,
        propChoice: data.propChoice ?? null,
        lockedAt: data.lockedAt ?? null,
        isChaos: !!data.isChaos,
      };
    }
  } catch {
    /* fall through */
  }

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
  const isChaos =
    !!(pick as { is_chaos?: boolean }).is_chaos ||
    (await import("./chaos-mode")).isWeekChaosForUser(
      weekNumber,
      session.leagueId,
      uid
    );
  if (isChaos && pick.locked_at) {
    try {
      const { markChaosActive } = await import("./chaos-mode");
      markChaosActive(session.leagueId, uid, weekNumber);
    } catch {
      /* ignore */
    }
  }
  return {
    picks,
    bestBetId: pick.best_bet_game_id as string | null,
    propChoice: pick.prop_choice as string | null,
    lockedAt: pick.locked_at as string | null,
    isChaos,
  };
}

/** One player's full slip for the week board (after scoring / RLS allows). */
export type WeekBoardSlip = {
  userId: string;
  name: string;
  isBot?: boolean;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
  lockedAt: string | null;
  totalPoints: number | null;
  /** Chaos Mode this week — flames on the name */
  isChaos?: boolean;
};

/**
 * Everyone's locked slips for a week.
 * Opens after first kickoff (card locked) or after scoring
 * (RLS: picks-reveal-after-lock.sql). Secret until then.
 */
export async function loadLeagueWeekBoard(weekNumber: number): Promise<{
  ok: boolean;
  slips: WeekBoardSlip[];
  scored: boolean;
  /** True once first kickoff hit (or scored) — board should be open */
  lockedOpen: boolean;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return {
      ok: false,
      slips: [],
      scored: false,
      lockedOpen: false,
      error: "No league",
    };
  }
  try {
    const supabase = createClient();
    const leagueId = session.leagueId;

    const { data: wr } = await supabase
      .from("week_results")
      .select("id, week_number")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber)
      .maybeSingle();
    const scored = !!wr;

    // Client-side lock check (first kickoff) for messaging + soft gate
    let lockedOpen = scored;
    try {
      const card = await loadWeekCard(weekNumber);
      if (card?.games?.length) {
        const { isCardLockDeadlinePassed } = await import("./dates");
        if (isCardLockDeadlinePassed(card.games)) lockedOpen = true;
      }
    } catch {
      /* ignore */
    }

    const { data: members } = await supabase
      .from("memberships")
      .select("user_id, is_bot, profiles(display_name)")
      .eq("league_id", leagueId);

    let pickRows: Record<string, unknown>[] | null = null;
    let pickErr: { message?: string } | null = null;
    {
      const res = await supabase
        .from("picks")
        .select(
          "id, user_id, prop_choice, best_bet_game_id, locked_at, total_points, is_chaos"
        )
        .eq("league_id", leagueId)
        .eq("week_number", weekNumber);
      if (res.error && /is_chaos|column/i.test(res.error.message || "")) {
        const res2 = await supabase
          .from("picks")
          .select(
            "id, user_id, prop_choice, best_bet_game_id, locked_at, total_points"
          )
          .eq("league_id", leagueId)
          .eq("week_number", weekNumber);
        pickRows = (res2.data || null) as Record<string, unknown>[] | null;
        pickErr = res2.error;
      } else {
        pickRows = (res.data || null) as Record<string, unknown>[] | null;
        pickErr = res.error;
      }
    }

    if (pickErr) {
      return {
        ok: false,
        slips: [],
        scored,
        lockedOpen,
        error: lockedOpen
          ? `${pickErr.message} — run supabase/picks-reveal-after-lock.sql in Supabase if you haven’t.`
          : "Picks stay secret until the first kickoff on this card (then The Board opens).",
      };
    }

    // If RLS only returns your row (old policies), still try — caller sees partial
    if (!lockedOpen && !isOps()) {
      return {
        ok: false,
        slips: [],
        scored,
        lockedOpen: false,
        error:
          "Picks stay secret until the first kickoff locks the card. Then everyone can open The Board.",
      };
    }

    const pickIds = (pickRows || []).map((p) => p.id as string);
    const gamesByPick = new Map<string, Record<string, UserPick>>();
    if (pickIds.length) {
      const { data: pgs } = await supabase
        .from("pick_games")
        .select(
          "pick_id, card_game_id, side, confidence, is_best_bet, locked_spread, locked_favorite"
        )
        .in("pick_id", pickIds);
      for (const g of pgs || []) {
        const pid = g.pick_id as string;
        const map = gamesByPick.get(pid) || {};
        map[g.card_game_id as string] = {
          gameId: g.card_game_id as string,
          pick: g.side === "away" ? "away" : "home",
          confidence: Number(g.confidence) || 0,
          isBestBet: !!g.is_best_bet,
          lockedSpread: Number(g.locked_spread ?? 0),
          lockedFavorite: g.locked_favorite === "away" ? "away" : "home",
        };
        gamesByPick.set(pid, map);
      }
    }

    const pickByUser = new Map(
      (pickRows || []).map((p) => [p.user_id as string, p])
    );
    const slips: WeekBoardSlip[] = [];

    for (const m of members || []) {
      if (m.is_bot) continue;
      const userId = m.user_id as string;
      const profile = m.profiles as { display_name?: string } | null;
      const name = profile?.display_name || "Player";
      const pick = pickByUser.get(userId);
      if (!pick) {
        slips.push({
          userId,
          name,
          isBot: false,
          picks: {},
          bestBetId: null,
          propChoice: null,
          lockedAt: null,
          totalPoints: null,
          isChaos: false,
        });
        continue;
      }
      const chaos = !!(pick as { is_chaos?: boolean }).is_chaos;
      if (chaos) {
        try {
          const { markChaosActive } = await import("./chaos-mode");
          markChaosActive(leagueId, userId, weekNumber);
        } catch {
          /* ignore */
        }
      }
      slips.push({
        userId,
        name,
        isBot: false,
        picks: gamesByPick.get(pick.id as string) || {},
        bestBetId: (pick.best_bet_game_id as string) || null,
        propChoice: (pick.prop_choice as string) || null,
        lockedAt: (pick.locked_at as string) || null,
        totalPoints:
          pick.total_points != null ? Number(pick.total_points) : null,
        isChaos: chaos,
      });
    }

    // Sort: most points first, then name
    slips.sort((a, b) => {
      const pa = a.totalPoints ?? -1;
      const pb = b.totalPoints ?? -1;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });

    return { ok: true, slips, scored, lockedOpen };
  } catch (e: unknown) {
    return {
      ok: false,
      slips: [],
      scored: false,
      lockedOpen: false,
      error: e instanceof Error ? e.message : "Failed to load board",
    };
  }
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
 * Ops only — who has locked picks for a week.
 * Does not return sides/confidence (privacy). Use for "who hasn't picked".
 */
export async function loadPickSubmissionStatus(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; rows: PickSubmissionStatus[]; error?: string }> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return { ok: false, rows: [], error: "Commissioner or deputy only" };
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
 * Who failed to lock a card for a scored week (Gazette "milk carton" roast).
 * Any league member can call this — returns names only, no sides/confidence.
 * Falls back to empty if RLS blocks pick rows.
 */
export async function loadWeekNoLockNames(
  weekNumber: number,
  expectedGames = 5
): Promise<string[]> {
  const session = getSession();
  if (!session?.leagueId) return [];

  try {
    const supabase = createClient();
    const leagueId = session.leagueId;

    const { data: members, error: memErr } = await supabase
      .from("memberships")
      .select("user_id, is_bot, profiles(display_name)")
      .eq("league_id", leagueId);

    if (memErr || !members?.length) return [];

    const { data: pickRows, error: pickErr } = await supabase
      .from("picks")
      .select("id, user_id, prop_choice, best_bet_game_id, locked_at")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber);

    // Can't see others' picks → caller may use score-based fallback
    if (pickErr) return [];

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

    const ghosts: string[] = [];
    for (const m of members) {
      if (m.is_bot) continue;
      const userId = m.user_id as string;
      const profile = m.profiles as { display_name?: string } | null;
      const name = profile?.display_name || "Player";
      const pick = pickByUser.get(userId);
      const gamePickCount = pick
        ? countByPickId.get(pick.id as string) || 0
        : 0;
      const locked = !!(pick?.locked_at);
      const complete =
        !!pick &&
        locked &&
        gamePickCount >= expectedGames &&
        !!pick.prop_choice &&
        !!pick.best_bet_game_id;

      // Never locked a full card = milk carton material
      if (!complete) ghosts.push(name);
    }

    return ghosts.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Ops post a public announcement naming who still needs picks.
 * Does not reveal actual picks — only names + complete/partial/missing.
 */
export async function postMissingPicksAnnouncement(
  weekNumber: number,
  expectedGames = 5
): Promise<{ ok: boolean; error?: string; missingCount?: number }> {
  const session = getSession();
  if (!session?.leagueId || !isOps() || !session.playerId) {
    return { ok: false, error: "Commissioner or deputy required" };
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
    `League call-out — these players still need a complete ${weekLabel} card (all games + confidence + Best Bet + prop):`,
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
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const { getGuestScoredWeeks } = await import("./guest-demo-seed");
      return getGuestScoredWeeks();
    }
  } catch {
    /* ignore */
  }
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
  if (!session?.leagueId || !isOps()) {
    return { ok: false, scoredCount: 0, error: "Commissioner or deputy only" };
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

  let allPicks: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("picks")
      .select("id, user_id, prop_choice, best_bet_game_id, total_points, is_chaos")
      .eq("league_id", leagueId)
      .eq("week_number", weekNumber);
    if (res.error && /is_chaos|column/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("picks")
        .select("id, user_id, prop_choice, best_bet_game_id, total_points")
        .eq("league_id", leagueId)
        .eq("week_number", weekNumber);
      if (res2.error)
        return { ok: false, scoredCount: 0, error: res2.error.message };
      allPicks = (res2.data || []) as Record<string, unknown>[];
    } else if (res.error) {
      return { ok: false, scoredCount: 0, error: res.error.message };
    } else {
      allPicks = (res.data || []) as Record<string, unknown>[];
    }
  }
  if (!allPicks?.length) {
    return { ok: true, scoredCount: 0, error: "No locked picks found for this week yet" };
  }

  const details: { name: string; points: number }[] = [];
  let scoredCount = 0;

  for (const pickRow of allPicks) {
    const pickId = pickRow.id as string;
    const userId = pickRow.user_id as string;
    const { data: pickGames } = await supabase
      .from("pick_games")
      .select("*")
      .eq("pick_id", pickId);

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

    const isChaos = !!pickRow.is_chaos;
    const weekScore = scoreWeek(
      picksMap,
      (pickRow.best_bet_game_id as string) || null,
      (pickRow.prop_choice as string) || null,
      opts.games,
      opts.results,
      opts.prop,
      opts.propResult,
      isChaos
    );

    const previousPoints = pickRow.total_points as number | null;
    const alreadyScored = previousPoints !== null && previousPoints !== undefined;

    await supabase
      .from("picks")
      .update({ total_points: weekScore.totalPoints })
      .eq("id", pickId);

    const { data: membership } = await supabase
      .from("memberships")
      .select("*")
      .eq("league_id", leagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) continue;

    const pts = weekScore.totalPoints;
    const gamesCount = opts.games.length;
    const bestBetHit = weekScore.gameScores.some((g) => g.isBestBet && g.correct);
    const hadBestBet = weekScore.gameScores.some((g) => g.isBestBet);
    const hadPush = weekScore.gameScores.some((g) => g.pushed);
    if (hadPush) {
      try {
        const { markEngagement } = await import("./engagement");
        markEngagement(pickRow.user_id as string, "push_recorded");
      } catch {
        /* ignore */
      }
    }

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

  // Snapshot Gazette edition for the archive (survives until season reset)
  try {
    const { snapshotGazetteAfterScore } = await import("@/lib/gazette");
    const players = await loadLeaguePlayers();
    await snapshotGazetteAfterScore(players, weekNumber);
  } catch {
    /* best-effort */
  }

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
        weeklyPoints: normalizeWeeklyPointsField(m.weekly_points),
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
  try {
    const { isGuestMode } = await import("./guest-mode");
    if (isGuestMode()) {
      const { loadPlayers } = await import("./store");
      return loadPlayers();
    }
  } catch {
    /* fall through */
  }
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
  name: string;
  userId: string;
  division: "North" | "South" | "East" | "West";
  role: "commissioner" | "player";
  totalPoints: number;
  avatarUrl?: string | null;
  isBot?: boolean;
  isModerator?: boolean;
  lockerMuted?: boolean;
  isDeputy?: boolean;
  /** memberships.joined_at — join-order profile titles */
  joinedAt?: string | null;
  /** profiles.equipped_title_id — badge worn as name title */
  equippedTitleId?: string | null;
  /** profiles.equipped_border_id — avatar ring style */
  equippedBorderId?: string | null;
  /** profiles.last_seen_at — last app open */
  lastSeenAt?: string | null;
};

/** Best-effort: load titles, borders, last_seen for roster user ids. */
async function attachEquippedTitles(
  members: LeagueRosterMember[]
): Promise<LeagueRosterMember[]> {
  if (!members.length) return members;
  try {
    const supabase = createClient();
    const ids = [...new Set(members.map((m) => m.userId).filter(Boolean))];
    if (!ids.length) return members;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, equipped_title_id, equipped_border_id, last_seen_at")
      .in("id", ids);
    if (error || !data?.length) {
      // Columns may be partial — try smaller selects
      try {
        const { data: d2 } = await supabase
          .from("profiles")
          .select("id, equipped_title_id, equipped_border_id")
          .in("id", ids);
        if (d2?.length) {
          const titleMap = new Map<string, string | null>();
          const borderMap = new Map<string, string | null>();
          for (const row of d2) {
            titleMap.set(
              row.id as string,
              (row.equipped_title_id as string | null) || null
            );
            borderMap.set(
              row.id as string,
              (row.equipped_border_id as string | null) || null
            );
          }
          return members.map((m) => ({
            ...m,
            equippedTitleId: titleMap.get(m.userId) ?? m.equippedTitleId ?? null,
            equippedBorderId:
              borderMap.get(m.userId) ?? m.equippedBorderId ?? null,
          }));
        }
      } catch {
        /* fall through */
      }
      return members;
    }
    const titleMap = new Map<string, string | null>();
    const borderMap = new Map<string, string | null>();
    const seenMap = new Map<string, string | null>();
    for (const row of data) {
      titleMap.set(
        row.id as string,
        (row.equipped_title_id as string | null) || null
      );
      borderMap.set(
        row.id as string,
        (row.equipped_border_id as string | null) || null
      );
      seenMap.set(
        row.id as string,
        (row.last_seen_at as string | null) || null
      );
    }
    return members.map((m) => ({
      ...m,
      equippedTitleId: titleMap.get(m.userId) ?? m.equippedTitleId ?? null,
      equippedBorderId: borderMap.get(m.userId) ?? m.equippedBorderId ?? null,
      lastSeenAt: seenMap.get(m.userId) ?? m.lastSeenAt ?? null,
    }));
  } catch {
    return members;
  }
}

/**
 * Load join times for profile titles.
 * Prefer permanent first-join (survives leave/rejoin); fall back to memberships.joined_at.
 */
async function loadJoinedAtByUser(
  leagueId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const supabase = createClient();

    // Permanent first join (leave + rejoin keeps rank)
    const { data: firsts, error: firstErr } = await supabase
      .from("league_first_joins")
      .select("user_id, first_joined_at")
      .eq("league_id", leagueId);
    if (!firstErr && firsts?.length) {
      for (const row of firsts) {
        const uid = row.user_id as string;
        const at = row.first_joined_at as string | null;
        if (uid && at) map.set(uid, at);
      }
    }

    // Memberships: fill gaps + never replace an earlier first-join
    const { data } = await supabase
      .from("memberships")
      .select("user_id, joined_at")
      .eq("league_id", leagueId);
    for (const row of data || []) {
      const uid = row.user_id as string;
      const at = row.joined_at as string | null;
      if (!uid || !at) continue;
      const prev = map.get(uid);
      if (!prev || new Date(at).getTime() < new Date(prev).getTime()) {
        map.set(uid, at);
      }
    }
  } catch {
    /* optional */
  }
  return map;
}

/**
 * Stamp permanent first-join for this user in the league.
 * Leave/rejoin cannot wipe OG / cool titles.
 * Requires supabase/join-order.sql (safe no-op if missing).
 */
export async function recordLeagueFirstJoin(
  leagueId?: string
): Promise<{ ok: boolean; firstJoinedAt?: string }> {
  const session = getSession();
  const lid = leagueId || session?.leagueId;
  if (!lid || !session?.playerId) return { ok: false };

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || session.playerId;

    // Prefer RPC (restores memberships.joined_at to original)
    const { data: rpcAt, error: rpcErr } = await supabase.rpc(
      "record_league_first_join",
      { p_league_id: lid, p_user_id: uid }
    );
    if (!rpcErr && rpcAt) {
      return { ok: true, firstJoinedAt: String(rpcAt) };
    }

    // Direct insert if RPC not installed yet
    const now = new Date().toISOString();
    const { error: insErr } = await supabase.from("league_first_joins").insert({
      league_id: lid,
      user_id: uid,
      first_joined_at: now,
    });
    if (insErr && !/duplicate|unique|23505/i.test(insErr.message || "")) {
      // Table missing or blocked — ignore
      return { ok: false };
    }

    const { data: row } = await supabase
      .from("league_first_joins")
      .select("first_joined_at")
      .eq("league_id", lid)
      .eq("user_id", uid)
      .maybeSingle();

    const at = (row?.first_joined_at as string) || now;
    // Best-effort restore membership joined_at
    await supabase
      .from("memberships")
      .update({ joined_at: at })
      .eq("league_id", lid)
      .eq("user_id", uid);

    return { ok: true, firstJoinedAt: at };
  } catch {
    return { ok: false };
  }
}

/** Live league roster from Supabase memberships (not local mock players). */
export async function loadLeagueRoster(): Promise<LeagueRosterMember[]> {
  const session = getSession();
  if (!session?.leagueId) return [];
  const supabase = createClient();
  const joinedMap = await loadJoinedAtByUser(session.leagueId);

  // Preferred: security-definer roster (includes bots reliably)
  {
    const { data, error } = await supabase.rpc("get_league_roster", {
      p_league_id: session.leagueId,
    });
    if (!error && Array.isArray(data) && data.length) {
      const mapped = (data as Record<string, unknown>[])
        .map((m) => {
          const role = m.role === "commissioner" ? "commissioner" : "player";
          const division =
            (m.division as LeagueRosterMember["division"]) || "North";
          const userId = m.user_id as string;
          return {
            membershipId: m.membership_id as string,
            userId,
            name: (m.display_name as string) || "Player",
            division,
            role: role as "commissioner" | "player",
            totalPoints: (m.total_points as number) || 0,
            avatarUrl: (m.avatar_url as string | null) || null,
            isBot: !!m.is_bot,
            isModerator: !!m.is_moderator,
            lockerMuted: !!m.locker_muted,
            isDeputy: !!m.is_deputy,
            joinedAt:
              (m.joined_at as string | null) ||
              joinedMap.get(userId) ||
              null,
            equippedTitleId:
              (m.equipped_title_id as string | null) || null,
          };
        })
        .sort((a, b) => {
          // Humans first, then bots; alpha within each
          if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      return attachEquippedTitles(mapped);
    }
  }

  // Fallback: direct table select
  let rows: Record<string, unknown>[] | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select(
        "id, user_id, role, division, total_points, joined_at, is_bot, is_moderator, locker_muted, is_deputy, profiles(display_name, avatar_url)"
      )
      .eq("league_id", session.leagueId);
    if (res.error && /is_bot|schema cache|column/i.test(res.error.message)) {
      const res2 = await supabase
        .from("memberships")
        .select(
          "id, user_id, role, division, total_points, joined_at, profiles(display_name, avatar_url)"
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
        .select("id, user_id, role, division, total_points, joined_at")
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

  const mapped = rows
    .map((m: Record<string, unknown>) => {
      const profile = m.profiles as {
        display_name?: string;
        avatar_url?: string | null;
        equipped_title_id?: string | null;
      } | null;
      const role: LeagueRosterMember["role"] =
        m.role === "commissioner" ? "commissioner" : "player";
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
        isModerator: !!m.is_moderator,
        lockerMuted: !!m.locker_muted,
        isDeputy: !!m.is_deputy,
        joinedAt:
          (m.joined_at as string | null) || joinedMap.get(uid) || null,
        equippedTitleId: profile?.equipped_title_id ?? null,
      };
    })
    .sort((a, b) => {
      if (!!a.isBot !== !!b.isBot) return a.isBot ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  return attachEquippedTitles(mapped);
}

/** Commissioner appoints mods/deputies; staff can mute for Locker Room. */
export async function setMemberModeration(opts: {
  userId: string;
  isModerator?: boolean | null;
  lockerMuted?: boolean | null;
  isDeputy?: boolean | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId) return { ok: false, error: "No league" };
  if (opts.isDeputy != null && !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can appoint deputies" };
  }
  if (opts.isModerator != null && !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can appoint moderators" };
  }
  if (
    opts.lockerMuted != null &&
    !session.isCommissioner &&
    !session.isModerator
  ) {
    return { ok: false, error: "Commissioner or moderator only" };
  }
  // Need at least one permitted action path
  if (!session.isCommissioner && !session.isModerator) {
    return { ok: false, error: "Commissioner or moderator only" };
  }
  const supabase = createClient();
  const patch: Record<string, boolean> = {};
  if (opts.isDeputy != null) patch.is_deputy = opts.isDeputy;
  if (opts.isModerator != null) patch.is_moderator = opts.isModerator;
  if (opts.lockerMuted != null) patch.locker_muted = opts.lockerMuted;

  // Commissioner: prefer direct update (make + remove deputy/mod/mute).
  // Works once columns exist; avoids stale RPC signature issues.
  if (session.isCommissioner && Object.keys(patch).length) {
    const { error: upErr } = await supabase
      .from("memberships")
      .update(patch)
      .eq("league_id", session.leagueId)
      .eq("user_id", opts.userId);
    if (!upErr) return { ok: true };
    // Fall through to RPC if column missing / RLS blocks
    if (!/column|schema cache|is_deputy|is_moderator|locker_muted/i.test(upErr.message || "")) {
      // still try RPC below
    } else {
      return {
        ok: false,
        error:
          `Roles incomplete (${upErr.message}). Run supabase/staff-roles-setup.sql in Supabase SQL Editor once.`,
      };
    }
  }

  const { data, error } = await supabase.rpc("set_member_moderation", {
    p_league_id: session.leagueId,
    p_user_id: opts.userId,
    p_is_moderator: opts.isModerator ?? null,
    p_locker_muted: opts.lockerMuted ?? null,
    p_is_deputy: opts.isDeputy ?? null,
  });
  if (!error) {
    if (data && (data as { ok?: boolean }).ok === false) {
      return { ok: false, error: "Moderation update failed" };
    }
    return { ok: true };
  }

  if (/function|does not exist|schema cache|p_is_deputy|could not find/i.test(error.message || "")) {
    return {
      ok: false,
      error:
        `Roles not set up (${error.message}). Run supabase/staff-roles-setup.sql in Supabase SQL Editor once.`,
    };
  }
  return { ok: false, error: error.message };
}

/** Refresh isModerator / isDeputy on the local session from memberships. */
export async function refreshStaffSessionFlags(): Promise<void> {
  const session = getSession();
  if (!session?.leagueId || !session.playerId) return;
  if (session.isCommissioner) return;
  const supabase = createClient();
  let data: { is_moderator?: boolean; is_deputy?: boolean } | null = null;
  {
    const res = await supabase
      .from("memberships")
      .select("is_moderator, is_deputy, locker_muted")
      .eq("league_id", session.leagueId)
      .eq("user_id", session.playerId)
      .maybeSingle();
    if (res.error && /is_deputy|column|schema/i.test(res.error.message || "")) {
      const res2 = await supabase
        .from("memberships")
        .select("is_moderator, locker_muted")
        .eq("league_id", session.leagueId)
        .eq("user_id", session.playerId)
        .maybeSingle();
      data = res2.data as { is_moderator?: boolean } | null;
    } else {
      data = res.data as { is_moderator?: boolean; is_deputy?: boolean } | null;
    }
  }
  if (!data) return;
  try {
    const raw = localStorage.getItem("warroom-session");
    if (!raw) return;
    const s = JSON.parse(raw) as Record<string, unknown>;
    s.isModerator = !!data.is_moderator;
    s.isDeputy = !!data.is_deputy;
    localStorage.setItem("warroom-session", JSON.stringify(s));
  } catch {
    /* ignore */
  }
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

/**
 * Mid-season replacement bots enter at the league-average of real humans
 * so they stay competitive (challenge for the rest of the field).
 * Pre-season practice bots stay at 0.
 */
async function boostNewBotsToLeagueAverage(beforeBotUserIds: Set<string>): Promise<{
  boosted: number;
  avgPoints: number;
  avgWeeks: number;
}> {
  const session = getSession();
  if (!session?.leagueId) return { boosted: 0, avgPoints: 0, avgWeeks: 0 };

  const supabase = createClient();
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, total_points, weeks_played, is_bot")
    .eq("league_id", session.leagueId);

  if (error || !rows?.length) {
    return { boosted: 0, avgPoints: 0, avgWeeks: 0 };
  }

  type Mem = {
    id: string;
    user_id: string;
    total_points?: number | null;
    weeks_played?: number | null;
    is_bot?: boolean | null;
  };
  const list = rows as Mem[];
  const humans = list.filter((r) => !r.is_bot);
  // League average of real players (the competitive pack)
  if (!humans.length) return { boosted: 0, avgPoints: 0, avgWeeks: 0 };

  const avgPoints = Math.round(
    humans.reduce((s, r) => s + (Number(r.total_points) || 0), 0) /
      humans.length
  );
  const avgWeeks = Math.round(
    humans.reduce((s, r) => s + (Number(r.weeks_played) || 0), 0) /
      humans.length
  );

  const newBots = list.filter(
    (r) => !!r.is_bot && r.user_id && !beforeBotUserIds.has(r.user_id)
  );
  if (!newBots.length) {
    return { boosted: 0, avgPoints, avgWeeks };
  }

  let boosted = 0;
  for (const bot of newBots) {
    const { error: upErr } = await supabase
      .from("memberships")
      .update({
        total_points: avgPoints,
        weeks_played: avgWeeks,
      })
      .eq("id", bot.id);
    if (!upErr) boosted += 1;
  }
  return { boosted, avgPoints, avgWeeks };
}

/** Add trial bots up to league capacity (32). Requires trial-bots.sql. */
export async function seedTrialBotsInCloud(
  count = 50,
  opts?: {
    /**
     * Mid-season: allow pad bots for empty seats after people leave.
     * New bots get league-average points so they can still compete.
     */
    midSeasonReplacement?: boolean;
  }
): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  seatsRemaining?: number;
  /** Mid-season: points assigned to each new bot */
  avgPoints?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  let midSeason = !!opts?.midSeasonReplacement;
  try {
    const { isPreseasonCommishToolsAllowed, preseasonCommishToolsBody } =
      await import("./season-mode");
    if (!isPreseasonCommishToolsAllowed()) {
      // Live season: only replacement bots (cover leavers), not free practice pads
      if (!midSeason) {
        return {
          ok: false,
          error:
            preseasonCommishToolsBody().replace(/\n+/g, " ") +
            " Mid-season: use replacement bots from Commissioner → Pad bots (enter at league average).",
        };
      }
    } else {
      midSeason = false; // preseason: bots start at 0
    }
  } catch {
    /* if import fails, fall through */
  }

  // Respect public 32-player cap — only empty seats, never replace humans/bots
  const roster = await loadLeagueRoster();
  const seats = seatsRemaining(roster.length);
  const existingBots = roster.filter((m) => m.isBot).length;
  const beforeBotUserIds = new Set(
    roster.filter((m) => m.isBot).map((m) => m.userId)
  );
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

  const added = row.added ?? 0;
  let avgPoints: number | undefined;
  if (midSeason && added > 0) {
    const boost = await boostNewBotsToLeagueAverage(beforeBotUserIds);
    avgPoints = boost.avgPoints;
  }

  return {
    ok: true,
    added,
    totalBots: row.totalBots ?? 0,
    seatsRemaining: seats - added,
    avgPoints,
  };
}

/**
 * Add bots for empty seats only (never replaces humans/existing bots).
 *
 * - addCount: how many NEW bots to try to add (capped by open seats)
 * - targetTotal: optional "fill until league has N players" (e.g. 16 ideal, 32 max)
 * - weekNumber: if set and a card exists, lock bot picks for that week
 * - midSeasonReplacement: live season cover for leavers; bots enter at league avg pts
 *
 * Ideal totals for clean dual brackets: 8 (4+4), 16 (8+8), 32 (16+16).
 */
export async function fillLeagueWithBotsToCap(opts?: {
  weekNumber?: number;
  /** Exact number of new bots to add (preferred when set). */
  addCount?: number;
  /** Grow roster toward this total size (e.g. 16 or 32). */
  targetTotal?: number;
  /** Live season: pad empty seats after people left; bots start at league average. */
  midSeasonReplacement?: boolean;
}): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  botsFilled?: number;
  /** Crystal Ball / Super Bowl pride picks written for bots */
  crystalFilled?: number;
  seatsBefore?: number;
  rosterBefore?: number;
  rosterAfter?: number;
  /** Mid-season: points each new bot received */
  avgPoints?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  let midSeason = !!opts?.midSeasonReplacement;
  try {
    const { isPreseasonCommishToolsAllowed, preseasonCommishToolsBody } =
      await import("./season-mode");
    if (!isPreseasonCommishToolsAllowed()) {
      if (!midSeason) {
        return {
          ok: false,
          error:
            preseasonCommishToolsBody().replace(/\n+/g, " ") +
            " Mid-season: use replacement bots (league average points).",
        };
      }
    } else {
      midSeason = false;
    }
  } catch {
    /* fall through */
  }

  async function seedCrystalBallForBots(): Promise<number> {
    // Crystal ball pride picks are a pre-season smoke tool — skip mid-season
    if (midSeason) return 0;
    try {
      const { seedBotCrystalBallPicks } = await import("./crystal-ball");
      const cb = await seedBotCrystalBallPicks();
      if (cb.ok) return cb.inserted ?? 0;
    } catch {
      /* optional */
    }
    return 0;
  }

  const roster = await loadLeagueRoster();
  const rosterBefore = roster.length;
  const seatsBefore = seatsRemaining(rosterBefore);
  if (seatsBefore <= 0) {
    const crystalFilled = await seedCrystalBallForBots();
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      crystalFilled,
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
    const crystalFilled = await seedCrystalBallForBots();
    return {
      ok: true,
      added: 0,
      totalBots: roster.filter((m) => m.isBot).length,
      botsFilled: 0,
      crystalFilled,
      seatsBefore,
      rosterBefore,
      rosterAfter: rosterBefore,
    };
  }

  const seed = await seedTrialBotsInCloud(want, {
    midSeasonReplacement: midSeason,
  });
  if (!seed.ok) {
    return { ok: false, error: seed.error || "Failed to add bots" };
  }

  let botsFilled = 0;
  // Mid-season: fill picks for the open week so bots can play going forward
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

  const crystalFilled = await seedCrystalBallForBots();

  const added = seed.added ?? 0;
  return {
    ok: true,
    added,
    totalBots: seed.totalBots ?? 0,
    botsFilled,
    crystalFilled,
    seatsBefore,
    rosterBefore,
    rosterAfter: rosterBefore + added,
    avgPoints: seed.avgPoints,
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
  weekNumber: number,
  opts?: { chaosChance?: number; skipChaos?: boolean }
): Promise<{
  ok: boolean;
  botsFilled?: number;
  chaosCount?: number;
  chaosNames?: string[];
  error?: string;
}> {
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

  const botsFilled = row.botsFilled ?? 0;
  if (opts?.skipChaos || botsFilled === 0) {
    return { ok: true, botsFilled, chaosCount: 0 };
  }

  // ~1 in 5 bots go Chaos so you can see 2× impact + Gazette detonation
  const chaos = await applyRandomBotChaosForWeek(weekNumber, {
    chance: opts?.chaosChance ?? 22,
  });
  return {
    ok: true,
    botsFilled,
    chaosCount: chaos.ok ? chaos.chaosCount ?? 0 : 0,
    chaosNames: chaos.names,
    error: chaos.ok ? undefined : chaos.error,
  };
}

/**
 * Sandbox: randomly arm Chaos Mode on trial bots that already locked this week.
 * Needs supabase/bot-chaos-sim.sql once. Scoring multiplies those weeks by 2×.
 */
export async function applyRandomBotChaosForWeek(
  weekNumber: number,
  opts?: { chance?: number }
): Promise<{
  ok: boolean;
  chaosCount?: number;
  names?: string[];
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }
  const chance = Math.max(0, Math.min(100, opts?.chance ?? 22));
  const supabase = createClient();
  const { data, error } = await supabase.rpc("apply_random_bot_chaos", {
    p_league_id: session.leagueId,
    p_week_number: weekNumber,
    p_chance: chance,
  });
  if (error) {
    if (/apply_random_bot_chaos|function|schema cache|does not exist/i.test(error.message || "")) {
      return {
        ok: false,
        error:
          "Bot Chaos sim needs supabase/bot-chaos-sim.sql run once in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: error.message };
  }
  const row = (data || {}) as {
    ok?: boolean;
    chaosCount?: number;
    names?: string[];
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "Failed to arm bot chaos" };
  }
  return {
    ok: true,
    chaosCount: row.chaosCount ?? 0,
    names: Array.isArray(row.names) ? row.names : [],
  };
}

export async function updateMemberDivision(
  userId: string,
  division: "North" | "South" | "East" | "West"
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  // Commissioner or deputy only — never self-service for regular players
  if (!session?.leagueId || !isOps()) {
    return {
      ok: false,
      error: "Only the commissioner or a deputy can change divisions",
    };
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

/**
 * Next division for a new join (least populated). Call before insert.
 * Does not require ops — join path only.
 */
export async function nextDivisionForJoin(
  leagueId: string
): Promise<DivisionName> {
  const supabase = createClient();
  const { data } = await supabase
    .from("memberships")
    .select("division")
    .eq("league_id", leagueId);
  return pickLeastPopulatedDivision(countByDivision(data || []));
}

export async function removeLeagueMember(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, error: "No league" };
  }
  if (!session.isCommissioner && !session.isModerator) {
    return { ok: false, error: "Only the commissioner or a moderator can remove players" };
  }
  if (userId === session.playerId) {
    return { ok: false, error: "Can't remove yourself (use Account to leave or delete the league)" };
  }

  const supabase = createClient();

  // Preferred: staff RPC (bypasses pick RLS, works for mods + commish)
  {
    const { data, error } = await supabase.rpc("staff_remove_member", {
      p_league_id: session.leagueId,
      p_user_id: userId,
    });
    if (!error) {
      if (data && (data as { ok?: boolean }).ok === false) {
        return { ok: false, error: "Remove failed" };
      }
      return { ok: true };
    }
    if (!rpcMissing(error.message || "")) {
      return { ok: false, error: error.message };
    }
    // fall through if SQL not deployed yet
  }

  // Fallback: commissioner-only direct deletes (legacy)
  if (!session.isCommissioner) {
    return {
      ok: false,
      error:
        "Moderation not set up — run supabase/moderation.sql in Supabase SQL Editor once.",
    };
  }

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

/** Round-robin assign North/South/East/West by name. Commissioner or deputy. */
export async function autoBalanceDivisions(): Promise<{
  ok: boolean;
  error?: string;
  updated?: number;
}> {
  const session = getSession();
  if (!session?.leagueId || !isOps()) {
    return {
      ok: false,
      error: "Only the commissioner or a deputy can auto-balance",
    };
  }

  const roster = await loadLeagueRoster();
  if (!roster.length) return { ok: false, error: "No players in this league" };

  const plan = planAutoBalance(
    roster.map((m) => ({ id: m.membershipId, name: m.name }))
  );
  const supabase = createClient();
  let updated = 0;

  for (const row of plan) {
    const member = roster.find((m) => m.membershipId === row.id);
    if (!member || member.division === row.division) continue;
    const { error } = await supabase
      .from("memberships")
      .update({ division: row.division })
      .eq("id", member.membershipId);
    if (error) return { ok: false, error: error.message };
    updated += 1;
  }

  return { ok: true, updated };
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
 * Client-side wipe when RPC is missing or incomplete.
 * Deletes results/cards/picks and zeroes membership stats.
 */
async function resetSeasonClientFallback(
  leagueId: string
): Promise<ResetSeasonResult> {
  const supabase = createClient();
  let picksDeleted = 0;
  let cardsDeleted = 0;
  let resultsDeleted = 0;

  {
    const { data, error } = await supabase
      .from("week_results")
      .delete()
      .eq("league_id", leagueId)
      .select("id");
    if (!error) resultsDeleted = data?.length ?? 0;
  }
  {
    const { data, error } = await supabase
      .from("picks")
      .delete()
      .eq("league_id", leagueId)
      .select("id");
    if (!error) picksDeleted = data?.length ?? 0;
  }
  {
    const { data, error } = await supabase
      .from("week_cards")
      .delete()
      .eq("league_id", leagueId)
      .select("id");
    if (!error) cardsDeleted = data?.length ?? 0;
  }

  try {
    await supabase.from("announcements").delete().eq("league_id", leagueId);
  } catch {
    /* optional */
  }
  try {
    await supabase.from("gazette_editions").delete().eq("league_id", leagueId);
  } catch {
    /* optional */
  }
  try {
    await supabase.from("crystal_ball_picks").delete().eq("league_id", leagueId);
  } catch {
    /* optional */
  }
  try {
    await supabase
      .from("crystal_ball_result")
      .delete()
      .eq("league_id", leagueId);
  } catch {
    /* optional */
  }

  const { data: members, error: memErr } = await supabase
    .from("memberships")
    .update({
      total_points: 0,
      weekly_points: [],
      ats_correct: 0,
      ats_total: 0,
      current_streak: 0,
      best_week: 0,
      worst_week: 0,
      perfect_weeks: 0,
      best_bet_hits: 0,
      best_bet_total: 0,
      prop_hits: 0,
      prop_total: 0,
      weeks_played: 0,
    })
    .eq("league_id", leagueId)
    .select("id");

  if (memErr) {
    return {
      ok: false,
      error:
        memErr.message ||
        "Could not zero scores. You may need commissioner RLS / reset-season.sql.",
    };
  }

  await supabase.from("leagues").update({ current_week: 0 }).eq("id", leagueId);

  return {
    ok: true,
    membersKept: members?.length ?? 0,
    picksDeleted,
    cardsDeleted,
    resultsDeleted,
  };
}

/**
 * Wipe season data (picks, cards, results, scores) but KEEP all members.
 * Commissioner only. Prefers reset_league_season RPC; falls back to direct deletes.
 */
export async function resetSeasonInCloud(): Promise<ResetSeasonResult> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can reset the season" };
  }

  const supabase = createClient();
  const leagueId = session.leagueId;
  let result: ResetSeasonResult | null = null;

  const { data, error } = await supabase.rpc("reset_league_season", {
    p_league_id: leagueId,
  });

  if (!error) {
    const row = (data || {}) as {
      ok?: boolean;
      membersKept?: number;
      picksDeleted?: number;
      cardsDeleted?: number;
      resultsDeleted?: number;
    };
    result = {
      ok: true,
      membersKept: row.membersKept,
      picksDeleted: row.picksDeleted,
      cardsDeleted: row.cardsDeleted,
      resultsDeleted: row.resultsDeleted,
    };
  } else {
    const msg = error.message || "";
    // Always try client wipe so a stale/missing RPC can't leave week_results behind
    result = await resetSeasonClientFallback(leagueId);
    if (!result.ok && /function|does not exist|schema cache/i.test(msg)) {
      return {
        ok: false,
        error:
          "Reset function missing and direct wipe failed. Run supabase/reset-season.sql (or gazette-archive.sql) in Supabase, then try again. " +
          (result.error || msg),
      };
    }
    if (!result.ok) {
      return { ok: false, error: result.error || msg || "Failed to reset season" };
    }
  }

  // Belt-and-suspenders: if RPC "succeeded" but results remain, force-delete them
  try {
    const leftover = await listScoredWeekNumbers();
    if (leftover.length > 0) {
      const wipe = await resetSeasonClientFallback(leagueId);
      if (wipe.ok) {
        result = {
          ...result,
          resultsDeleted: Math.max(
            result.resultsDeleted || 0,
            wipe.resultsDeleted || 0
          ),
          picksDeleted: Math.max(
            result.picksDeleted || 0,
            wipe.picksDeleted || 0
          ),
          cardsDeleted: Math.max(
            result.cardsDeleted || 0,
            wipe.cardsDeleted || 0
          ),
          membersKept: wipe.membersKept ?? result.membersKept,
        };
      }
    }
  } catch {
    /* ignore */
  }

  // Always wipe pride picks + league achievements + re-zero memberships.
  // RPC may be an older version that only deleted picks/cards — profile stats
  // (ATS, weeks played, streaks) must not survive trial runs.
  try {
    const wipeExtras = await resetSeasonClientFallback(leagueId);
    if (wipeExtras.ok) {
      result = {
        ...result,
        membersKept: wipeExtras.membersKept ?? result.membersKept,
        picksDeleted: Math.max(
          result.picksDeleted || 0,
          wipeExtras.picksDeleted || 0
        ),
        cardsDeleted: Math.max(
          result.cardsDeleted || 0,
          wipeExtras.cardsDeleted || 0
        ),
        resultsDeleted: Math.max(
          result.resultsDeleted || 0,
          wipeExtras.resultsDeleted || 0
        ),
      };
    }
  } catch {
    /* best-effort */
  }

  // Clear local week caches so this device matches cloud (NFL through week 22)
  try {
    for (let w = 0; w <= 22; w++) {
      localStorage.removeItem(`warroom-card-week-${w}`);
      localStorage.removeItem(`warroom-results-week-${w}`);
      localStorage.removeItem(`warroom-picks-week-${w}`);
    }
    localStorage.setItem("warroom-active-week", "0");
    // Crystal Ball / Super Bowl pride picks (device fallback board)
    localStorage.removeItem(`warroom-crystal-ball-${leagueId}`);
    // Stale local roster stats (guest/demo residue)
    try {
      const { savePlayers } = await import("./store");
      savePlayers([]);
    } catch {
      /* ignore */
    }
    const prefixes = [
      "warroom-gazette-seen-v1:",
      "warroom-ring-ceremony-seen",
      "warroom-badge-celebrated",
      "warroom-first-final",
    ];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (prefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }

  // Sandbox: wipe sim trophies + local cheevo banks that should not stick.
  // Real season: career permanent cheevos stay (Legend / creator only protected in sandbox).
  try {
    const { afterSeasonResetLocalCleanup } = await import("./sandbox-wipe");
    const roster = await loadLeagueRoster();
    await afterSeasonResetLocalCleanup({
      leagueId,
      playerIds: roster.map((m) => m.userId),
    });
  } catch {
    /* best-effort */
  }

  return result;
}
