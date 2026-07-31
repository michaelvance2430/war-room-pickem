/**
 * Track which badges we've already celebrated for a user.
 *
 * Anti-glitch: never re-pop badges already owned (career bank, permanent,
 * earn meta, or prior celebration epochs). Stackable badges celebrate per
 * stack height (`badgeId#3`) only when count increases.
 */

import {
  getPlayerBadges,
  withPermanentBadges,
  syncLeagueCheevoKing,
  isStackableBadge,
} from "./badges";
import {
  bankCareerCheevos,
  getCareerBadgeIds,
} from "./career-cheevo";
import { getPermanentBadgeIds } from "./permanent-badges";
import { getBadgeEarnMeta } from "./badge-earn-meta";
import {
  getBadgeStackCount,
  stackCelebrationKey,
} from "./badge-stacks";
import type { BadgeStatus, BadgeTier, Player } from "./types";
import { getSession } from "./league";

/**
 * Bump only when you intentionally want a global re-show.
 * Prefer backfill over epoch bumps so logins don't re-fire owned cheevos.
 */
export const CELEBRATION_EPOCH = 3;

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

/**
 * Pull celebrated ids from older epochs so an epoch bump doesn't re-pop everything.
 */
function migrateFromPriorEpochs(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  const found: string[] = [];
  for (let e = 1; e < CELEBRATION_EPOCH; e++) {
    try {
      const raw = localStorage.getItem(
        `warroom-badges-celebrated-e${e}:${userId}`
      );
      if (!raw) continue;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) found.push(...parsed);
    } catch {
      /* ignore */
    }
  }
  return found;
}

/**
 * Seed celebrated list from everything the player already owns so
 * logout/login never re-fires Creator / Legend / banked cheevos.
 */
export function backfillCelebratedFromOwned(
  playerId: string,
  earned: BadgeStatus[]
): void {
  if (!playerId) return;
  const known = new Set([
    ...readCelebratedIds(playerId),
    ...migrateFromPriorEpochs(playerId),
  ]);
  const career = getCareerBadgeIds(playerId);
  const permanent = getPermanentBadgeIds(playerId);

  for (const id of career) known.add(id);
  for (const id of permanent) known.add(id);

  for (const b of earned) {
    if (!b.earned) continue;
    const id = b.def.id;
    // Already owned signals → mark celebrated, no popup
    if (
      career.includes(id) ||
      permanent.includes(id) ||
      getBadgeEarnMeta(playerId, id) ||
      b.earnedAt
    ) {
      known.add(id);
      if (isStackableBadge(id)) {
        const count = getBadgeStackCount(playerId, id) || 1;
        for (let c = 1; c <= count; c++) {
          known.add(stackCelebrationKey(id, c));
        }
      }
    }
  }

  writeCelebratedIds(playerId, [...known]);
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
 * Stackables: only when stack height is new (`id#N`).
 * One-shots: only if never owned/celebrated.
 */
export function getUncelebratedBadges(
  player: Player,
  opts?: { allowStackMultiples?: boolean }
): BadgeStatus[] {
  const p = withPermanentBadges(player);
  const earned = getPlayerBadges(p).filter((b) => b.earned);
  backfillCelebratedFromOwned(p.id, earned);
  const known = new Set(readCelebratedIds(p.id));
  const allowStackMultiples = opts?.allowStackMultiples !== false;

  const fresh: BadgeStatus[] = [];
  for (const b of earned) {
    const id = b.def.id;
    if (isStackableBadge(id)) {
      const count = Math.max(1, b.earnCount || getBadgeStackCount(p.id, id) || 1);
      const key = stackCelebrationKey(id, count);
      if (!known.has(key)) {
        // Don't re-pop stack #1 if plain id was celebrated historically
        if (count === 1 && known.has(id)) {
          markBadgesCelebrated(p.id, [key]);
          continue;
        }
        // Multi-earn fanfare is mid-season energy — hold ×2+ until unlocked
        if (count > 1 && !allowStackMultiples) {
          continue;
        }
        fresh.push(b);
      }
    } else if (!known.has(id)) {
      fresh.push(b);
    }
  }

  return sortBadgesForCelebration(fresh);
}

/** Load me from league list + cheevo sync, then find new unlocks. */
export async function findNewBadgeUnlocksForSession(): Promise<{
  player: Player;
  newBadges: BadgeStatus[];
} | null> {
  const session = getSession();
  if (!session?.playerId) return null;

  try {
    const {
      canShowBadgeCelebrations,
      canCelebrateStackMultiples,
      syncFirstWeekFromCloud,
    } = await import("./first-week");
    // First week: earn quietly — no popup stack until first lock / scores
    await syncFirstWeekFromCloud(session.playerId);
    if (!canShowBadgeCelebrations(session.playerId)) {
      return null;
    }

    const { loadLeaguePlayers, loadLeagueActiveWeek } = await import("./cloud");
    let players = await loadLeaguePlayers();
    players = syncLeagueCheevoKing(players.map((p) => withPermanentBadges(p)));
    const me = players.find((p) => p.id === session.playerId);
    if (!me) return null;
    const tagged = withPermanentBadges(me);
    // Bank first, then backfill celebrated from bank — kills login re-fires
    bankCareerCheevos(tagged.id, getPlayerBadges(tagged));
    let activeWeek = 0;
    try {
      activeWeek = await loadLeagueActiveWeek();
    } catch {
      activeWeek = 0;
    }
    const newBadges = getUncelebratedBadges(tagged, {
      allowStackMultiples: canCelebrateStackMultiples(
        session.playerId,
        activeWeek
      ),
    });
    return { player: tagged, newBadges };
  } catch {
    return null;
  }
}
