/**
 * Infer completion for established users from trusted real data only.
 * Never invent from demo / orphan / fake records.
 */

import { getSession, getLeague, isActuallyCommissioner } from "@/lib/league";
import { COACH_KEYS } from "./keys";
import { isCoachOpen, markCoachCompleted } from "./store";

export type CoachWorldSnapshot = {
  isCommissioner: boolean;
  humanCount: number;
  publishedWeekCount: number;
  hasActiveWeekCard: boolean;
  scoredWeekCount: number;
  hasLockedPicks: boolean;
  hasAnyPicksRow: boolean;
  inviteCopied: boolean;
};

/**
 * Apply safe backfill once world facts are known.
 */
export function backfillCoachingFromWorld(
  snap: CoachWorldSnapshot,
  opts?: { userId?: string | null; leagueId?: string | null }
): void {
  const uid = opts?.userId ?? getSession()?.playerId;
  const leagueId = opts?.leagueId ?? getLeague()?.id;
  if (!uid || !leagueId) return;
  const o = { userId: uid, leagueId };

  // Commissioner milestones
  if (snap.isCommissioner || isActuallyCommissioner()) {
    if (snap.publishedWeekCount > 0) {
      if (isCoachOpen(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, o)) {
        markCoachCompleted(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, o);
      }
      if (isCoachOpen(COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD, o)) {
        markCoachCompleted(COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD, o);
      }
    } else if (snap.hasActiveWeekCard) {
      if (isCoachOpen(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, o)) {
        markCoachCompleted(COACH_KEYS.COMMISH_BUILD_FIRST_CARD, o);
      }
    }
    if (snap.humanCount >= 2 || snap.inviteCopied) {
      if (isCoachOpen(COACH_KEYS.COMMISH_INVITE_MEMBERS, o)) {
        markCoachCompleted(COACH_KEYS.COMMISH_INVITE_MEMBERS, o);
      }
    }
  }

  // Player milestones (commissioners are also players)
  if (snap.hasAnyPicksRow || snap.hasLockedPicks) {
    if (isCoachOpen(COACH_KEYS.PLAYER_MAKE_FIRST_PICKS, o)) {
      markCoachCompleted(COACH_KEYS.PLAYER_MAKE_FIRST_PICKS, o);
    }
  }
  if (snap.hasLockedPicks) {
    if (isCoachOpen(COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS, o)) {
      markCoachCompleted(COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS, o);
    }
  }
  // Results: veterans only (2+ scored weeks). First scored week may still coach once.
  if (snap.scoredWeekCount >= 2 && snap.hasLockedPicks) {
    if (isCoachOpen(COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS, o)) {
      markCoachCompleted(COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS, o);
    }
  }
}
