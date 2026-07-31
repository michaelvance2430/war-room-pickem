/**
 * Career (all-time) achievement points — survive season resets.
 * Each badge id counts once per player, ever.
 */

import { getBadgeDef } from "./badges";
import type { BadgeStatus, Player } from "./types";

const KEY = "warroom-career-cheevo-v1";

type CareerRow = {
  /** Badge ids already banked into career points */
  badgeIds: string[];
  /** Sum of those badge point values */
  points: number;
};

type CareerMap = Record<string, CareerRow>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): CareerMap {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CareerMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: CareerMap) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getCareerCheevoPoints(playerId: string): number {
  if (!playerId) return 0;
  return readAll()[playerId]?.points ?? 0;
}

export function getCareerBadgeIds(playerId: string): string[] {
  if (!playerId) return [];
  return readAll()[playerId]?.badgeIds ?? [];
}

/**
 * Bank any newly earned badges into career totals (once per badge id forever).
 * Call after computing current badge statuses.
 */
export function bankCareerCheevos(
  playerId: string,
  earnedBadges: BadgeStatus[]
): { points: number; newlyBanked: string[] } {
  if (!playerId) return { points: 0, newlyBanked: [] };

  const map = readAll();
  const row: CareerRow = map[playerId] || { badgeIds: [], points: 0 };
  const known = new Set(row.badgeIds);
  const newlyBanked: string[] = [];

  for (const b of earnedBadges) {
    if (!b.earned) continue;
    const id = b.def.id;
    if (known.has(id)) continue;
    known.add(id);
    newlyBanked.push(id);
    row.badgeIds.push(id);
    row.points += b.def.points || getBadgeDef(id)?.points || 0;
  }

  if (newlyBanked.length) {
    map[playerId] = row;
    writeAll(map);
  }

  return { points: row.points, newlyBanked };
}

/** Bank a single badge id into career (e.g. First & Final on earn). */
export function bankCareerBadgeId(
  playerId: string,
  badgeId: string,
  points?: number
): { banked: boolean; careerPoints: number } {
  if (!playerId || !badgeId) return { banked: false, careerPoints: 0 };
  const map = readAll();
  const row: CareerRow = map[playerId] || { badgeIds: [], points: 0 };
  if (row.badgeIds.includes(badgeId)) {
    return { banked: false, careerPoints: row.points };
  }
  const pts = points ?? getBadgeDef(badgeId)?.points ?? 0;
  row.badgeIds.push(badgeId);
  row.points += pts;
  map[playerId] = row;
  writeAll(map);
  return { banked: true, careerPoints: row.points };
}

/**
 * Remove a badge from career bank (e.g. First & Final forfeit with no
 * remaining clean weeks). Season totals drop automatically via live badge eval.
 */
export function unbankCareerBadgeId(
  playerId: string,
  badgeId: string,
  points?: number
): { removed: boolean; pointsRemoved: number; careerPoints: number } {
  if (!playerId || !badgeId) {
    return { removed: false, pointsRemoved: 0, careerPoints: 0 };
  }
  const map = readAll();
  const row = map[playerId];
  if (!row?.badgeIds?.includes(badgeId)) {
    return {
      removed: false,
      pointsRemoved: 0,
      careerPoints: row?.points ?? 0,
    };
  }
  const pts = points ?? getBadgeDef(badgeId)?.points ?? 0;
  row.badgeIds = row.badgeIds.filter((id) => id !== badgeId);
  row.points = Math.max(0, row.points - pts);
  map[playerId] = row;
  writeAll(map);
  return { removed: true, pointsRemoved: pts, careerPoints: row.points };
}

/**
 * Season total from live badge list (may drop after season reset).
 * Creator-only legendaries (The Commissioner) are career-only — not season race.
 */
export function seasonCheevoFromBadges(earnedOrAll: BadgeStatus[]): number {
  return earnedOrAll
    .filter((b) => b.earned && !b.def.creatorOnly)
    .reduce((sum, b) => sum + b.def.points, 0);
}

/** Ensure career is at least current season (first bank / catch-up). */
export function syncCareerWithPlayer(
  player: Player,
  badges: BadgeStatus[]
): { seasonPoints: number; careerPoints: number } {
  const seasonPoints = seasonCheevoFromBadges(badges);
  const { points: careerPoints } = bankCareerCheevos(player.id, badges);
  // Career includes creator + everything banked; never below season haul
  return {
    seasonPoints,
    careerPoints: Math.max(careerPoints, seasonPoints),
  };
}
