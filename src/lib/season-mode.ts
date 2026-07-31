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
 *  - Demo / trial-bot / auto-score training tools lock
 */

import { SEASON_OPEN_AT_MS, SEASON_OPEN_LABEL } from "./season-countdown";

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

/**
 * Demo slate, trial bots, randomize+score, auto-score range —
 * practice toolkit for learning the Commish role before doors open.
 */
export function isPreseasonCommishToolsAllowed(now = Date.now()): boolean {
  return isSandboxMode(now);
}

export const PRESEASON_COMMISH_TOOLS_TITLE = "Pre-season practice tools";

export function preseasonCommishToolsBody(): string {
  return (
    "Demo weeks, trial bots, and auto-score runs are for pre-season only — " +
    "so you can learn the commissioner role without burning real lines or " +
    "messing up the live board.\n\n" +
    `Once the season is open (${SEASON_OPEN_LABEL}), the league runs on live odds, ` +
    "real player picks, and real scores only.\n\n" +
    "You can still clear leftover trial bots if any remain."
  );
}

export function seasonModeLabel(now = Date.now()): string {
  return isSandboxMode(now)
    ? "Sandbox / dry-run (cheevos & sim trophies wipe on reset)"
    : "Real season (career cheevos stick on reset)";
}

export function isSandboxProtectedBadge(badgeId: string): boolean {
  return SANDBOX_PROTECTED_BADGE_IDS.has(badgeId);
}
