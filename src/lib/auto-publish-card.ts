/**
 * Lazy commissioner protection:
 * If no week card is published by 48h before first kickoff of the week,
 * auto-select 5 games + a prop and post the card.
 * Two consecutive auto-posts → pass gavel to 1st-place human.
 *
 * Runs via Vercel cron /api/cron/auto-publish-card (service role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, OddsApiGame } from "@/lib/types";
import { createServiceClient } from "@/lib/nudge-picks";
import { mapOddsApiToGames } from "@/lib/odds";
import { filterToFbsGames } from "@/lib/fbs-teams";
import {
  filterGamesForWeek,
  listSeasonWeekNumbers,
  weekDateWindow,
  weekTitle,
  weekWindowMs,
} from "@/lib/season-calendar";
import { generateDemoSlate } from "@/lib/demo-slate";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
/** Auto-post when first kickoff is this close (or already past with no card). */
export const AUTO_PUBLISH_LEAD_MS = 48 * HOUR;

export type AutoPublishLeagueResult = {
  leagueId: string;
  leagueName: string;
  weekNumber?: number;
  status:
    | "skipped_has_card"
    | "skipped_too_early"
    | "skipped_no_window"
    | "skipped_already_auto"
    | "published"
    | "published_and_passed_gavel"
    | "error";
  firstKickoff?: string;
  games?: number;
  streak?: number;
  newCommissionerName?: string;
  error?: string;
  source?: "odds" | "demo";
};

function sportKey(raw: string | null | undefined): "cfb" | "nfl" {
  return raw === "nfl" ? "nfl" : "cfb";
}

function parseKickMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Pick'em weeks that are "in play" right now: within 4 days before window start
 * through end of window (+1 day grace for late auto-post).
 */
export function weeksInPlay(
  sport: "cfb" | "nfl",
  nowMs = Date.now()
): number[] {
  const out: number[] = [];
  for (const w of listSeasonWeekNumbers(sport)) {
    const win = weekWindowMs(w, sport);
    if (!win) continue;
    if (nowMs >= win.startMs - 4 * DAY && nowMs <= win.endMs + DAY) {
      out.push(w);
    }
  }
  return out;
}

/** Prefer earliest unpublished week that is currently in play. */
export async function resolveTargetWeek(
  supabase: SupabaseClient,
  leagueId: string,
  sport: "cfb" | "nfl",
  currentWeek: number | null,
  nowMs = Date.now()
): Promise<number | null> {
  const inPlay = weeksInPlay(sport, nowMs);
  if (!inPlay.length) return null;

  const { data: cards } = await supabase
    .from("week_cards")
    .select("week_number")
    .eq("league_id", leagueId);

  const published = new Set(
    (cards || []).map((c) => Number((c as { week_number: number }).week_number))
  );

  // Prefer league.current_week if it's in play and missing a card
  if (
    currentWeek != null &&
    inPlay.includes(currentWeek) &&
    !published.has(currentWeek)
  ) {
    return currentWeek;
  }

  for (const w of inPlay) {
    if (!published.has(w)) return w;
  }
  return null;
}

/** Cache odds once per sport per cron tick. */
const oddsCache = new Map<string, { at: number; games: Game[] }>();

async function fetchLiveOdds(
  sport: "cfb" | "nfl",
  weekNumber: number
): Promise<Game[]> {
  const cacheKey = `${sport}:${weekNumber}`;
  const hit = oddsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.games;

  const apiKey = (process.env.ODDS_API_KEY || "").trim();
  if (!apiKey) return [];

  const path =
    sport === "nfl"
      ? "americanfootball_nfl"
      : "americanfootball_ncaaf";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${path}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as OddsApiGame[];
    let games = mapOddsApiToGames(Array.isArray(data) ? data : []).filter(
      (g) => g.bookmaker && Number.isFinite(g.spread)
    );
    if (sport === "cfb") {
      games = filterToFbsGames(games);
    }
    games = filterGamesForWeek(games, weekNumber, sport);
    oddsCache.set(cacheKey, { at: Date.now(), games });
    return games;
  } catch {
    return [];
  }
}

/**
 * Auto-select 5 games: ranked heat first, then closer spreads, then earliest kickoff.
 */
export function selectAutoCardGames(
  pool: Game[],
  count = 5
): Game[] {
  if (!pool.length) return [];
  const scored = pool.map((g) => {
    const rankHeat =
      (g.awayRank != null && g.awayRank <= 25 ? 30 - g.awayRank : 0) +
      (g.homeRank != null && g.homeRank <= 25 ? 30 - g.homeRank : 0);
    const spreadHeat = Math.max(0, 14 - Math.abs(g.spread || 0));
    const kick = parseKickMs(g.commenceTime || g.startTime) ?? Number.MAX_SAFE_INTEGER;
    return { g, rankHeat, spreadHeat, kick };
  });
  scored.sort((a, b) => {
    if (b.rankHeat !== a.rankHeat) return b.rankHeat - a.rankHeat;
    if (b.spreadHeat !== a.spreadHeat) return b.spreadHeat - a.spreadHeat;
    return a.kick - b.kick;
  });

  // Prefer diversity of teams
  const picked: Game[] = [];
  const used = new Set<string>();
  for (const row of scored) {
    if (picked.length >= count) break;
    const a = row.g.awayTeam;
    const h = row.g.homeTeam;
    if (used.has(a) || used.has(h)) continue;
    used.add(a);
    used.add(h);
    picked.push(row.g);
  }
  // Fill if needed
  for (const row of scored) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.id === row.g.id)) continue;
    picked.push(row.g);
  }
  return picked.slice(0, count);
}

function estimateFirstKickoffMs(
  games: Game[],
  weekNumber: number,
  sport: "cfb" | "nfl"
): number {
  const times = games
    .map((g) => parseKickMs(g.commenceTime || g.startTime))
    .filter((t): t is number => t != null);
  if (times.length) return Math.min(...times);
  const win = weekWindowMs(weekNumber, sport);
  // Default: Thursday 7pm ET of window start (typical first window feel)
  if (win) {
    const ymd = weekDateWindow(weekNumber, sport)?.startDate;
    if (ymd) {
      let t = Date.parse(`${ymd}T19:00:00-04:00`);
      if (Number.isNaN(t)) t = win.startMs + 19 * HOUR;
      return t;
    }
    return win.startMs + 19 * HOUR;
  }
  return Date.now() + AUTO_PUBLISH_LEAD_MS;
}

async function insertWeekCard(
  supabase: SupabaseClient,
  opts: {
    leagueId: string;
    weekNumber: number;
    games: Game[];
    propQuestion: string;
    propA: string;
    propB: string;
    propPoints: number;
  }
): Promise<{ ok: true; weekCardId: string } | { ok: false; error: string }> {
  const publishedAt = new Date().toISOString();

  const { data: existing } = await supabase
    .from("week_cards")
    .select("id")
    .eq("league_id", opts.leagueId)
    .eq("week_number", opts.weekNumber)
    .maybeSingle();

  if (existing?.id) {
    return { ok: false, error: "Card already exists" };
  }

  let card: { id: string } | null = null;
  let insertErr: { message: string } | null = null;

  {
    const first = await supabase
      .from("week_cards")
      .insert({
        league_id: opts.leagueId,
        week_number: opts.weekNumber,
        prop_question: opts.propQuestion,
        prop_option_a: opts.propA,
        prop_option_b: opts.propB,
        prop_points: opts.propPoints,
        published_at: publishedAt,
        auto_published: true,
      })
      .select("id")
      .single();

    if (
      first.error &&
      /auto_published|column/i.test(first.error.message || "")
    ) {
      const second = await supabase
        .from("week_cards")
        .insert({
          league_id: opts.leagueId,
          week_number: opts.weekNumber,
          prop_question: opts.propQuestion,
          prop_option_a: opts.propA,
          prop_option_b: opts.propB,
          prop_points: opts.propPoints,
          published_at: publishedAt,
        })
        .select("id")
        .single();
      card = second.data;
      insertErr = second.error;
    } else {
      card = first.data;
      insertErr = first.error;
    }
  }

  if (insertErr || !card) {
    return { ok: false, error: insertErr?.message || "Failed to create week card" };
  }

  const weekCardId = card.id as string;
  const rows = opts.games.map((g, i) => ({
    week_card_id: weekCardId,
    sort_order: i,
    away_team: g.awayTeam,
    home_team: g.homeTeam,
    spread: g.spread,
    favorite: g.favorite,
    start_time: g.commenceTime || g.startTime || null,
    bookmaker: g.bookmaker || "auto-publish",
    away_rank: g.awayRank ?? null,
    home_rank: g.homeRank ?? null,
    odds_event_id: g.oddsEventId || g.id || null,
  }));

  {
    const first = await supabase.from("card_games").insert(rows);
    if (
      first.error &&
      /odds_event_id|column/i.test(first.error.message || "")
    ) {
      const slim = rows.map(({ odds_event_id: _o, ...rest }) => rest);
      const second = await supabase.from("card_games").insert(slim);
      if (second.error) {
        return { ok: false, error: second.error.message };
      }
    } else if (first.error) {
      return { ok: false, error: first.error.message };
    }
  }

  await supabase
    .from("leagues")
    .update({ current_week: opts.weekNumber })
    .eq("id", opts.leagueId);

  return { ok: true, weekCardId };
}

async function findFirstPlaceHuman(
  supabase: SupabaseClient,
  leagueId: string,
  excludeUserId: string
): Promise<{ userId: string; name: string; points: number } | null> {
  const { data } = await supabase
    .from("memberships")
    .select("user_id, total_points, is_bot, profiles(display_name)")
    .eq("league_id", leagueId);

  if (!data?.length) return null;

  type Row = {
    user_id: string;
    total_points: number | null;
    is_bot?: boolean;
    profiles?: { display_name?: string } | { display_name?: string }[] | null;
  };

  const humans = (data as Row[])
    .filter((m) => !m.is_bot && m.user_id !== excludeUserId)
    .map((m) => {
      const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        userId: m.user_id,
        name: prof?.display_name || "Player",
        points: Number(m.total_points) || 0,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return humans[0] || null;
}

async function passGavel(
  supabase: SupabaseClient,
  leagueId: string,
  newUserId: string,
  reason: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  const { data, error } = await supabase.rpc("transfer_commissioner_system", {
    p_league_id: leagueId,
    p_new_commissioner_id: newUserId,
    p_reason: reason,
  });

  if (error) {
    // Fallback: direct service-role updates if RPC not installed yet
    if (/does not exist|schema cache|function/i.test(error.message || "")) {
      const { data: league } = await supabase
        .from("leagues")
        .select("commissioner_id")
        .eq("id", leagueId)
        .maybeSingle();
      const oldId = (league as { commissioner_id?: string } | null)?.commissioner_id;
      if (!oldId) return { ok: false, error: "No commissioner" };

      await supabase
        .from("memberships")
        .update({ role: "player" })
        .eq("league_id", leagueId)
        .eq("user_id", oldId);
      await supabase
        .from("memberships")
        .update({ role: "commissioner" })
        .eq("league_id", leagueId)
        .eq("user_id", newUserId);
      await supabase
        .from("leagues")
        .update({
          commissioner_id: newUserId,
          auto_publish_streak: 0,
          last_auto_publish_week: null,
        })
        .eq("id", leagueId);

      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", newUserId)
        .maybeSingle();
      return {
        ok: true,
        name:
          (prof as { display_name?: string } | null)?.display_name || "Player",
      };
    }
    return { ok: false, error: error.message };
  }

  const row = data as {
    ok?: boolean;
    error?: string;
    newCommissionerName?: string;
  } | null;
  if (!row || row.ok === false) {
    return { ok: false, error: row?.error || "Transfer failed" };
  }
  return { ok: true, name: row.newCommissionerName || "Player" };
}

async function postAnnouncement(
  supabase: SupabaseClient,
  leagueId: string,
  authorId: string,
  title: string,
  body: string
): Promise<void> {
  await supabase.from("announcements").insert({
    league_id: leagueId,
    author_id: authorId,
    title,
    body,
  });
}

export async function runAutoPublishCards(opts?: {
  force?: boolean;
  now?: Date;
  leagueId?: string;
}): Promise<{
  ran: boolean;
  at: string;
  results: AutoPublishLeagueResult[];
}> {
  const now = opts?.now || new Date();
  const nowMs = now.getTime();
  const supabase = createServiceClient();

  let q = supabase
    .from("leagues")
    .select(
      "id, name, commissioner_id, sport_id, current_week, auto_publish_streak, last_auto_publish_week"
    );
  if (opts?.leagueId) q = q.eq("id", opts.leagueId);

  const { data: leagues, error } = await q;
  if (error || !leagues) {
    throw new Error(error?.message || "Failed to load leagues");
  }

  const results: AutoPublishLeagueResult[] = [];

  for (const raw of leagues) {
    const league = raw as {
      id: string;
      name: string | null;
      commissioner_id: string;
      sport_id?: string | null;
      current_week?: number | null;
      auto_publish_streak?: number | null;
      last_auto_publish_week?: number | null;
    };
    const leagueId = league.id;
    const leagueName = league.name || "League";
    const sport = sportKey(league.sport_id);
    const commissionerId = league.commissioner_id;

    try {
      const weekNumber = await resolveTargetWeek(
        supabase,
        leagueId,
        sport,
        league.current_week != null ? Number(league.current_week) : null,
        nowMs
      );

      if (weekNumber == null) {
        results.push({
          leagueId,
          leagueName,
          status: "skipped_no_window",
        });
        continue;
      }

      const { data: existingCard } = await supabase
        .from("week_cards")
        .select("id, auto_published")
        .eq("league_id", leagueId)
        .eq("week_number", weekNumber)
        .maybeSingle();

      if (existingCard?.id) {
        results.push({
          leagueId,
          leagueName,
          weekNumber,
          status: "skipped_has_card",
        });
        continue;
      }

      // Build candidate slate first so first-kickoff is real
      let pool = await fetchLiveOdds(sport, weekNumber);
      let games = selectAutoCardGames(pool, 5);
      let source: "odds" | "demo" = "odds";
      if (games.length < 5) {
        games = generateDemoSlate(weekNumber, 5, sport);
        source = "demo";
      }

      const firstKick = estimateFirstKickoffMs(games, weekNumber, sport);
      const deadline = firstKick - AUTO_PUBLISH_LEAD_MS;

      if (!opts?.force && nowMs < deadline) {
        results.push({
          leagueId,
          leagueName,
          weekNumber,
          status: "skipped_too_early",
          firstKickoff: new Date(firstKick).toISOString(),
        });
        continue;
      }

      // Don't auto-post weeks that ended days ago (unless force)
      const win = weekWindowMs(weekNumber, sport);
      if (!opts?.force && win && nowMs > win.endMs + 2 * DAY) {
        results.push({
          leagueId,
          leagueName,
          weekNumber,
          status: "skipped_no_window",
        });
        continue;
      }

      const prop = propFromPreset(rotatingPropPreset(weekNumber, sport), weekNumber);
      const pub = await insertWeekCard(supabase, {
        leagueId,
        weekNumber,
        games,
        propQuestion: prop.question,
        propA: prop.options[0],
        propB: prop.options[1],
        propPoints: prop.points,
      });

      if (!pub.ok) {
        results.push({
          leagueId,
          leagueName,
          weekNumber,
          status: "error",
          error: pub.error,
        });
        continue;
      }

      // Museum Phase 1A: allegiance snapshots (service role RPC). No events.
      try {
        const {
          buildSnapshotGamePayloads,
        } = await import("@/lib/museum/snapshots");
        const { underdogSideFromCard } = await import("@/lib/museum/identity");
        const { defaultSeasonYear } = await import("@/lib/trophies");
        const { firstKickoffOnCardMs } = await import("@/lib/dates");
        const payloads = buildSnapshotGamePayloads(games, sport);
        const firstKickMs = firstKickoffOnCardMs(games);
        await supabase.rpc("museum_rebuild_allegiance_snapshots", {
          p_league_id: leagueId,
          p_week_number: weekNumber,
          p_season: defaultSeasonYear(),
          p_sport_id: sport,
          p_week_card_id: pub.weekCardId,
          p_games: payloads.map((g) => ({
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
          })),
          p_first_kickoff_at:
            firstKickMs > 0 ? new Date(firstKickMs).toISOString() : null,
        });
      } catch {
        /* migration pending or non-production — card still published */
      }

      // Streak: consecutive pick'em weeks
      const prevStreak = Number(league.auto_publish_streak) || 0;
      const lastWeek = league.last_auto_publish_week;
      const consecutive =
        lastWeek != null && Number(lastWeek) === weekNumber - 1;
      const streak = consecutive ? prevStreak + 1 : 1;

      await supabase
        .from("leagues")
        .update({
          auto_publish_streak: streak,
          last_auto_publish_week: weekNumber,
        })
        .eq("id", leagueId);

      const label = weekTitle(weekNumber, sport);
      let newCommissionerName: string | undefined;
      let status: AutoPublishLeagueResult["status"] = "published";

      if (streak >= 2) {
        const leader = await findFirstPlaceHuman(
          supabase,
          leagueId,
          commissionerId
        );
        if (leader) {
          const pass = await passGavel(
            supabase,
            leagueId,
            leader.userId,
            `Two consecutive auto-posted cards (lazy commissioner). Week ${weekNumber}.`
          );
          if (pass.ok) {
            newCommissionerName = pass.name || leader.name;
            status = "published_and_passed_gavel";
            await postAnnouncement(
              supabase,
              leagueId,
              leader.userId,
              "Gavel reassigned — two missed cards",
              [
                `The system auto-posted the ${label} card because the commissioner didn't publish 48 hours before first kickoff.`,
                `That's two weeks in a row. Commissioner is now ${newCommissionerName} (1st place, ${leader.points} pts).`,
                "",
                "New commissioner: build next week's card on time. Everyone else: go lock picks.",
              ].join("\n")
            );
          } else {
            await postAnnouncement(
              supabase,
              leagueId,
              commissionerId,
              `${label} card auto-posted`,
              [
                "Commissioner didn't publish 48 hours before first kickoff — War Room auto-selected 5 games + a prop so the room can pick.",
                `Lazy streak: ${streak} week(s). One more consecutive miss and the gavel goes to 1st place.`,
                pass.error
                  ? `(Gavel pass failed: ${pass.error} — run supabase/lazy-commish-auto-card.sql)`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
            );
          }
        } else {
          await postAnnouncement(
            supabase,
            leagueId,
            commissionerId,
            `${label} card auto-posted`,
            [
              "Commissioner didn't publish 48 hours before first kickoff — card was auto-posted.",
              "No other human available to take the gavel after two strikes.",
            ].join("\n")
          );
        }
      } else {
        await postAnnouncement(
          supabase,
          leagueId,
          commissionerId,
          `${label} card auto-posted (lazy commissioner)`,
          [
            "Nobody posted the picks 48 hours before first kickoff — War Room auto-selected 5 games + a prop so the room isn't stuck.",
            `Source: ${source === "odds" ? "live odds" : "demo fallback (odds thin)"}.`,
            "",
            "Strike 1 of 2. Miss posting next week again and the commissioner gavel goes to whoever is in 1st place.",
            "Commissioner: still go edit/re-publish if you want a different slate before kickoff.",
          ].join("\n")
        );
      }

      results.push({
        leagueId,
        leagueName,
        weekNumber,
        status,
        firstKickoff: new Date(firstKick).toISOString(),
        games: games.length,
        streak,
        newCommissionerName,
        source,
      });
    } catch (e) {
      results.push({
        leagueId,
        leagueName,
        status: "error",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return {
    ran: true,
    at: now.toISOString(),
    results,
  };
}

/** Clear lazy-commish streak after a human/ops publish. Best-effort. */
export async function resetAutoPublishStreakOnHumanPublish(
  supabase: SupabaseClient,
  leagueId: string
): Promise<void> {
  try {
    await supabase
      .from("leagues")
      .update({
        auto_publish_streak: 0,
        last_auto_publish_week: null,
      })
      .eq("id", leagueId);
  } catch {
    /* columns may not exist yet */
  }
}
