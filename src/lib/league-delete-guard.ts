/**
 * Mid-season league delete protection.
 *
 * PRODUCT RULE: A commissioner who is getting crushed cannot nuke the room
 * for everyone. Mid-season delete is blocked; the role passes to first place
 * (or they use Commissioner tools to hand the keys off deliberately).
 */

import { createClient } from "@/lib/supabase/client";
import { listScoredWeekNumbers } from "@/lib/cloud";
import { transferCommissioner } from "@/lib/trophies";

export type FirstPlaceCandidate = {
  userId: string;
  name: string;
  totalPoints: number;
};

export type LeagueDeleteEval = {
  /** True if hard delete is allowed (preseason / empty / solo) */
  canHardDelete: boolean;
  /** Human explanation */
  reason: string;
  otherHumans: number;
  scoredWeeks: number;
  /** Standing leader among non-bot humans (not the current commish) */
  firstPlace: FirstPlaceCandidate | null;
};

/**
 * Mid-season = at least one other real player AND the season has real progress
 * (a scored week, or anyone has points / weeks played).
 */
export async function evaluateLeagueDelete(
  leagueId: string
): Promise<LeagueDeleteEval> {
  const empty: LeagueDeleteEval = {
    canHardDelete: true,
    reason: "Empty or preseason room — hard delete is allowed.",
    otherHumans: 0,
    scoredWeeks: 0,
    firstPlace: null,
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

  const midSeason =
    otherHumans >= 1 && (scoredWeeks > 0 || anyonePlayed);

  // First place among other humans (standings = total_points)
  let firstPlace: FirstPlaceCandidate | null = null;
  if (others.length) {
    const sorted = [...others].sort((a, b) => {
      const pa = a.total_points || 0;
      const pb = b.total_points || 0;
      if (pb !== pa) return pb - pa;
      const na = (a.profiles?.display_name || "").toLowerCase();
      const nb = (b.profiles?.display_name || "").toLowerCase();
      return na.localeCompare(nb);
    });
    const top = sorted[0];
    firstPlace = {
      userId: top.user_id,
      name: top.profiles?.display_name?.trim() || "Player",
      totalPoints: top.total_points || 0,
    };
  }

  if (!midSeason) {
    return {
      canHardDelete: true,
      reason:
        otherHumans === 0
          ? "No other real players — you can delete this room."
          : "Season hasn't really started yet — hard delete is still allowed.",
      otherHumans,
      scoredWeeks,
      firstPlace,
    };
  }

  return {
    canHardDelete: false,
    reason:
      "This season is live with other players. You can't delete the room to escape the board. Pass commissioner instead — first place gets the keys by default.",
    otherHumans,
    scoredWeeks,
    firstPlace,
  };
}

/**
 * Pass commissioner to first place (or a chosen member).
 * Works from Account even when that league is not the active session.
 */
export async function passCommissionerForLeague(
  leagueId: string,
  newCommissionerUserId: string
): Promise<{ ok: boolean; error?: string; newCommissionerName?: string }> {
  return transferCommissioner(newCommissionerUserId, { leagueId });
}
