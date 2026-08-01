/**
 * Progressive My Picks surface — same scoring rules, quieter first path.
 *
 * First lock ever: games + confidence + Best Bet (simple) + Lock.
 * Bonus (prop) starts collapsed but still required to save (honest rules).
 * Chaos stays week ≥ 2 (existing gate).
 */

import { hasLockedPicksOnce, isCoreLoopUnlocked } from "@/lib/first-week";
import { getSession } from "@/lib/league";

/** Quiet first-card path until they've locked once (or season has scores). */
export function isQuietPicksPath(playerId?: string | null): boolean {
  const id = playerId ?? getSession()?.playerId;
  if (!id) return true;
  // After first lock or any scored week → full surface
  if (isCoreLoopUnlocked(id)) return false;
  if (hasLockedPicksOnce(id)) return false;
  return true;
}

export function quietPicksIntro(): string {
  return (
    "One job, genius: pick every side, slap confidence 1–5 (each once — no freestyling), " +
    "mark a Best Bet, answer the little bonus, then Lock before first kickoff. " +
    "That's it. We believe in you. Mostly."
  );
}

export function quietPicksBonusHint(): string {
  return "Bonus is required. Yes, really. Pick a side or the lock button stays mad at you.";
}

/** Quiet path: prop starts open so “needed” isn’t hidden. */
export function quietPicksBonusStartsOpen(): boolean {
  return true;
}
