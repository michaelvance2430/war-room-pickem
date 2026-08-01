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
    "One job: pick each side, set confidence 1–5 (each once), mark a Best Bet, " +
    "answer the bonus below, then Lock it in before first kickoff."
  );
}

export function quietPicksBonusHint(): string {
  return "Bonus is required — pick one side, then lock. Same rules as every week.";
}

/** Quiet path: prop starts open so “needed” isn’t hidden. */
export function quietPicksBonusStartsOpen(): boolean {
  return true;
}
