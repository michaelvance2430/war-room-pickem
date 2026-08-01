/**
 * Cross-sport player pool: ask the room “want [sport]?” → spin a new league for yeses.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getLeague, getSession } from "@/lib/league";
import { getSportPack, isLiveSport } from "@/lib/sports/registry";
import { MAX_LEAGUE_PLAYERS, isLeagueFull } from "@/lib/league-limits";
import type { SportId } from "@/lib/sports/types";

export type SportPoolPoll = {
  id: string;
  sourceLeagueId: string;
  commissionerId: string;
  targetSportId: string;
  proposedName: string;
  message: string;
  status: "open" | "closed" | "spun_up";
  createdLeagueId: string | null;
  createdAt: string;
};

export type SportPoolVote = {
  userId: string;
  response: "yes" | "no";
  displayName?: string;
};

function sqlMissing(msg: string): boolean {
  return /sport_pool|relation|schema cache|column|does not exist/i.test(msg);
}

export function sportPoolSqlHint(): string {
  return (
    "One-time setup: open Supabase → SQL Editor → paste & run " +
    "supabase/sport-pool-polls.sql (in the repo). Then hard-refresh this page."
  );
}

/** Humans in the source room who should answer (non-bots). */
export async function countSourceLeagueHumans(
  leagueId: string
): Promise<number> {
  if (!hasSupabaseConfig() || !leagueId) return 0;
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("memberships")
      .select("user_id, is_bot")
      .eq("league_id", leagueId);
    if (error || !data) return 0;
    return data.filter((r) => !(r as { is_bot?: boolean }).is_bot).length;
  } catch {
    return 0;
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createSportPoolPoll(opts: {
  targetSportId: string;
  proposedName: string;
  message?: string;
}): Promise<{ ok: true; poll: SportPoolPoll } | { ok: false; error: string }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can poll the room." };
  }
  if (!isLiveSport(opts.targetSportId)) {
    return {
      ok: false,
      error: `${getSportPack(opts.targetSportId).label} isn’t live yet.`,
    };
  }
  if (opts.targetSportId === (league.sportId || "cfb")) {
    return {
      ok: false,
      error:
        "Pick a different sport than this room — same-sport spin-up isn’t this tool.",
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("sport_pool_polls")
    .insert({
      source_league_id: league.id,
      commissioner_id: session.playerId,
      target_sport_id: opts.targetSportId,
      proposed_name: (opts.proposedName || "War Room").trim().slice(0, 80),
      message: (opts.message || "").trim().slice(0, 280),
      status: "open",
    })
    .select()
    .single();

  if (error) {
    if (sqlMissing(error.message || "")) {
      return { ok: false, error: sportPoolSqlHint() };
    }
    return { ok: false, error: error.message };
  }

  const poll = mapPoll(data);
  // Host is always a yes — seats themselves when the room spins up
  try {
    await supabase.from("sport_pool_votes").upsert(
      {
        poll_id: poll.id,
        user_id: session.playerId,
        response: "yes",
      },
      { onConflict: "poll_id,user_id" }
    );
  } catch {
    /* vote table may still be missing if partial SQL */
  }

  return { ok: true, poll };
}

function mapPoll(raw: Record<string, unknown>): SportPoolPoll {
  return {
    id: raw.id as string,
    sourceLeagueId: raw.source_league_id as string,
    commissionerId: raw.commissioner_id as string,
    targetSportId: (raw.target_sport_id as string) || "nfl",
    proposedName: (raw.proposed_name as string) || "War Room",
    message: (raw.message as string) || "",
    status: (raw.status as SportPoolPoll["status"]) || "open",
    createdLeagueId: (raw.created_league_id as string) || null,
    createdAt: (raw.created_at as string) || "",
  };
}

/** Open poll for the current league (if any) */
export async function loadOpenPollForLeague(
  leagueId: string
): Promise<{ poll: SportPoolPoll | null; error?: string }> {
  if (!hasSupabaseConfig() || !leagueId) {
    return { poll: null };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sport_pool_polls")
    .select("*")
    .eq("source_league_id", leagueId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (sqlMissing(error.message || "")) {
      return { poll: null, error: sportPoolSqlHint() };
    }
    return { poll: null, error: error.message };
  }
  return { poll: data ? mapPoll(data as Record<string, unknown>) : null };
}

export async function loadPollVotes(
  pollId: string
): Promise<{ votes: SportPoolVote[]; error?: string }> {
  if (!hasSupabaseConfig()) return { votes: [] };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sport_pool_votes")
    .select("user_id, response")
    .eq("poll_id", pollId);
  if (error) {
    if (sqlMissing(error.message || "")) {
      return { votes: [], error: sportPoolSqlHint() };
    }
    return { votes: [], error: error.message };
  }

  const votes: SportPoolVote[] = (data || []).map((r) => ({
    userId: (r as { user_id: string }).user_id,
    response: (r as { response: "yes" | "no" }).response,
  }));

  // Names
  const ids = votes.map((v) => v.userId);
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    const nameBy = new Map(
      (profiles || []).map((p) => [
        (p as { id: string }).id,
        (p as { display_name?: string }).display_name || "Player",
      ])
    );
    for (const v of votes) {
      v.displayName = nameBy.get(v.userId) || "Player";
    }
  }
  return { votes };
}

export async function castSportPoolVote(opts: {
  pollId: string;
  response: "yes" | "no";
}): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to answer." };
  }
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const supabase = createClient();

  // Upsert-ish: try update then insert
  const { data: existing } = await supabase
    .from("sport_pool_votes")
    .select("id")
    .eq("poll_id", opts.pollId)
    .eq("user_id", session.playerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("sport_pool_votes")
      .update({ response: opts.response })
      .eq("poll_id", opts.pollId)
      .eq("user_id", session.playerId);
    if (error) {
      if (sqlMissing(error.message || "")) {
        return { ok: false, error: sportPoolSqlHint() };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.from("sport_pool_votes").insert({
    poll_id: opts.pollId,
    user_id: session.playerId,
    response: opts.response,
  });
  if (error) {
    if (sqlMissing(error.message || "")) {
      return { ok: false, error: sportPoolSqlHint() };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function myVoteForPoll(
  pollId: string
): Promise<"yes" | "no" | null> {
  const session = getSession();
  if (!session?.playerId || !hasSupabaseConfig()) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("sport_pool_votes")
    .select("response")
    .eq("poll_id", pollId)
    .eq("user_id", session.playerId)
    .maybeSingle();
  const r = (data as { response?: string } | null)?.response;
  return r === "yes" || r === "no" ? r : null;
}

/**
 * One-click: create target-sport league, seat all yeses (+ host), optional new commissioner.
 */
export async function spinUpLeagueFromPoll(opts: {
  pollId: string;
  /** Keep current host if omitted / self */
  newCommissionerId?: string | null;
  leagueNameOverride?: string;
}): Promise<
  | {
      ok: true;
      leagueId: string;
      code: string;
      leagueName: string;
      seated: number;
      sportId: string;
    }
  | { ok: false; error: string }
> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Supabase is not configured." };
  }
  const session = getSession();
  if (!session?.playerId || !session.isCommissioner) {
    return { ok: false, error: "Only the commissioner can spin up the room." };
  }

  const supabase = createClient();
  const { data: pollRow, error: pErr } = await supabase
    .from("sport_pool_polls")
    .select("*")
    .eq("id", opts.pollId)
    .maybeSingle();
  if (pErr || !pollRow) {
    return {
      ok: false,
      error: pErr?.message || "Poll not found.",
    };
  }
  const poll = mapPoll(pollRow as Record<string, unknown>);
  if (poll.commissionerId !== session.playerId) {
    return { ok: false, error: "That’s not your poll." };
  }
  if (poll.status === "spun_up" && poll.createdLeagueId) {
    return {
      ok: false,
      error: "This poll already spun up a league.",
    };
  }
  if (!isLiveSport(poll.targetSportId)) {
    return {
      ok: false,
      error: `${getSportPack(poll.targetSportId).label} isn’t live yet.`,
    };
  }

  const { votes, error: vErr } = await loadPollVotes(opts.pollId);
  if (vErr) return { ok: false, error: vErr };
  const yesIds = new Set(
    votes.filter((v) => v.response === "yes").map((v) => v.userId)
  );
  // Host always in
  yesIds.add(session.playerId);
  if (opts.newCommissionerId) yesIds.add(opts.newCommissionerId);

  const seatList = Array.from(yesIds);
  if (isLeagueFull(seatList.length)) {
    return {
      ok: false,
      error: `Too many yeses (${seatList.length}). Cap is ${MAX_LEAGUE_PLAYERS}. Close the poll or start a second room.`,
    };
  }
  if (seatList.length < 1) {
    return { ok: false, error: "Nobody said yes yet." };
  }

  const name =
    (opts.leagueNameOverride || poll.proposedName || "War Room").trim() ||
    "War Room";
  const code = generateCode();
  const sportId = poll.targetSportId as SportId;

  const insertRow: Record<string, unknown> = {
    name,
    code,
    commissioner_id: session.playerId,
    sport_id: sportId,
    sport_settings: {},
    crystal_ball_enabled: sportId === "cfb",
  };

  let { data: league, error: lErr } = await supabase
    .from("leagues")
    .insert(insertRow)
    .select()
    .single();

  if (
    lErr &&
    /sport_id|crystal_ball|column|schema cache/i.test(lErr.message || "")
  ) {
    const res = await supabase
      .from("leagues")
      .insert({ name, code, commissioner_id: session.playerId })
      .select()
      .single();
    league = res.data;
    lErr = res.error;
  }
  if (lErr || !league) {
    return { ok: false, error: lErr?.message || "Could not create league." };
  }

  const leagueId = (league as { id: string }).id;
  const divisions = ["North", "South", "East", "West"] as const;
  let di = 0;
  let seated = 0;
  const finalComm =
    opts.newCommissionerId?.trim() &&
    opts.newCommissionerId !== session.playerId &&
    yesIds.has(opts.newCommissionerId)
      ? opts.newCommissionerId
      : session.playerId;

  for (const uid of seatList) {
    const role = uid === finalComm ? "commissioner" : "player";
    const { error: mErr } = await supabase.from("memberships").insert({
      league_id: leagueId,
      user_id: uid,
      role,
      division: divisions[di % 4],
      total_points: 0,
      weeks_played: 0,
    });
    di++;
    if (!mErr) seated += 1;
    else if (!/duplicate|unique/i.test(mErr.message || "")) {
      console.warn("seat failed", uid, mErr.message);
    }
  }

  if (finalComm !== session.playerId) {
    await supabase
      .from("leagues")
      .update({ commissioner_id: finalComm })
      .eq("id", leagueId);
  }

  await supabase
    .from("sport_pool_polls")
    .update({
      status: "spun_up",
      created_league_id: leagueId,
      closed_at: new Date().toISOString(),
    })
    .eq("id", opts.pollId);

  return {
    ok: true,
    leagueId,
    code: (league as { code: string }).code || code,
    leagueName: name,
    seated,
    sportId,
  };
}

export async function closeSportPoolPoll(
  pollId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in" };
  if (!hasSupabaseConfig()) return { ok: false, error: "No Supabase" };
  const supabase = createClient();
  const { error } = await supabase
    .from("sport_pool_polls")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", pollId)
    .eq("commissioner_id", session.playerId);
  if (error) {
    if (sqlMissing(error.message || "")) {
      return { ok: false, error: sportPoolSqlHint() };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
