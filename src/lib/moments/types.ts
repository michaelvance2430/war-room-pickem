/**
 * War Room Moments — object schema (code).
 * Design source: docs/MOMENT-OBJECT-SCHEMA.md
 *
 * A Moment is a player-facing emotional beat players might remember a month later.
 * Television for the season — not a reward for the login.
 *
 * Product language: Tier I Traditions · Tier II Weekly Rituals · Tier III Recognition
 * Stars (emotionalWeight) are internal mapping only.
 *
 * Tier I: Constitution law "Traditions Are Sacred" — frozen once shipped;
 * founder + unanimous partners; founder test = will players feel more?
 */

/** Product-facing Moment tier (prefer over star talk) */
export type MomentTier =
  | "tradition" // Tier I — sacred, once-a-season peaks
  | "weekly_ritual" // Tier II — heartbeat
  | "recognition"; // Tier III — personal delight

export type MomentCategory =
  | "season_begins"
  | "weekly_ritual"
  | "milestone"
  | "season_finale";

export type MomentAnimation = "none" | "light" | "full_ceremony";

export type MomentReplayPolicy =
  | "once_per_user_league_season"
  | "once_ever"
  | "once_per_week"
  | "every_occurrence"
  | "foundry_only";

/** 1–5 stars → internal emotional weight only (docs/EMOTIONAL-BUDGET.md) */
export type EmotionalWeight = 1 | 2 | 3 | 4 | 5;

export type MomentSportId = "cfb" | "nfl";

export type MomentDefinition = {
  id: string;
  name: string;
  /** Product language tier — Traditions are unanimous-change only when frozen */
  tier: MomentTier;
  /** When true, do not edit without unanimous Tradition protection approval */
  frozen?: boolean;
  category: MomentCategory;
  purpose: string;
  emotionalWeight: EmotionalWeight;
  supportedSports: MomentSportId[];
  /** ExperienceQueue priority — lower runs first among eligible Moments */
  priority: number;
  animation: MomentAnimation;
  replayPolicy: MomentReplayPolicy;
  blocksNavigation: boolean;
  /** Target total duration when blocking (ms) */
  durationTargetMs: number;
  foundryPreview: boolean;
};

export type MomentClaimIdentity = {
  momentId: string;
  userId: string;
  leagueId: string;
  sportId: MomentSportId;
  seasonKey: string;
};

export type MomentAnalyticsEvent =
  | "claimed"
  | "completed"
  | "skipped"
  | "preview"
  | "blocked";

export type MomentAnalyticsDetail = {
  momentId: string;
  event: MomentAnalyticsEvent;
  sportId?: string;
  speechId?: string;
  preview?: boolean;
  reason?: string;
};

export const EVENT_MOMENT_ANALYTICS = "warroom-moment-analytics";
export const EVENT_MOMENT_QUEUE = "warroom-moment-queue";
/** Foundry / creator: force Season Opening without burning claim (preview flag) */
export const EVENT_SEASON_OPEN_PREVIEW = "warroom-season-open-preview";
