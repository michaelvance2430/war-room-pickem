/**
 * Career sole-last-place weeks (regular season).
 * Powers stackable Bottom of the Barrel + legendary "most lasts" cheevo.
 */

import type { Player } from "./types";
import { defaultSeasonYear } from "./trophies";
import { recordBadgeStackEvent, getBadgeStackCount } from "./badge-stacks";
import { isSandboxMode } from "./season-mode";

const KEY = "warroom-last-place-career-v1";

/** Badge id for weekly sole last (stackable rare). */
export const BOTTOM_BARREL_ID = "bottom_of_the_barrel";
/** Legendary: most sole last weeks all-time in this browser's known players / league scan. */
export const CAREER_CELLAR_ID = "sad_little_brains";

type Store = Record<string, string[]>; // playerId → ["2026:w3", ...]

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

export function getCareerLastPlaceCount(playerId: string): number {
  if (!playerId) return 0;
  return (readAll()[playerId] || []).length;
}

function weeklyArr(p: Player): number[] {
  return Array.isArray(p.weeklyPoints) ? p.weeklyPoints : [];
}

/**
 * Scan league weekly scores for sole-last weeks; stamp career + stacks.
 * Call from getPlayerBadges (sync) — no-op in sandbox for permanence.
 */
export function syncCareerLastPlacesFromLeague(
  players: Player[],
  seasonYear = defaultSeasonYear()
): void {
  if (!canUse() || players.length < 2) return;
  // Still track during sandbox for UI curiosity, but stacks/career legendary
  // only sticky when not sandbox (see record below)
  const league = players.filter((p) => !p.isMock);
  if (league.length < 2) return;

  const maxLen = Math.max(0, ...league.map((p) => weeklyArr(p).length));
  if (maxLen === 0) return;

  const all = readAll();
  let dirty = false;

  for (let w = 0; w < maxLen; w++) {
    const field: { id: string; pts: number }[] = [];
    for (const p of league) {
      const arr = weeklyArr(p);
      if (w >= arr.length) continue;
      const pts = arr[w];
      if (pts == null || Number.isNaN(pts)) continue;
      field.push({ id: p.id, pts });
    }
    if (field.length < 2) continue;
    const min = Math.min(...field.map((f) => f.pts));
    const lasts = field.filter((f) => f.pts === min);
    if (lasts.length !== 1) continue; // sole last only
    const id = lasts[0].id;
    const eventKey = `${seasonYear}:w${w}`;
    const list = all[id] || [];
    if (!list.includes(eventKey)) {
      all[id] = [...list, eventKey];
      dirty = true;
    }
    // Stackable weekly cheevo (skip sticky bank in sandbox via recordBadgeStackEvent always local)
    if (!isSandboxMode()) {
      recordBadgeStackEvent(id, BOTTOM_BARREL_ID, eventKey, {
        seasonYear,
        week: w,
      });
    }
  }

  if (dirty) writeAll(all);
}

/** Who has the most career sole lasts among these players (min 3). */
export function careerLastPlaceLeader(
  players: Player[]
): { playerId: string; count: number } | null {
  let bestId: string | null = null;
  let best = 0;
  for (const p of players) {
    if (p.isMock) continue;
    const c = getCareerLastPlaceCount(p.id);
    if (c > best) {
      best = c;
      bestId = p.id;
    }
  }
  if (!bestId || best < 3) return null;
  // Unique leader only
  const ties = players.filter(
    (p) => !p.isMock && getCareerLastPlaceCount(p.id) === best
  );
  if (ties.length !== 1) return null;
  return { playerId: bestId, count: best };
}

/** Align stack count with career last-place list (repair). */
export function ensureBarrelStackFromCareer(playerId: string): number {
  const n = getCareerLastPlaceCount(playerId);
  const stacked = getBadgeStackCount(playerId, BOTTOM_BARREL_ID);
  if (n > stacked && !isSandboxMode()) {
    // Backfill missing events as opaque keys
    for (let i = stacked; i < n; i++) {
      recordBadgeStackEvent(playerId, BOTTOM_BARREL_ID, `legacy:${i}`, {
        seasonYear: defaultSeasonYear(),
        week: null,
      });
    }
  }
  return getBadgeStackCount(playerId, BOTTOM_BARREL_ID);
}

/**
 * Stackable week cheevos from live weeklyPoints:
 * perfect/max card weeks + sole weekly #1 (War Room General).
 */
export function syncStackableWeekCheevosFromLeague(
  players: Player[],
  seasonYear = defaultSeasonYear()
): void {
  if (!canUse() || isSandboxMode() || players.length < 2) return;
  const league = players.filter((p) => !p.isMock);
  if (league.length < 2) return;

  const maxLen = Math.max(0, ...league.map((p) => weeklyArr(p).length));
  for (let w = 0; w < maxLen; w++) {
    const field: { id: string; pts: number }[] = [];
    for (const p of league) {
      const arr = weeklyArr(p);
      if (w >= arr.length) continue;
      const pts = arr[w];
      if (pts == null || Number.isNaN(pts)) continue;
      field.push({ id: p.id, pts });
      if (pts >= 18) {
        const key = `${seasonYear}:w${w}`;
        recordBadgeStackEvent(p.id, "perfect_saturday", key, {
          seasonYear,
          week: w,
        });
        recordBadgeStackEvent(p.id, "max_card", key, {
          seasonYear,
          week: w,
        });
      }
    }
    if (field.length < 2) continue;
    const max = Math.max(...field.map((f) => f.pts));
    if (max <= 0) continue;
    const tops = field.filter((f) => f.pts === max);
    if (tops.length === 1) {
      recordBadgeStackEvent(tops[0].id, "war_room_general", `${seasonYear}:w${w}`, {
        seasonYear,
        week: w,
      });
    }
  }
}
