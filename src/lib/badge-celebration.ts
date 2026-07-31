/**
 * Track which badges we've already celebrated for a user.
 *
 * Bump CELEBRATION_EPOCH to force every client to re-see unlocks
 * (new storage key → empty celebrated list → all current earned fire one-by-one).
 */

import {
  getPlayerBadges,
  withPermanentBadges,
  syncLeagueCheevoKing,
} from "./badges";
import { bankCareerCheevos } from "./career-cheevo";
import type { BadgeStatus, BadgeTier, Player } from "./types";
import { getSession } from "./league";

/**
 * Bump this number to reset achievement notifications for everyone.
 * Next login: each earned badge that isn't in the new key is celebrated
 * one at a time (after Gazette).
 */
export const CELEBRATION_EPOCH = 2;

const STORAGE_PREFIX = `warroom-badges-celebrated-e${CELEBRATION_EPOCH}:`;

/** Gazette closed or skipped — safe to show achievement toast */
export const EVENT_GAZETTE_DONE = "warroom-gazette-done";

export function notifyGazetteDone() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_GAZETTE_DONE));
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

/** Always returns an array (missing key = none celebrated yet). */
export function readCelebratedIds(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw == null) return [];
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
  const prev = readCelebratedIds(userId);
  writeCelebratedIds(userId, [...prev, ...badgeIds]);
}

const TIER_ORDER: BadgeTier[] = ["legendary", "epic", "rare", "common"];

/** Sort flashiest first for the one-at-a-time queue. */
export function sortBadgesForCelebration(badges: BadgeStatus[]): BadgeStatus[] {
  return [...badges].sort(
    (a, b) =>
      TIER_ORDER.indexOf(a.def.tier) - TIER_ORDER.indexOf(b.def.tier) ||
      a.def.name.localeCompare(b.def.name)
  );
}

/**
 * Badges earned that we haven't celebrated yet.
 * Missing storage key = none celebrated → return all currently earned
 * (used for epoch resets so everyone sees the popup next login).
 */
export function getUncelebratedBadges(player: Player): BadgeStatus[] {
  const p = withPermanentBadges(player);
  const earned = getPlayerBadges(p).filter((b) => b.earned);
  const known = new Set(readCelebratedIds(player.id));
  return sortBadgesForCelebration(
    earned.filter((b) => !known.has(b.def.id))
  );
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
    // Bank career points whenever we detect earned badges
    bankCareerCheevos(tagged.id, getPlayerBadges(tagged));
    return { player: tagged, newBadges };
  } catch {
    return null;
  }
}
