/**
 * Cross-sport player pool: ask the room “want [sport]?” → spin a new league for yeses.
 *
 * D1B-B AUTHORITY:
 * - This is NOT an ordinary player join path.
 * - spinUpLeagueFromPoll uses SECURITY DEFINER RPC spin_up_sport_pool_league only
 *   (atomic league create + multi-seat + poll close). No direct membership INSERT.
 * - Do NOT route this through join_league_by_code / join_open_league_by_id.
 * - See docs/D1B-B-APP-CUTOVER.md § sport-pool.
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
  sourceMemberCount: number;
  createdAt: string;
};

export type SportPoolVote = {
  userId: string;
  response: "yes" | "no";
  displayName?: string;
};

/** Permanent Crew law: time and sport order never enter this calculation. */
export function crewContinuityThreshold(sourceMemberCount: number): number {
  const humans = Math.max(0, Math.floor(sourceMemberCount || 0));
  return Math.max(3, Math.ceil(humans / 2));
}

export function doesCrewContinue(
  sourceMemberCount: number,
  optedInCount: number
): boolean {
  return Math.max(0, Math.floor(optedInCount || 0)) >=
    crewContinuityThreshold(sourceMemberCount);
}

export function defaultSportPoolMessage(sportLabel: string): string {
  return `${sportLabel}. Same crew, new ways to embarrass yourselves. You in?`;
}

function sqlMissing(msg: string): boolean {
  return /sport_pool|relation|schema cache|column|does not exist/i.test(msg);
}

export function sportPoolSqlHint(): string {
  return (
    "One-time setup: open Supabase → SQL Editor → paste & run " +
    "supabase/sport-pool-polls.sql (in the repo). Then hard-refresh this page."
  );
}

/** Human members eligible to answer the pool poll. */
export async function countSourceLeagueHumans(leagueId: string): Promise<number> {
  if (!hasSupabaseConfig() || !leagueId) {
    return 0;
  }
  const supabase = createClient();
  try {
    const { count, error } = await supabase
      .from("memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("league_id", leagueId)
      .eq("is_bot", false);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
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
    sourceMemberCount: Number(raw.source_member_count) || 0,
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
 * Privileged multi-seat path — atomic via spin_up_sport_pool_league (no direct INSERT).
 */
export async function spinUpLeagueFromPoll(opts: {
  pollId: string;
  /**
   * Optional room name before spin-up (writes poll.proposed_name).
   * Commissioner of the new desk is always the poll host — live RPC is
   * spin_up_sport_pool_league(p_poll_id) only (no handoff parameter).
   */
  leagueNameOverride?: string;
}): Promise<
  | {
      ok: true;
      leagueId: string;
      code: string;
      leagueName: string;
      seated: number;
      sportId: string;
      crewContinues: boolean;
      crewThreshold: number;
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
  const pollId = opts.pollId;

  const { data: pollRow, error: pErr } = await supabase
    .from("sport_pool_polls")
    .select("*")
    .eq("id", pollId)
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

  // Soft UX pre-check only — capacity/seating enforced inside the RPC
  const { votes, error: vErr } = await loadPollVotes(pollId);
  if (vErr) return { ok: false, error: vErr };
  const yesCount =
    votes.filter((v) => v.response === "yes").length +
    (votes.some(
      (v) => v.userId === session.playerId && v.response === "yes"
    )
      ? 0
      : 1);
  if (yesCount < 1) {
    return { ok: false, error: "Nobody said yes yet." };
  }
  if (isLeagueFull(yesCount)) {
    return {
      ok: false,
      error: `Too many yeses (${yesCount}). Cap is ${MAX_LEAGUE_PLAYERS}. Close the poll or start a second room.`,
    };
  }

  // Optional name override on the poll row before atomic spin-up (RPC reads poll)
  const nameOverride = (opts.leagueNameOverride || "").trim();
  if (nameOverride && nameOverride !== poll.proposedName) {
    const { error: nameErr } = await supabase
      .from("sport_pool_polls")
      .update({ proposed_name: nameOverride })
      .eq("id", pollId)
      .eq("commissioner_id", session.playerId);
    if (nameErr && !sqlMissing(nameErr.message || "")) {
      return { ok: false, error: nameErr.message };
    }
  }

  // Live RPC: p_poll_id only — host + yes-voters; host is commissioner.
  const { data, error } = await supabase.rpc("spin_up_sport_pool_league", {
    p_poll_id: pollId,
  });

  if (error) {
    const msg = error.message || "";
    if (
      /PGRST202|could not find the function|schema cache|does not exist/i.test(
        msg
      )
    ) {
      return {
        ok: false,
        error:
          "Sport-pool spin-up RPC is not available on this database yet. Apply spin_up_sport_pool_league, then try again.",
      };
    }
    // Surface stable server tokens without raw SQL dumps
    if (/d1b_b:|league_full|not_authenticated|validation/i.test(msg)) {
      return { ok: false, error: msg.replace(/^.*?(d1b_b:[a-z_]+).*$/i, "$1") || msg };
    }
    return { ok: false, error: msg || "Could not spin up the room." };
  }

  const row =
    typeof data === "string"
      ? (JSON.parse(data) as Record<string, unknown>)
      : (data as Record<string, unknown> | null);

  if (!row || row.ok === false) {
    return {
      ok: false,
      error: String(row?.error || row?.message || "Spin-up failed."),
    };
  }

  const leagueId = String(row.league_id || row.leagueId || "");
  if (!leagueId) {
    return {
      ok: false,
      error: "Spin-up succeeded without a league id.",
    };
  }

  const leagueName = String(
    row.name || row.league_name || nameOverride || poll.proposedName || "War Room"
  );
  const code = String(row.code || "");
  const sportId = String(
    row.sport_id || row.sportId || poll.targetSportId || "cfb"
  ) as SportId;
  const seated = Number(row.seated ?? row.member_count ?? row.humans ?? 0);
  const sourceMemberCount =
    Number(row.source_member_count) ||
    poll.sourceMemberCount ||
    (await countSourceLeagueHumans(poll.sourceLeagueId));
  const crewThreshold = crewContinuityThreshold(sourceMemberCount);
  const crewContinues =
    typeof row.crew_continues === "boolean"
      ? row.crew_continues
      : doesCrewContinue(sourceMemberCount, yesCount);

  // Same Crew, new chapter (sport 2) — local-first optional
  try {
    const { ensureCrewForLeague, getCrewIdForLeague } = await import("./crew");
    const sourceLeagueId = poll.sourceLeagueId || session.leagueId;
    if (sourceLeagueId) {
      ensureCrewForLeague({
        leagueId: sourceLeagueId,
        leagueName: getLeague()?.name || leagueName,
        sportId: getLeague()?.sportId,
        createdBy: session.playerId,
      });
    }
    const prefer = crewContinues
      ? getCrewIdForLeague(sourceLeagueId) ||
        getCrewIdForLeague(session.leagueId)
      : null;
    ensureCrewForLeague({
      leagueId,
      leagueName,
      sportId,
      createdBy: session.playerId,
      preferCrewId: prefer,
    });
  } catch {
    /* local-first optional */
  }

  return {
    ok: true,
    leagueId,
    code,
    leagueName,
    seated: Number.isFinite(seated) ? seated : 0,
    sportId,
    crewContinues,
    crewThreshold,
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
