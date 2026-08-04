/**
 * League delete protection — community owns history.
 *
 * CONSTITUTION:
 *  - The league belongs to the community, not the commissioner.
 *  - Nothing earned should disappear because one person clicked a button.
 *  - Commissioners cannot hard-delete production rooms with history.
 *  - Disposable only: solo empty rooms (no other humans, no scores, no play).
 *  - Full retirement = future community vote (not hard-delete).
 *
 * Nobody is forced to become commissioner. The room stays open; any other
 * real player can voluntarily take the keys so everyone can finish the season.
 */

import { createClient } from "@/lib/supabase/client";
import { listScoredWeekNumbers } from "@/lib/cloud";
import { transferCommissioner } from "@/lib/trophies";

export type FirstPlaceCandidate = {
  userId: string;
  name: string;
  totalPoints: number;
};

/** Any other human who could voluntarily take the gavel. */
export type PassCandidate = {
  userId: string;
  name: string;
  totalPoints: number;
};

export type LeagueDeleteEval = {
  /**
   * True only for disposable empty solo rooms.
   * Never true when other humans or any play/score history exist.
   */
  canHardDelete: boolean;
  /** Human explanation */
  reason: string;
  otherHumans: number;
  scoredWeeks: number;
  /** Standing leader among non-bot humans (not the current commish) — suggestion only */
  firstPlace: FirstPlaceCandidate | null;
  /** All other humans who can step up voluntarily (sorted by points desc) */
  candidates: PassCandidate[];
};

/**
 * Hard delete only when the room is disposable:
 * no other real players, no scored weeks, nobody has played.
 * Anything else = community history (or a multi-human commitment) → survive.
 */
export async function evaluateLeagueDelete(
  leagueId: string
): Promise<LeagueDeleteEval> {
  const empty: LeagueDeleteEval = {
    canHardDelete: true,
    reason: "Empty solo room — no community history yet.",
    otherHumans: 0,
    scoredWeeks: 0,
    firstPlace: null,
    candidates: [],
  };
  if (!leagueId) return empty;

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) {
    return { ...empty, canHardDelete: false, reason: "Not signed in." };
  }

  const { data: rows } = await supabase
    .from("memberships")
    .select("user_id, total_points, weeks_played, is_bot, profiles(display_name)")
    .eq("league_id", leagueId);

  type MemRow = {
    user_id: string;
    total_points?: number | null;
    weeks_played?: number | null;
    is_bot?: boolean | null;
    profiles?: { display_name?: string | null } | null;
  };

  const humans = ((rows || []) as MemRow[]).filter(
    (r) => !r.is_bot && r.user_id
  );
  const others = humans.filter((r) => r.user_id !== me);
  const otherHumans = others.length;

  let scoredWeeks = 0;
  try {
    // Prefer cloud when this is the active league
    const { getSession } = await import("@/lib/league");
    const session = getSession();
    if (session?.leagueId === leagueId) {
      scoredWeeks = (await listScoredWeekNumbers()).length;
    } else {
      const { count } = await supabase
        .from("week_results")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId);
      scoredWeeks = count ?? 0;
    }
  } catch {
    scoredWeeks = 0;
  }

  const anyonePlayed = humans.some(
    (r) =>
      (r.total_points || 0) > 0 ||
      (r.weeks_played || 0) > 0
  );

  // All other humans, points high → low (for voluntary pick list)
  const candidates: PassCandidate[] = [...others]
    .sort((a, b) => {
      const pa = a.total_points || 0;
      const pb = b.total_points || 0;
      if (pb !== pa) return pb - pa;
      const na = (a.profiles?.display_name || "").toLowerCase();
      const nb = (b.profiles?.display_name || "").toLowerCase();
      return na.localeCompare(nb);
    })
    .map((r) => ({
      userId: r.user_id,
      name: r.profiles?.display_name?.trim() || "Player",
      totalPoints: r.total_points || 0,
    }));

  // First place is only a suggestion — never a forced assignment
  const firstPlace: FirstPlaceCandidate | null = candidates[0]
    ? {
        userId: candidates[0].userId,
        name: candidates[0].name,
        totalPoints: candidates[0].totalPoints,
      }
    : null;

  // Disposable = solo + zero history. Not "preseason with friends."
  const disposable =
    otherHumans === 0 && scoredWeeks === 0 && !anyonePlayed;

  if (disposable) {
    return {
      canHardDelete: true,
      reason: "Empty solo room — no community history yet.",
      otherHumans,
      scoredWeeks,
      firstPlace,
      candidates,
    };
  }

  const reason =
    scoredWeeks > 0 || anyonePlayed
      ? "This room has real season history. Commissioners cannot erase it. Pass the keys if you need to step down — retirement is a community decision later."
      : "Other players are in this room. The league belongs to the community. Pass the keys if you need to step down — you cannot delete their seat.";

  return {
    canHardDelete: false,
    reason,
    otherHumans,
    scoredWeeks,
    firstPlace,
    candidates,
  };
}

/**
 * Pass commissioner to a chosen member (voluntary).
 * Works from Account even when that league is not the active session.
 */
export async function passCommissionerForLeague(
  leagueId: string,
  newCommissionerUserId: string
): Promise<{ ok: boolean; error?: string; newCommissionerName?: string }> {
  return transferCommissioner(newCommissionerUserId, { leagueId });
}
