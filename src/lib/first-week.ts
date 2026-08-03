/**
 * First-week smoothness: teach the sport before the personality layer.
 *
 * Session 1 → rules + picks coach + lock.
 * After first lock (or first scored week) → cheevo popups, deep home tiles, full vibe.
 * Chaos / stack fanfare / dense Gazette wait a bit longer.
 */

import { getSession } from "./league";

const KEY_LOCKED = "warroom-has-locked-picks-v1";
const KEY_SEASON_ALIVE = "warroom-season-alive-v1";
const EVENT_PROGRESS = "warroom-first-week-progress";

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

function notifyProgress() {
  if (typeof window === "undefined") return;
  try {
    // Drop progressive snapshot so nav re-reads first-week flags
    void import("./progressive-disclosure").then((m) => {
      m.invalidateProgressiveSnapshot?.();
    });
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_PROGRESS));
  } catch {
    /* ignore */
  }
}

export { EVENT_PROGRESS as EVENT_FIRST_WEEK_PROGRESS };

function resolvePlayerId(playerId?: string | null): string | null {
  if (playerId) return playerId;
  return getSession()?.playerId || null;
}

/** Player has successfully locked a card at least once (this browser). */
export function hasLockedPicksOnce(playerId?: string | null): boolean {
  const id = resolvePlayerId(playerId);
  if (!id) return false;
  return !!readMap(KEY_LOCKED)[id];
}

/** Call after a successful Save / lock on My Picks. */
export function markHasLockedPicksOnce(playerId?: string | null): void {
  const id = resolvePlayerId(playerId);
  if (!id || !canUse()) return;
  const map = readMap(KEY_LOCKED);
  if (map[id]) return;
  map[id] = true;
  writeMap(KEY_LOCKED, map);
  notifyProgress();
  try {
    void import("./coaching/complete").then((m) => {
      m.onPicksLocked();
    });
  } catch {
    /* ok */
  }
}

/**
 * League has produced scores (or we saw a Gazette).
 * Unlocks personality for late joiners who never locked.
 */
export function hasSeasonComeAlive(playerId?: string | null): boolean {
  const id = resolvePlayerId(playerId);
  if (!id) return false;
  return !!readMap(KEY_SEASON_ALIVE)[id];
}

export function markSeasonComeAlive(playerId?: string | null): void {
  const id = resolvePlayerId(playerId);
  if (!id || !canUse()) return;
  const map = readMap(KEY_SEASON_ALIVE);
  if (map[id]) return;
  map[id] = true;
  writeMap(KEY_SEASON_ALIVE, map);
  notifyProgress();
}

/** Once per tab session — never re-probe cloud for first-week flags. */
const firstWeekSyncedThisTab = new Set<string>();

/** Sync check: scored weeks in cloud → season is alive. */
export async function ensureSeasonAliveFromCloud(
  playerId?: string | null
): Promise<boolean> {
  // Local already knows — skip network (was hit on every route via progressive)
  if (hasSeasonComeAlive(playerId)) return true;
  try {
    const { listScoredWeekNumbers } = await import("./cloud");
    const scored = await listScoredWeekNumbers();
    if (scored.length > 0) {
      markSeasonComeAlive(playerId);
      return true;
    }
  } catch {
    /* ignore */
  }
  return hasSeasonComeAlive(playerId);
}

/**
 * Returning players: if they already locked (or season has scores), unlock chrome.
 * Call on home boot / badge celebrate.
 * Cheap after first run: local flags short-circuit all cloud probes.
 */
export async function syncFirstWeekFromCloud(
  playerId?: string | null
): Promise<void> {
  const id = resolvePlayerId(playerId);
  if (!id) return;

  // Already unlocked both ways → zero network
  if (hasLockedPicksOnce(id) && hasSeasonComeAlive(id)) {
    firstWeekSyncedThisTab.add(id);
    return;
  }
  // Once per browser tab is enough; flags live in localStorage
  if (firstWeekSyncedThisTab.has(id)) return;
  firstWeekSyncedThisTab.add(id);

  // Season alive probe only if still unknown
  if (!hasSeasonComeAlive(id)) {
    await ensureSeasonAliveFromCloud(id);
  }
  if (hasLockedPicksOnce(id)) return;

  try {
    const { loadLeagueActiveWeek, loadMyPicks, listScoredWeekNumbers } =
      await import("./cloud");
    const week = await loadLeagueActiveWeek();
    // Parallel picks peek (active + previous) instead of serial waterfall
    const [mine, prev] = await Promise.all([
      loadMyPicks(week),
      week > 0 ? loadMyPicks(week - 1) : Promise.resolve(null),
    ]);
    if (mine?.lockedAt || prev?.lockedAt) {
      markHasLockedPicksOnce(id);
      return;
    }
    if (!hasSeasonComeAlive(id)) {
      const scored = await listScoredWeekNumbers();
      if (scored.length > 0) markSeasonComeAlive(id);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Core loop done once: locked picks OR season has scores.
 * Until then: no badge popup stack, demote museum/lore/trophy tiles.
 */
export function isCoreLoopUnlocked(playerId?: string | null): boolean {
  return hasLockedPicksOnce(playerId) || hasSeasonComeAlive(playerId);
}

/**
 * Demoted chrome until THIS player locks once.
 * Late joiners on a live season still get "first hour" home/nav until they lock —
 * season-alive alone no longer opens the full room surface.
 * (Veteran "full room" override is applied in progressive-disclosure snapshot.)
 */
export function isFirstWeekChrome(playerId?: string | null): boolean {
  return !hasLockedPicksOnce(playerId);
}

/**
 * First ~10 minutes: lame and easy.
 * No ceremony / welcome / paper / lore popups until THIS player has locked once.
 * Walkthrough coach + quiet picks banner only.
 * (Season-alive late joiners still get calm until their own first lock.)
 */
export function isPreLockCalm(playerId?: string | null): boolean {
  return !hasLockedPicksOnce(playerId);
}

/** Achievement modals allowed (after first lock or first scores). */
export function canShowBadgeCelebrations(playerId?: string | null): boolean {
  return isCoreLoopUnlocked(playerId);
}

/**
 * Stackable re-earn fanfare (×2, ×3…) — mid-season energy only.
 * First earn of a stackable still celebrates when celebrations are allowed.
 */
export function canCelebrateStackMultiples(
  playerId?: string | null,
  activeWeek?: number
): boolean {
  if (!isCoreLoopUnlocked(playerId)) return false;
  if (typeof activeWeek === "number" && activeWeek >= 3) return true;
  return hasSeasonComeAlive(playerId);
}

/**
 * Chaos Mode UI: discover after week 2 (scarce mid-season spice).
 * Always show if already locked Chaos this week.
 */
export function canSurfaceChaosMode(
  activeWeek: number,
  opts?: { alreadyChaosThisWeek?: boolean }
): boolean {
  if (opts?.alreadyChaosThisWeek) return true;
  return activeWeek >= 2;
}

/**
 * Gazette flavor density.
 * Early editions = one tight page; later = weather + classifieds + sidebars.
 */
export type GazetteFlavorLevel = "slim" | "full";

export function gazetteFlavorLevel(weekIndex: number): GazetteFlavorLevel {
  // Week 0–1: meat only (crown/shame/movers). Week 2+: full paper desk.
  return weekIndex <= 1 ? "slim" : "full";
}
