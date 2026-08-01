/**
 * Simple host mode — Run the Room for normal commissioners.
 *
 * New / normal hosts: invite → card → fill seats? → score.
 * Deep bot/chaos/SQL tools: app creator only (Founder Test Mode + advanced).
 *
 * Fairness: once the season is live (or any week scored), filler bots stay.
 * No clearing bots to climb the board.
 */

import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { isFirstTimeCommish } from "@/lib/commish-onboarding";
import { isRealSeasonLive } from "@/lib/season-mode";

/** Ideal friend-league size for dual brackets (8+8). */
export const SIMPLE_BOT_FILL_TARGET = 16;

/**
 * True when filler bots may no longer be removed (fairness lock).
 * Real season open OR any week already scored.
 */
export async function areBotsRosterLocked(): Promise<boolean> {
  if (isRealSeasonLive()) return true;
  try {
    const { listScoredWeekNumbers } = await import("@/lib/cloud");
    const scored = await listScoredWeekNumbers();
    if (scored.length > 0) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function botsLockedMessage(): string {
  return (
    "Filler bots stay for the season so standings stay honest. " +
    "You can’t remove them after the season starts (or after a week is scored)."
  );
}

/** Deep bot ops (Chaos, locker seed, Crystal Ball bots, SQL copy, exact counts). */
export function canShowDeepHostTools(userId?: string | null): boolean {
  const id = userId ?? getSession()?.playerId;
  return isAppCreator(id);
}

/**
 * First-time host surface — checklist-level simplicity.
 * Graduates after first scored week (same as isFirstTimeCommish).
 */
export function isSimpleHostSurface(opts: {
  leagueId: string;
  scoredWeekCount: number;
  userId?: string | null;
}): boolean {
  // Creator can still use simple surface but may expand advanced
  if (canShowDeepHostTools(opts.userId)) return false;
  return isFirstTimeCommish({
    leagueId: opts.leagueId,
    scoredWeekCount: opts.scoredWeekCount,
  });
}

/**
 * One-tap fill empty seats toward ideal size (or mid-season replacements).
 */
export async function simpleFillEmptySeatsWithBots(opts?: {
  weekNumber?: number;
  targetTotal?: number;
}): Promise<{
  ok: boolean;
  added?: number;
  totalBots?: number;
  botsFilled?: number;
  rosterAfter?: number;
  avgPoints?: number;
  error?: string;
  locked?: boolean;
}> {
  const { fillLeagueWithBotsToCap } = await import("@/lib/cloud");
  const midSeason = isRealSeasonLive();
  const target = opts?.targetTotal ?? SIMPLE_BOT_FILL_TARGET;
  return fillLeagueWithBotsToCap({
    targetTotal: target,
    ...(opts?.weekNumber != null ? { weekNumber: opts.weekNumber } : {}),
    ...(midSeason ? { midSeasonReplacement: true } : {}),
  });
}

/**
 * Remove all trial bots — blocked when roster is locked for fairness.
 */
export async function simpleRemoveFillerBots(): Promise<{
  ok: boolean;
  removed?: number;
  error?: string;
  locked?: boolean;
}> {
  if (await areBotsRosterLocked()) {
    return {
      ok: false,
      locked: true,
      error: botsLockedMessage(),
    };
  }
  const { clearTrialBotsInCloud } = await import("@/lib/cloud");
  return clearTrialBotsInCloud();
}
