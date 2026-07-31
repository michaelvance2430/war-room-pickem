/**
 * When a cheevo was first earned — season year + week for Status UI.
 * Stamped once (first time we see it earned); survives reloads.
 */

import { defaultSeasonYear } from "./trophies";

const KEY = "warroom-badge-earn-meta-v1";

export type BadgeEarnMeta = {
  seasonYear: number;
  /** League week number when first detected earned (0–18). Null if unknown. */
  week: number | null;
  /** ISO when first stamped */
  at: string;
};

type Store = Record<string, Record<string, BadgeEarnMeta>>;

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

/** Best-effort current season + week from local league state. */
export function resolveEarnContext(now = new Date()): {
  seasonYear: number;
  week: number | null;
} {
  const seasonYear = defaultSeasonYear(now);
  let week: number | null = null;
  try {
    const saved = localStorage.getItem("warroom-active-week");
    if (saved != null && saved !== "") {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n) && n >= 0 && n <= 30) week = n;
    }
  } catch {
    /* ignore */
  }
  return { seasonYear, week };
}

export function getBadgeEarnMeta(
  playerId: string,
  badgeId: string
): BadgeEarnMeta | null {
  if (!playerId || !badgeId) return null;
  return readAll()[playerId]?.[badgeId] || null;
}

/**
 * Stamp first earn. Does not overwrite an existing stamp.
 * Returns the meta (existing or new).
 */
export function stampBadgeEarn(
  playerId: string,
  badgeId: string,
  opts?: { seasonYear?: number; week?: number | null }
): BadgeEarnMeta | null {
  if (!playerId || !badgeId || !canUse()) return null;
  const existing = getBadgeEarnMeta(playerId, badgeId);
  if (existing) return existing;

  const ctx = resolveEarnContext();
  const meta: BadgeEarnMeta = {
    seasonYear:
      typeof opts?.seasonYear === "number" ? opts.seasonYear : ctx.seasonYear,
    week:
      opts && "week" in opts
        ? opts.week ?? null
        : ctx.week,
    at: new Date().toISOString(),
  };

  const all = readAll();
  if (!all[playerId]) all[playerId] = {};
  all[playerId][badgeId] = meta;
  writeAll(all);
  return meta;
}

/** Status line: "Earned · 2026 · Week 3" */
export function formatBadgeEarnedStatus(meta: BadgeEarnMeta | null | undefined): string {
  if (!meta?.seasonYear) return "Earned";
  if (meta.week != null && meta.week >= 0) {
    return `Earned · ${meta.seasonYear} · Week ${meta.week}`;
  }
  return `Earned · ${meta.seasonYear}`;
}
