/**
 * Pick at most one coaching prompt for the current user + room.
 */

import {
  getSession,
  getLeague,
  isActuallyCommissioner,
} from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  COACH_DEFS,
  COACH_KEYS,
  COACH_OFFER_ORDER,
  type CoachDefinition,
  type CoachKey,
} from "./keys";
import { isCoachOpen } from "./store";
import type { CoachWorldSnapshot } from "./backfill";

export type CoachOffer = CoachDefinition & {
  leagueId: string;
  userId: string;
};

/** Screens / modes where coaching must stay quiet. */
export function shouldSuppressCoaching(pathname: string | null): boolean {
  if (typeof window === "undefined") return true;
  if (isGuestMode()) return true;
  if (!getSession()?.playerId) return true;

  const path = pathname || window.location.pathname || "";
  if (
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/join") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot")
  ) {
    return true;
  }

  // Active full-screen drama / moment
  try {
    const { getSessionDrama } = require("@/lib/session-drama") as typeof import("@/lib/session-drama");
    if (getSessionDrama()) return true;
  } catch {
    /* ok */
  }

  // Known full-screen product overlays only (not every dialog)
  try {
    if (
      document.querySelector(
        "[data-season-opening],[data-badge-unlock-modal],[data-moment-fullscreen]"
      )
    ) {
      return true;
    }
  } catch {
    /* ok */
  }

  return false;
}

function eligible(
  key: CoachKey,
  snap: CoachWorldSnapshot,
  isCommish: boolean
): boolean {
  switch (key) {
    case COACH_KEYS.COMMISH_INVITE_MEMBERS:
      return (
        isCommish &&
        snap.humanCount < 2 &&
        !snap.inviteCopied
      );
    case COACH_KEYS.COMMISH_BUILD_FIRST_CARD:
      return (
        isCommish &&
        snap.publishedWeekCount === 0 &&
        !snap.hasActiveWeekCard
      );
    case COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD:
      // Only if a card exists but nothing is published yet
      return (
        isCommish &&
        snap.hasActiveWeekCard &&
        snap.publishedWeekCount === 0
      );
    case COACH_KEYS.PLAYER_MAKE_FIRST_PICKS:
      return (
        snap.publishedWeekCount > 0 &&
        !snap.hasAnyPicksRow &&
        !snap.hasLockedPicks
      );
    case COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS:
      return (
        snap.publishedWeekCount > 0 &&
        snap.hasAnyPicksRow &&
        !snap.hasLockedPicks
      );
    case COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS:
      // Show only after they've played and scores exist — not for pure spectators
      return snap.scoredWeekCount > 0 && snap.hasLockedPicks;
    default:
      return false;
  }
}

/**
 * First open key that is eligible for this world snapshot.
 */
export function resolveCoachOffer(
  snap: CoachWorldSnapshot,
  opts?: { userId?: string | null; leagueId?: string | null }
): CoachOffer | null {
  const userId = opts?.userId ?? getSession()?.playerId;
  const leagueId = opts?.leagueId ?? getLeague()?.id;
  if (!userId || !leagueId) return null;

  const isCommish = snap.isCommissioner || isActuallyCommissioner();
  const o = { userId, leagueId };

  for (const key of COACH_OFFER_ORDER) {
    if (!isCoachOpen(key, o)) continue;
    if (!eligible(key, snap, isCommish)) continue;
    const def = COACH_DEFS[key];
    if (!def) continue;
    return { ...def, userId, leagueId };
  }
  return null;
}
