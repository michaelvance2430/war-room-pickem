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
  clearPendingBadgeCelebration(userId, badgeIds);
}

/**
 * Lore grants (Cavalry Scout, etc.) that should popup once on next login
 * even though they land as permanent badges (which normally skip celebration).
 */
const PENDING_PREFIX = "warroom-pending-badge-celebration-v1:";

export function readPendingBadgeCelebration(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function queuePendingBadgeCelebration(
  userId: string,
  badgeIds: string[]
): void {
  if (typeof window === "undefined" || !userId || !badgeIds.length) return;
  try {
    const next = [
      ...new Set([...readPendingBadgeCelebration(userId), ...badgeIds]),
    ];
    localStorage.setItem(`${PENDING_PREFIX}${userId}`, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("warroom-force-badge-check"));
  } catch {
    /* ignore */
  }
}

export function clearPendingBadgeCelebration(
  userId: string,
  badgeIds?: string[]
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    if (!badgeIds?.length) {
      localStorage.removeItem(`${PENDING_PREFIX}${userId}`);
      return;
    }
    const drop = new Set(badgeIds);
    const left = readPendingBadgeCelebration(userId).filter((id) => !drop.has(id));
    if (left.length) {
      localStorage.setItem(
        `${PENDING_PREFIX}${userId}`,
        JSON.stringify(left)
      );
    } else {
      localStorage.removeItem(`${PENDING_PREFIX}${userId}`);
    }
  } catch {
    /* ignore */
  }
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
  // Pending lore popups (e.g. Cavalry Scout first grant) must NOT be backfilled
  const pending = new Set(readPendingBadgeCelebration(playerId));

  for (const id of career) {
    if (!pending.has(id)) known.add(id);
  }
  for (const id of permanent) {
    if (!pending.has(id)) known.add(id);
  }

  for (const b of earned) {
    if (!b.earned) continue;
    const id = b.def.id;
    if (pending.has(id)) continue; // wait for unlock modal
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
    // Foundry testing can celebrate so the shop can see cheevo UX
    await syncFirstWeekFromCloud(session.playerId);
    let foundry = false;
    try {
      const { allowFoundryCeremonies } = await import("./foundry-preview");
      foundry = allowFoundryCeremonies();
    } catch {
      foundry = false;
    }
    // Lore pending (Cavalry Scout etc.) always allowed to pop on login
    const pendingLore = readPendingBadgeCelebration(session.playerId);
    if (
      !canShowBadgeCelebrations(session.playerId) &&
      !foundry &&
      pendingLore.length === 0
    ) {
      return null;
    }

    // Ensure name-pinned lore grants land before we scan for uncelebrated
    try {
      const { applyLegacyBadgeGrants } = await import("./legacy-badge-grants");
      applyLegacyBadgeGrants({
        id: session.playerId,
        name: session.playerName || "",
      });
    } catch {
      /* ok */
    }

    const { loadLeaguePlayers, loadLeagueActiveWeek } = await import("./cloud");
    let players = await loadLeaguePlayers();
    players = syncLeagueCheevoKing(players.map((p) => withPermanentBadges(p)));
    const me = players.find((p) => p.id === session.playerId);
    if (!me) return null;
    // Prefer live display name for legacy grants (Tbone / Soulstache match)
    try {
      const { applyLegacyBadgeGrants } = await import("./legacy-badge-grants");
      applyLegacyBadgeGrants({ id: me.id, name: me.name || session.playerName });
    } catch {
      /* ok */
    }
    const tagged = withPermanentBadges(me);
    // Bank first, then backfill celebrated from bank — kills login re-fires
    // (pending lore ids are excluded from backfill until dismissed)
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
