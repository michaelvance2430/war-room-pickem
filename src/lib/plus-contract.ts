/**
 * War Room Plus product boundary.
 *
 * This is an inactive contract, not a checkout implementation. Entitlements
 * will be granted only by verified server-side Apple/web purchase processing.
 * No client may promote itself to Plus and no competitive outcome may depend
 * on an entitlement.
 */

export const WAR_ROOM_PLUS_PUBLIC = false;
export const COMMISSIONER_PLUS_PUBLIC = false;

export type WarRoomPlan = "free" | "plus" | "commissioner_plus";
export type EntitlementSource = "apple" | "web" | "founder_grant";
export type EntitlementStatus = "active" | "grace_period" | "expired" | "revoked";

export type WarRoomEntitlement = {
  userId: string;
  plan: Exclude<WarRoomPlan, "free">;
  source: EntitlementSource;
  status: EntitlementStatus;
  productId: string;
  startsAt: string;
  expiresAt: string | null;
  verifiedAt: string;
};

export const FREE_FOREVER = Object.freeze([
  "join_and_create_leagues",
  "make_and_lock_picks",
  "competitive_scoring",
  "standings_and_cut_line",
  "championship_and_toilet_bowl",
  "locker_room",
  "core_gazette_and_moments",
  "core_achievements_and_trophies",
  "competitive_fairness",
] as const);

export const PLUS_CANDIDATES = Object.freeze([
  "premium_room_themes",
  "deeper_personal_history",
  "expanded_profile_hardware",
  "enhanced_season_memories",
  "personalized_scouting_and_intelligence",
] as const);

/** First paid product candidate: one commissioner purchase, one league season. */
export const COMMISSIONER_PLUS_CANDIDATES = Object.freeze([
  "commissioner_automation",
  "premium_league_identity",
  "enhanced_league_moments",
  "advanced_league_legacy",
] as const);

export const NEVER_PAID = Object.freeze([
  "extra_points",
  "better_odds",
  "late_or_changed_picks",
  "standings_advantage",
  "postseason_advantage",
  "exclusive_competitive_information",
] as const);

export function hasActivePlus(entitlement: WarRoomEntitlement | null | undefined): boolean {
  if (!WAR_ROOM_PLUS_PUBLIC || !entitlement) return false;
  return entitlement.status === "active" || entitlement.status === "grace_period";
}
