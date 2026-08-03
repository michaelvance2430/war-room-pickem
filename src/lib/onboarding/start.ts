/**
 * Decide which journey to offer a signed-in user (not guest, not Through Their Eyes).
 */

import { getSession, isActuallyCommissioner } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { isFirstTimeCommish } from "@/lib/commish-onboarding";
import { listScoredWeekNumbers } from "@/lib/cloud";
import {
  hasCompletedJourney,
  isOnboardingActive,
  needsJourney,
  startJourney,
} from "./engine";
import { getLeague } from "@/lib/league";

/**
 * Prefer commissioner journey for first-time hosts; else player journey.
 * Never starts if already active or guest.
 */
export async function maybeStartOnboarding(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isGuestMode()) return;
  if (isOnboardingActive()) return;

  const session = getSession();
  if (!session?.playerId) return;

  // Host first — they need the room alive before players lock
  if (isActuallyCommissioner()) {
    const leagueId = getLeague()?.id || session.leagueId || "";
    let scored = 0;
    try {
      scored = (await listScoredWeekNumbers()).length;
    } catch {
      scored = 0;
    }
    if (
      leagueId &&
      isFirstTimeCommish({ leagueId, scoredWeekCount: scored }) &&
      needsJourney("commissioner")
    ) {
      startJourney("commissioner", { userId: session.playerId });
      return;
    }
  }

  if (needsJourney("player") && !hasCompletedJourney("player")) {
    // Suppress legacy "Walk the dog" coach — new engine owns first session
    try {
      const { completePlayerTutorial } = await import("@/lib/player-tutorial");
      completePlayerTutorial();
    } catch {
      /* ok */
    }
    startJourney("player", { userId: session.playerId });
  }
}
