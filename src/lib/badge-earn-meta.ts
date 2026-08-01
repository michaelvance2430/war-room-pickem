/**
 * When a cheevo was first earned — season year + week for Status UI.
 * Stamped once (first time we see it earned); survives reloads.
 */

import { defaultSeasonYear } from "./trophies";
import { isSandboxMode, isSandboxProtectedBadge } from "./season-mode";

const KEY = "warroom-badge-earn-meta-v1";

export type BadgeEarnMeta = {
  seasonYear: number;
  /** League week number when first detected earned (0–18). Null if unknown. */
  week: number | null;
  /** ISO when first stamped */
  at: string;
  /** League where first earned — used for early-leave forfeit */
  leagueId?: string | null;
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
 * No-op in sandbox for non-protected badges (trial cheevos never stick).
 * Returns the meta (existing or new).
 */
export function stampBadgeEarn(
  playerId: string,
  badgeId: string,
  opts?: { seasonYear?: number; week?: number | null; leagueId?: string | null }
): BadgeEarnMeta | null {
  if (!playerId || !badgeId || !canUse()) return null;
  // Practice season: never stamp fake unlocks
  if (isSandboxMode() && !isSandboxProtectedBadge(badgeId)) {
    return null;
  }
  const existing = getBadgeEarnMeta(playerId, badgeId);
  if (existing) return existing;

  const ctx = resolveEarnContext();
  let leagueId = opts?.leagueId ?? null;
  if (!leagueId) {
    try {
      const { activeLeagueIdForEarn } =
        require("./league-earned-ledger") as typeof import("./league-earned-ledger");
      leagueId = activeLeagueIdForEarn();
    } catch {
      leagueId = null;
    }
  }

  const meta: BadgeEarnMeta = {
    seasonYear:
      typeof opts?.seasonYear === "number" ? opts.seasonYear : ctx.seasonYear,
    week:
      opts && "week" in opts
        ? opts.week ?? null
        : ctx.week,
    at: new Date().toISOString(),
    leagueId: leagueId || null,
  };

  const all = readAll();
  if (!all[playerId]) all[playerId] = {};
  all[playerId][badgeId] = meta;
  writeAll(all);

  // Ledger for early-leave forfeit
  if (leagueId) {
    try {
      const { recordLeagueEarnedBadge } =
        require("./league-earned-ledger") as typeof import("./league-earned-ledger");
      recordLeagueEarnedBadge(playerId, leagueId, badgeId);
    } catch {
      /* ignore */
    }
  }

  return meta;
}

/** All earn stamps for a player (badgeId → meta). */
export function listBadgeEarnMetaForPlayer(
  playerId: string
): Record<string, BadgeEarnMeta> {
  if (!playerId) return {};
  return { ...(readAll()[playerId] || {}) };
}

/** Drop earn stamps for specific badge ids. */
export function clearBadgeEarnMetaForIds(
  playerId: string,
  badgeIds: string[]
): number {
  if (!playerId || !badgeIds?.length || !canUse()) return 0;
  const all = readAll();
  const row = all[playerId];
  if (!row) return 0;
  let removed = 0;
  for (const id of badgeIds) {
    if (row[id]) {
      delete row[id];
      removed += 1;
    }
  }
  if (Object.keys(row).length) all[playerId] = row;
  else delete all[playerId];
  writeAll(all);
  return removed;
}

/** Drop trial-run earn stamps (keep creator / prior-season protected only). */
export function clearSandboxBadgeEarnMeta(playerId?: string): number {
  if (!canUse()) return 0;
  const all = readAll();
  let removed = 0;
  const ids = playerId ? [playerId] : Object.keys(all);
  for (const pid of ids) {
    const row = all[pid];
    if (!row) continue;
    const next: Record<string, BadgeEarnMeta> = {};
    for (const [bid, meta] of Object.entries(row)) {
      if (isSandboxProtectedBadge(bid)) {
        next[bid] = meta;
      } else {
        removed += 1;
      }
    }
    if (Object.keys(next).length) all[pid] = next;
    else delete all[pid];
  }
  writeAll(all);
  return removed;
}

/** Status line: "Earned · 2026 · Week 3" */
export function formatBadgeEarnedStatus(meta: BadgeEarnMeta | null | undefined): string {
  if (!meta?.seasonYear) return "Earned";
  if (meta.week != null && meta.week >= 0) {
    return `Earned · ${meta.seasonYear} · Week ${meta.week}`;
  }
  return `Earned · ${meta.seasonYear}`;
}
