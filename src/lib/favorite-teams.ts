/**
 * Favorite-team allegiance — Supabase source of truth.
 * Multi-sport rows: (user_id, sport_id) → stable team_id.
 *
 * Answering is required; picking a real team is not.
 * `no-team` is a recorded choice (not the same as never answering).
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { SportId } from "@/lib/sports/types";
import {
  getCfbTeamById,
  isValidCfbTeamId,
  type CanonicalTeam,
} from "@/lib/teams/cfb-catalog";
import {
  getNflTeamById,
  isValidNflTeamId,
} from "@/lib/teams/nfl-catalog";
import { getCbbTeamById, isValidCbbTeamId } from "@/lib/teams/cbb-catalog";

export type FavoriteTeamRow = {
  userId: string;
  sportId: SportId;
  teamId: string;
  createdAt?: string;
  updatedAt?: string;
};

/** Stable id when the player explicitly chooses no favorite team. */
export const NO_TEAM_ID = "no-team";

export function isNoTeamId(teamId: string | null | undefined): boolean {
  return teamId === NO_TEAM_ID;
}

/** Real catalog team (not empty, not the no-team sentinel). */
export function isRealTeamId(teamId: string | null | undefined): boolean {
  return !!teamId && teamId !== NO_TEAM_ID;
}

export const EVENT_FAVORITE_TEAM_UPDATED = "warroom-favorite-team-updated";

function notifyFavoriteUpdated(detail?: {
  sportId?: string;
  teamId?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_FAVORITE_TEAM_UPDATED, { detail: detail || {} })
    );
  } catch {
    /* ignore */
  }
}

/** Refuse Foundry/eyes/demo fake sessions writing production identity. */
async function requireRealAuthUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: "Not configured." };
  }
  try {
    // Through Their Eyes / local play must never write real allegiances
    try {
      const eyes = await import("@/lib/creator-eyes");
      if (eyes.isEyesLocalPlayActive() || eyes.isCreatorEyesActive()) {
        return {
          ok: false,
          error: "Cannot change allegiance in preview mode.",
        };
      }
    } catch {
      /* ok */
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      return { ok: false, error: "Not signed in." };
    }
    const uid = data.user.id;
    if (uid.startsWith("guest-") || uid.startsWith("eyes-")) {
      return { ok: false, error: "Not a real account." };
    }
    return { ok: true, userId: uid };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Auth failed.",
    };
  }
}

function validateTeamForSport(
  sportId: SportId,
  teamId: string
): { ok: true } | { ok: false; error: string } {
  if (isNoTeamId(teamId)) {
    // CFB allows explicit "no team". NFL requires a real club (product binding).
    if (sportId === "cfb" || sportId === "cbb") return { ok: true };
    if (sportId === "nfl") {
      return {
        ok: false,
        error: "Pick an NFL team you ride with — no neutral answer for the pros.",
      };
    }
    return {
      ok: false,
      error: "That sport is not open for allegiance yet.",
    };
  }
  if (sportId === "cfb") {
    if (!isValidCfbTeamId(teamId)) {
      return { ok: false, error: "Unknown CFB team." };
    }
    return { ok: true };
  }
  if (sportId === "nfl") {
    if (!isValidNflTeamId(teamId)) {
      return { ok: false, error: "Unknown NFL team." };
    }
    return { ok: true };
  }
  if (sportId === "cbb") {
    if (!isValidCbbTeamId(teamId)) {
      return { ok: false, error: "Unknown college basketball team." };
    }
    return { ok: true };
  }
  return {
    ok: false,
    error: "That sport is not open for allegiance yet.",
  };
}

export function resolveFavoriteTeam(
  sportId: SportId,
  teamId: string | null | undefined
): CanonicalTeam | null {
  if (!teamId || isNoTeamId(teamId)) return null;
  if (sportId === "cfb") return getCfbTeamById(teamId);
  if (sportId === "nfl") return getNflTeamById(teamId);
  if (sportId === "cbb") return getCbbTeamById(teamId);
  return null;
}

export async function getMyFavoriteTeamId(
  sportId: SportId = "cfb"
): Promise<string | null> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return null;
  return getUserFavoriteTeamId(auth.userId, sportId);
}

export async function getUserFavoriteTeamId(
  userId: string,
  sportId: SportId = "cfb"
): Promise<string | null> {
  if (!userId || !hasSupabaseConfig()) return null;
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profile_favorite_teams")
      .select("team_id")
      .eq("user_id", userId)
      .eq("sport_id", sportId)
      .maybeSingle();
    if (error) {
      // Table missing — treat as no allegiance (migration not run)
      if (/relation|does not exist|schema cache/i.test(error.message || "")) {
        return null;
      }
      return null;
    }
    return (data?.team_id as string) || null;
  } catch {
    return null;
  }
}

export async function getUserFavoriteTeam(
  userId: string,
  sportId: SportId = "cfb"
): Promise<CanonicalTeam | null> {
  const id = await getUserFavoriteTeamId(userId, sportId);
  return resolveFavoriteTeam(sportId, id);
}

export async function getMyFavoriteTeam(
  sportId: SportId = "cfb"
): Promise<CanonicalTeam | null> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return null;
  return getUserFavoriteTeam(auth.userId, sportId);
}

/**
 * Upsert allegiance for one sport. Does not touch other sports or history.
 * Pass NO_TEAM_ID to record an explicit "no team" answer.
 */
export async function setMyFavoriteTeam(
  sportId: SportId,
  teamId: string
): Promise<{
  ok: boolean;
  team?: CanonicalTeam;
  noTeam?: boolean;
  error?: string;
}> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return { ok: false, error: auth.error };

  const valid = validateTeamForSport(sportId, teamId);
  if (!valid.ok) return { ok: false, error: valid.error };

  const noTeam = isNoTeamId(teamId);
  const team = noTeam ? undefined : resolveFavoriteTeam(sportId, teamId);
  if (!noTeam && !team) return { ok: false, error: "Unknown team." };

  try {
    const supabase = createClient();
    const { error } = await supabase.from("profile_favorite_teams").upsert(
      {
        user_id: auth.userId,
        sport_id: sportId,
        team_id: teamId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,sport_id" }
    );
    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message || "")) {
        return {
          ok: false,
          error:
            "Favorite teams table not ready. Run supabase/profile-favorite-teams.sql.",
        };
      }
      if (/row-level security|policy/i.test(error.message || "")) {
        return { ok: false, error: "Could not save allegiance (permissions)." };
      }
      return { ok: false, error: error.message || "Could not save." };
    }
    notifyFavoriteUpdated({ sportId, teamId });
    return { ok: true, team: team ?? undefined, noTeam };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save allegiance.",
    };
  }
}

/**
 * True when the user has never answered CFB allegiance
 * (no row — not the same as team_id = no-team).
 */
export async function needsCfbAllegiance(): Promise<boolean> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return false;
  const id = await getUserFavoriteTeamId(auth.userId, "cfb");
  return !id;
}

/** True if a CFB row exists (team or explicit no-team). */
export async function hasAnsweredCfbAllegiance(): Promise<boolean> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return false;
  const id = await getUserFavoriteTeamId(auth.userId, "cfb");
  return !!id;
}

/**
 * NFL team allegiance — profile/sport level (does not touch CFB).
 * Required: a real NFL catalog team. No-team is not allowed.
 * No row → needs selection. Real team id → satisfied.
 */
export async function needsNflAllegiance(): Promise<boolean> {
  const auth = await requireRealAuthUserId();
  if (!auth.ok) return false;
  const id = await getUserFavoriteTeamId(auth.userId, "nfl");
  if (!id) return true;
  // Legacy/corrupt row without valid catalog id
  if (isNoTeamId(id) || !isValidNflTeamId(id)) return true;
  return false;
}

export async function hasNflAllegiance(): Promise<boolean> {
  return !(await needsNflAllegiance());
}

/** Sport-aware: does this user still need allegiance for the active sport? */
export async function needsAllegianceForSport(
  sportId: SportId | string | null | undefined
): Promise<boolean> {
  const sid = (sportId || "").toString();
  // Unknown / missing sport → no allegiance gate (do not invent CFB).
  if (sid === "nfl") return needsNflAllegiance();
  if (sid === "cfb") return needsCfbAllegiance();
  if (sid === "cbb") {
    const auth = await requireRealAuthUserId();
    if (!auth.ok) return false;
    return !(await getUserFavoriteTeamId(auth.userId, "cbb"));
  }
  return false;
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  if (t.includes("://")) return "/";
  return t;
}

/**
 * Sport-aware declare URL. Only call when sport context is known.
 * Never invents CFB merely because it was the first supported sport.
 * Preserves the post-allegiance return destination (join/home/league).
 */
export function declareAllegianceHref(
  sportId: SportId | string | null | undefined,
  nextPath: string = "/"
): string {
  const sid = (sportId || "").toString().toLowerCase();
  const next = safeNextPath(nextPath);
  if (sid !== "nfl" && sid !== "cfb" && sid !== "cbb") {
    // No sport yet — do not force allegiance; stay on intended destination.
    return next;
  }
  return `/declare-allegiance?sport=${encodeURIComponent(sid)}&next=${encodeURIComponent(next)}`;
}
