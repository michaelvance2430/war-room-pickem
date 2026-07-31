/**
 * Multi-earn (stackable) cheevos — same badge can hit more than once.
 * Stores lifetime occurrence count + last season/week for Status UI.
 */

import { defaultSeasonYear } from "./trophies";

const KEY = "warroom-badge-stacks-v1";

export type BadgeStackRow = {
  /** Lifetime times earned */
  count: number;
  /** Unique event keys e.g. "2026:w3" so we don't double-count a week */
  events: string[];
  lastSeasonYear: number | null;
  lastWeek: number | null;
};

type Store = Record<string, Record<string, BadgeStackRow>>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(map: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getBadgeStack(
  playerId: string,
  badgeId: string
): BadgeStackRow {
  const row = readAll()[playerId]?.[badgeId];
  return (
    row || {
      count: 0,
      events: [],
      lastSeasonYear: null,
      lastWeek: null,
    }
  );
}

export function getBadgeStackCount(playerId: string, badgeId: string): number {
  return getBadgeStack(playerId, badgeId).count;
}

/**
 * Record one occurrence if eventKey is new.
 * eventKey e.g. `2026:w3` or `2025:championship`.
 * Returns new count (or existing if duplicate).
 */
export function recordBadgeStackEvent(
  playerId: string,
  badgeId: string,
  eventKey: string,
  opts?: { seasonYear?: number; week?: number | null }
): number {
  if (!playerId || !badgeId || !eventKey || !canUse()) return 0;
  const all = readAll();
  if (!all[playerId]) all[playerId] = {};
  const row: BadgeStackRow = all[playerId][badgeId] || {
    count: 0,
    events: [],
    lastSeasonYear: null,
    lastWeek: null,
  };
  if (row.events.includes(eventKey)) {
    return row.count;
  }
  row.events = [...row.events, eventKey].slice(-80); // cap history
  row.count = row.events.length;
  row.lastSeasonYear =
    opts?.seasonYear ?? defaultSeasonYear();
  row.lastWeek =
    opts && "week" in opts ? opts.week ?? null : null;
  all[playerId][badgeId] = row;
  writeAll(all);
  return row.count;
}

/** Celebration key for a specific stack height (re-earn popup). */
export function stackCelebrationKey(badgeId: string, count: number): string {
  return `${badgeId}#${count}`;
}
