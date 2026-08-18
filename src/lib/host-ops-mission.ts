/**
 * Shared host operational mission resolver (Stage 4).
 *
 * Single sequential decision used by:
 *   - Home commissioner/deputy mission button (resolveCommishHomeMission)
 *   - League Hub pulse / attention badges (league-hub-actions)
 *
 * Do not invent a second mission system. Pure facts in → one mission out.
 *
 * Authorization: callers must only invoke for isOps (commissioner OR deputy).
 * Production ops share week-ops build/score (isOps gate on client + scoreWeek).
 * There are no finer-grained deputy capability flags — if is_deputy, all host
 * ops missions below are permitted destinations.
 *
 * Trophy ceremony is optional on the facts object (Home may set it; hub usually
 * leaves it false to avoid cross-league closeout fan-out).
 */

import { isCardLockDeadlinePassed } from "./dates";
import { weekTitle } from "./dates";
import { seasonMaxWeek } from "./season-calendar";
import type { Game } from "./types";

/** Semantic kinds — match prior CommishHomeMission kinds. */
export type HostOpsMissionKind =
  | "trophy_ceremony"
  | "next_week"
  | "score"
  | "build"
  | "finish";

export type HostOpsMission = {
  kind: HostOpsMissionKind;
  label: string;
  href: string;
  weekNumber: number;
  weekLabel: string;
};

/**
 * Authoritative facts for one league's host path.
 * No session/role here — role is decided by the caller.
 */
export type HostOpsFacts = {
  sportId: string;
  /** Active/live week number (leagues.current_week). */
  week: number;
  /** True when current week has trusted scored results. */
  weekScored: boolean;
  /** Games on the current week card (0 if none). */
  gameCount: number;
  /** Prop question set and non-placeholder. */
  hasProp: boolean;
  /**
   * Minimal game list for lock deadline (commenceTime / startTime).
   * Empty → lock deadline is not considered passed.
   */
  gamesForLock: Array<{
    commenceTime?: string | null;
    startTime?: string | null;
  }>;
  /**
   * When weekScored: next calendar week to build, or null if season done.
   * nextWeekHasGames: whether that week already has a card with games.
   */
  nextWeek: number | null;
  nextWeekHasGames: boolean;
  /** When true, trophy ceremony beats build/score (CFB closeout). */
  trophyReady?: boolean;
};

/**
 * Home host mission order (preserved exactly):
 *  1. Trophy ceremony (when ready)
 *  2. Active week scored → Build next week card (if needed) or none
 *  3. Score week (published slate + first kickoff passed + not scored)
 *  4. Build card (no games)
 *  5. Finish card (games < 5 or missing prop)
 *  6. none — host plays like a player (Home hero / hub player path)
 *
 * "Published" for score readiness matches Home: gameCount >= 5
 * (not a separate published_at check).
 */
export function resolveHostOpsMission(
  f: HostOpsFacts,
  now = Date.now()
): HostOpsMission | null {
  const sportId = f.sportId || "cfb";
  const week = f.week;
  const weekLabel = weekTitle(week, sportId);

  // 1. Trophy ceremony
  if (f.trophyReady) {
    return {
      kind: "trophy_ceremony",
      label: "BEGIN TROPHY CEREMONY",
      href: "/trophy-ceremony",
      weekNumber: week,
      weekLabel,
    };
  }

  // 2. Week already scored → prepare next card if season continues
  if (f.weekScored) {
    const max = seasonMaxWeek(sportId);
    const next = week + 1;
    if (next <= max && !f.nextWeekHasGames) {
      const nextLabel = weekTitle(next, sportId);
      return {
        kind: "next_week",
        label: `Build ${nextLabel} Card`,
        href: `/week-ops?week=${next}&step=1`,
        weekNumber: next,
        weekLabel: nextLabel,
      };
    }
    return null;
  }

  const games = (f.gamesForLock || []).map((g) => ({
    commenceTime: g.commenceTime || undefined,
    startTime: g.startTime || undefined,
  })) as Game[];
  const hasGames = f.gameCount >= 5;
  // Home: published = hasGames (card with ≥5 games is live for scoring path)
  const published = hasGames;

  // 3. Scoring: published + first kickoff passed + not scored
  if (published && isCardLockDeadlinePassed(games, now)) {
    return {
      kind: "score",
      label: `Score ${weekLabel}`,
      href: `/week-ops?week=${week}&step=score`,
      weekNumber: week,
      weekLabel,
    };
  }

  // 4. Build
  if (f.gameCount === 0) {
    return {
      kind: "build",
      label: `Build ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=1`,
      weekNumber: week,
      weekLabel,
    };
  }

  // 5. Finish (incomplete games or prop)
  if (!hasGames || f.gameCount < 5) {
    return {
      kind: "finish",
      label: `Finish ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=1`,
      weekNumber: week,
      weekLabel,
    };
  }

  if (!f.hasProp) {
    return {
      kind: "finish",
      label: `Finish ${weekLabel} Card`,
      href: `/week-ops?week=${week}&step=3`,
      weekNumber: week,
      weekLabel,
    };
  }

  // 6. Card live, before kickoff — no host mission
  return null;
}

/** Whether membership is ops for host missions (commissioner or deputy). */
export function membershipIsOps(
  m: {
    role?: string;
    commissionerId?: string;
    isDeputy?: boolean;
  },
  uid: string
): boolean {
  if (!uid) return false;
  if (m.role === "commissioner" || m.commissionerId === uid) return true;
  if (m.isDeputy) return true;
  return false;
}
