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

/** Season total from live badge list (may drop after season reset). */
export function seasonCheevoFromBadges(earnedOrAll: BadgeStatus[]): number {
  return earnedOrAll
    .filter((b) => b.earned)
    .reduce((sum, b) => sum + b.def.points, 0);
}

/** Ensure career is at least current season (first bank / catch-up). */
export function syncCareerWithPlayer(
  player: Player,
  badges: BadgeStatus[]
): { seasonPoints: number; careerPoints: number } {
  const seasonPoints = seasonCheevoFromBadges(badges);
  const { points: careerPoints } = bankCareerCheevos(player.id, badges);
  // Career should never be below season (same badge set at minimum)
  return {
    seasonPoints,
    careerPoints: Math.max(careerPoints, seasonPoints),
  };
}
