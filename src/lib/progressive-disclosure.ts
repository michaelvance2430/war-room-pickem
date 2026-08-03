/**
 * Progressive disclosure — simple surface early, depth opens as the season lives.
 *
 * Builds on first-week.ts (lock once / season alive).
 *
 * Phases (player-facing):
 *  1. onboarding  — before first lock: Card · Lock · Locker (minimal chrome)
 *  2. core        — locked once: Board + competition loud; depth still quiet
 *  3. deepening   — ~week 3: Gazette shelf / News archive revealed
 *  4. full        — after reveal (or veteran override): full nav + home tiles
 *
 * Rules stay the same; chrome gets louder. Paper still pops when scored.
 */

import {
  hasLockedPicksOnce,
  hasSeasonComeAlive,
  isCoreLoopUnlocked,
  isFirstWeekChrome,
} from "@/lib/first-week";
// hasLockedPicksOnce used for deep tiles / late-joiner calm
import { getSession } from "@/lib/league";

const KEY_GAZETTE_REVEAL = "warroom-gazette-shelf-reveal-v1";
const KEY_FULL_ROOM = "warroom-show-full-room-v1";
export const EVENT_PROGRESSIVE = "warroom-progressive-disclosure";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readMap(key: string): Record<string, boolean> {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, boolean>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, boolean>) {
  if (!canUse()) return;
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_PROGRESSIVE));
  } catch {
    /* ignore */
  }
}

function pid(playerId?: string | null): string | null {
  if (playerId) return playerId;
  return getSession()?.playerId || null;
}

/** Veteran override: show everything regardless of week. */
export function wantsFullRoom(playerId?: string | null): boolean {
  const id = pid(playerId);
  if (!id) return false;
  return !!readMap(KEY_FULL_ROOM)[id];
}

export function setWantsFullRoom(
  on: boolean,
  playerId?: string | null
): void {
  const id = pid(playerId);
  if (!id || !canUse()) return;
  const map = readMap(KEY_FULL_ROOM);
  if (on) map[id] = true;
  else delete map[id];
  writeMap(KEY_FULL_ROOM, map);
  notify();
}

export function hasSeenGazetteShelfReveal(playerId?: string | null): boolean {
  const id = pid(playerId);
  if (!id) return false;
  return !!readMap(KEY_GAZETTE_REVEAL)[id];
}

export function markGazetteShelfRevealSeen(playerId?: string | null): void {
  const id = pid(playerId);
  if (!id || !canUse()) return;
  const map = readMap(KEY_GAZETTE_REVEAL);
  if (map[id]) return;
  map[id] = true;
  writeMap(KEY_GAZETTE_REVEAL, map);
  notify();
}

/**
 * Calendar / season signal that paper-shelf energy has arrived.
 * Full seasons: week 3 / 2 scored. Short packs (e.g. WWC): earlier (pack-progressive).
 */
export function isWeekThreeish(opts: {
  activeWeek: number;
  scoredCount: number;
  sportId?: string | null;
}): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isGazetteShelfTiming } = require("./pack-progressive") as typeof import("./pack-progressive");
    return isGazetteShelfTiming(opts);
  } catch {
    return opts.scoredCount >= 2 || opts.activeWeek >= 3;
  }
}

/** Gazette nav + archive entry points. Paper modal can still fire anytime. */
export function canShowGazetteShelf(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
  sportId?: string | null;
}): boolean {
  if (wantsFullRoom(opts.playerId)) return true;
  // Late joiners: own lock first, then pack timing
  if (!hasLockedPicksOnce(opts.playerId)) return false;
  if (!isCoreLoopUnlocked(opts.playerId)) return false;
  return (
    isWeekThreeish(opts) || hasSeenGazetteShelfReveal(opts.playerId)
  );
}

/**
 * One-time "here's where the papers live" popup.
 * After pack shelf threshold, if they haven't seen the tip yet.
 */
export function shouldShowGazetteShelfReveal(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
  sportId?: string | null;
}): boolean {
  if (wantsFullRoom(opts.playerId)) return false;
  if (!isCoreLoopUnlocked(opts.playerId)) return false;
  if (hasSeenGazetteShelfReveal(opts.playerId)) return false;
  return isWeekThreeish(opts);
}

/** News / announcements shelf — same gate as Gazette archive. */
export function canShowNewsShelf(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
}): boolean {
  return canShowGazetteShelf(opts);
}

/** Deep home tiles: stats, brackets, trophies, museum. */
export function canShowDeepHomeTiles(playerId?: string | null): boolean {
  if (wantsFullRoom(playerId)) return true;
  // Own first lock only — late joiners don't get museum/board dump pre-lock
  return hasLockedPicksOnce(playerId);
}

/** Re-export first-week helpers for one import surface. */
export {
  isFirstWeekChrome,
  isCoreLoopUnlocked,
  hasLockedPicksOnce,
  hasSeasonComeAlive,
};

type ProgressiveSnapshot = {
  playerId: string | null;
  firstWeekChrome: boolean;
  coreUnlocked: boolean;
  activeWeek: number;
  scoredCount: number;
  showGazetteShelf: boolean;
  showNewsShelf: boolean;
  showDeepTiles: boolean;
  offerGazetteReveal: boolean;
  fullRoom: boolean;
  /** Creator Eyes progressive override (internal; not a product Test Mode) */
  sandbox?: boolean;
  sandboxPhase?: string;
};

const SNAP_TTL_MS = 25_000;
let snapCache: { at: number; key: string; value: ProgressiveSnapshot } | null =
  null;
let snapInflight: Promise<ProgressiveSnapshot> | null = null;
let snapInflightKey: string | null = null;

/**
 * Async snapshot for nav / home (cloud week + local flags).
 * Cached + inflight-deduped — Nav used to call this on EVERY route change
 * and each call serial-probed week + scored list + first-week picks.
 */
export async function loadProgressiveSnapshot(
  playerId?: string | null
): Promise<ProgressiveSnapshot> {
  // Creator Eyes only — standalone Test Mode / progressive knobs retired
  try {
    const { sandboxProgressiveOverrides } = await import(
      "@/lib/creator-sandbox"
    );
    const sb = sandboxProgressiveOverrides();
    if (sb) {
      return {
        playerId: pid(playerId),
        firstWeekChrome: sb.firstWeekChrome,
        coreUnlocked: !sb.firstWeekChrome,
        activeWeek: sb.activeWeek,
        scoredCount: sb.scoredCount,
        showGazetteShelf: sb.showGazetteShelf,
        showNewsShelf: sb.showNewsShelf,
        showDeepTiles: sb.showDeepTiles,
        offerGazetteReveal: sb.offerGazetteReveal,
        fullRoom: sb.fullRoom,
        sandbox: true,
        sandboxPhase: sb.phase,
      };
    }
  } catch {
    /* ignore */
  }

  const id = pid(playerId);
  const key = id || "_anon";
  if (snapCache && snapCache.key === key && Date.now() - snapCache.at < SNAP_TTL_MS) {
    return snapCache.value;
  }
  if (snapInflight && snapInflightKey === key) return snapInflight;

  snapInflightKey = key;
  snapInflight = (async () => {
    let activeWeek = 1;
    let scoredCount = 0;
    try {
      const { loadLeagueActiveWeek, listScoredWeekNumbers } = await import(
        "@/lib/cloud"
      );
      const { syncFirstWeekFromCloud } = await import("@/lib/first-week");
      // Parallel: first-week probe + week numbers (first-week short-circuits when unlocked)
      const [, week, scored] = await Promise.all([
        syncFirstWeekFromCloud(id),
        loadLeagueActiveWeek(),
        listScoredWeekNumbers(),
      ]);
      activeWeek = week;
      scoredCount = scored.length;
    } catch {
      /* local flags only */
    }

    const opts = { activeWeek, scoredCount, playerId: id };
    const fullRoom = wantsFullRoom(id);

    const value: ProgressiveSnapshot = {
      playerId: id,
      firstWeekChrome: fullRoom ? false : isFirstWeekChrome(id),
      coreUnlocked: fullRoom || isCoreLoopUnlocked(id),
      activeWeek,
      scoredCount,
      showGazetteShelf: canShowGazetteShelf(opts),
      showNewsShelf: canShowNewsShelf(opts),
      showDeepTiles: canShowDeepHomeTiles(id),
      offerGazetteReveal: shouldShowGazetteShelfReveal(opts),
      fullRoom,
    };
    snapCache = { at: Date.now(), key, value };
    return value;
  })().finally(() => {
    snapInflight = null;
    snapInflightKey = null;
  });

  return snapInflight;
}

/** Drop snapshot cache (after lock / score / league switch). */
export function invalidateProgressiveSnapshot() {
  snapCache = null;
  snapInflight = null;
  snapInflightKey = null;
}
