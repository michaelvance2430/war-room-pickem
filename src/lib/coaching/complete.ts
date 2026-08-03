/**
 * Mark coaching complete from real product actions only.
 */

import { COACH_KEYS } from "./keys";
import { markCoachCompleted } from "./store";

export function onInviteShared(leagueId?: string | null): void {
  markCoachCompleted(COACH_KEYS.COMMISH_INVITE_MEMBERS, { leagueId });
}

export function onWeekCardBuilt(leagueId?: string | null): void {
  markCoachCompleted(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, { leagueId });
}

export function onWeekCardPublished(leagueId?: string | null): void {
  markCoachCompleted(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, { leagueId });
  markCoachCompleted(COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD, { leagueId });
}

export function onPicksSaved(opts?: {
  leagueId?: string | null;
  locked?: boolean;
}): void {
  markCoachCompleted(COACH_KEYS.PLAYER_MAKE_FIRST_PICKS, {
    leagueId: opts?.leagueId,
  });
  if (opts?.locked) {
    markCoachCompleted(COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS, {
      leagueId: opts?.leagueId,
    });
  }
}

export function onPicksLocked(leagueId?: string | null): void {
  markCoachCompleted(COACH_KEYS.PLAYER_MAKE_FIRST_PICKS, { leagueId });
  markCoachCompleted(COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS, { leagueId });
}

export function onViewedResults(leagueId?: string | null): void {
  markCoachCompleted(COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS, { leagueId });
}
