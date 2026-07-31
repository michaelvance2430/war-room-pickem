/**
 * Sandbox (preseason dry runs) vs real season.
 *
 * Sandbox (before doors open Aug 23 2026):
 *  - Fake weeks, bots, auto-season — achievements do NOT bank to career
 *  - Permanent grants from sim (First & Final, Elite Commish, etc.) do NOT stick
 *  - Season reset wipes sim trophies + local sim progress
 *
 * Real season (after open):
 *  - Career cheevos + permanent badges stick forever
 *  - Season reset zeros scores/cards but keeps career hardware
 */

import { SEASON_OPEN_AT_MS } from "./season-countdown";

/** Badges that survive sandbox wipe (true prior-season / app creator). */
export const SANDBOX_PROTECTED_BADGE_IDS = new Set([
  "the_commissioner", // app creator legendary
  "war_room_legend", // Kahmann / Bill ball Ben prior-season
]);

/**
 * True while friends are still dry-running before the real 2026-27 open.
 * After SEASON_OPEN_AT_MS, resets keep career cheevos.
 */
export function isSandboxMode(now = Date.now()): boolean {
  // Guest demo is always sandbox (no career bank from the tour)
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("warroom-guest-mode-v1");
      if (raw) {
        const g = JSON.parse(raw) as { active?: boolean };
        if (g?.active) return true;
      }
    }
  } catch {
    /* ignore */
  }
  if (Number.isNaN(SEASON_OPEN_AT_MS)) return true;
  return now < SEASON_OPEN_AT_MS;
}

export function isRealSeasonLive(now = Date.now()): boolean {
  return !isSandboxMode(now);
}

export function seasonModeLabel(now = Date.now()): string {
  return isSandboxMode(now)
    ? "Sandbox / dry-run (cheevos & sim trophies wipe on reset)"
    : "Real season (career cheevos stick on reset)";
}

export function isSandboxProtectedBadge(badgeId: string): boolean {
  return SANDBOX_PROTECTED_BADGE_IDS.has(badgeId);
}
