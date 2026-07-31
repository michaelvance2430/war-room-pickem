/**
 * Track which badges we've already celebrated for a user.
 * First run baselines current unlocks (no spam). Later unlocks fire the popup.
 */

import { getPlayerBadges, withPermanentBadges, syncLeagueCheevoKing } from "./badges";
import type { BadgeStatus, Player } from "./types";
import { getSession } from "./league";

const STORAGE_PREFIX = "warroom-badges-celebrated-v1:";

/** Gazette closed or skipped — safe to show achievement toast */
export const EVENT_GAZETTE_DONE = "warroom-gazette-done";

export function notifyGazetteDone() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_GAZETTE_DONE));
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

/** null = never initialized (baseline next) */
export function readCelebratedIds(userId: string): string[] | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCelebratedIds(userId: string, ids: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
}

export function markBadgesCelebrated(userId: string, badgeIds: string[]) {
  const prev = readCelebratedIds(userId) || [];
  writeCelebratedIds(userId, [...prev, ...badgeIds]);
}

/**
 * Badges earned since last celebration.
 * First visit: record current earned as baseline, return [] (no party).
 */
export function getUncelebratedBadges(player: Player): BadgeStatus[] {
  const p = withPermanentBadges(player);
  const earned = getPlayerBadges(p).filter((b) => b.earned);
  const earnedIds = earned.map((b) => b.def.id);
  const celebrated = readCelebratedIds(player.id);

  if (celebrated === null) {
    writeCelebratedIds(player.id, earnedIds);
    return [];
  }

  const known = new Set(celebrated);
  return earned.filter((b) => !known.has(b.def.id));
}

/** Load me from league list + cheevo sync, then find new unlocks. */
export async function findNewBadgeUnlocksForSession(): Promise<{
  player: Player;
  newBadges: BadgeStatus[];
} | null> {
  const session = getSession();
  if (!session?.playerId) return null;

  try {
    const { loadLeaguePlayers } = await import("./cloud");
    let players = await loadLeaguePlayers();
    players = syncLeagueCheevoKing(players.map((p) => withPermanentBadges(p)));
    const me = players.find((p) => p.id === session.playerId);
    if (!me) return null;
    const tagged = withPermanentBadges(me);
    const newBadges = getUncelebratedBadges(tagged);
    return { player: tagged, newBadges };
  } catch {
    return null;
  }
}
