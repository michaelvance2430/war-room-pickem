/**
 * At most one full-screen "drama" moment per browser session after first lock.
 * Prevents welcome + ring + finale stacking on the next login.
 */

import { wrModal } from "@/lib/runtime-iso";

const KEY = "warroom-session-drama-v1";

export type SessionDramaSlot =
  | "welcome"
  | "ring"
  | "finale"
  | "season_open"
  | "soft_unlock"
  | "weekly_cold_open"
  | "crew_week8";

function canUse() {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function getSessionDrama(): SessionDramaSlot | null {
  if (!canUse()) return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return (v as SessionDramaSlot) || null;
  } catch {
    return null;
  }
}

/**
 * Claim exclusive full-screen drama for this session.
 * Soft unlock is a banner — while it's active, no full-screen claim.
 * After soft unlock dismisses, full-screen still waits for next login
 * (see warroom-no-welcome-this-session).
 */
export function claimSessionDrama(slot: SessionDramaSlot): boolean {
  if (!canUse()) return true;
  try {
    const cur = sessionStorage.getItem(KEY);
    if (cur && cur !== slot) {
      wrModal(`claim DENIED ${slot} (owner=${cur})`);
      return false;
    }
    sessionStorage.setItem(KEY, slot);
    wrModal(`claim OK ${slot}`);
    return true;
  } catch {
    return true;
  }
}

export function clearSessionDrama(slot?: SessionDramaSlot) {
  if (!canUse()) return;
  try {
    if (!slot || sessionStorage.getItem(KEY) === slot) {
      wrModal(`clear ${slot || "any"}`);
      sessionStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}
