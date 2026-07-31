/**
 * League commissioner tenure — "Elite Commish" badge.
 * Counts weeks you held the gavel for a league (not game creator).
 * Target: 14 of 18 season weeks in a single league run.
 */

import { defaultSeasonYear } from "./trophies";
import { getSession } from "./league";
import { grantPermanentBadgeId } from "./permanent-badges";

export const IRON_COMMISH_BADGE_ID = "elite_commish";
export const IRON_COMMISH_TARGET = 14;
/** Full War Room calendar length (weeks 0–18 inclusive is 19 slots; we count unique weeks 1–18 + 0). */
export const IRON_COMMISH_SEASON_WEEKS = 18;

const KEY = "warroom-commish-tenure-v1";
const ACTIVE_WEEK_KEY = "warroom-active-week";

type TenureMap = Record<
  string,
  {
    /** `${leagueId}:${seasonYear}` → unique week numbers run as commissioner */
    runs: Record<string, number[]>;
  }
>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): TenureMap {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TenureMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: TenureMap) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function runKey(leagueId: string, seasonYear: number) {
  return `${leagueId}:${seasonYear}`;
}

/** Best week-count as commissioner in any single league season. */
export function getBestCommishWeeks(userId: string): number {
  if (!userId) return 0;
  const row = readAll()[userId];
  if (!row?.runs) return 0;
  let best = 0;
  for (const weeks of Object.values(row.runs)) {
    best = Math.max(best, weeks?.length || 0);
  }
  return best;
}

/**
 * How many distinct league-seasons this user ran as commissioner for ≥14 weeks.
 * Each run key is `${leagueId}:${seasonYear}`. Scales the commissioner ladder.
 */
export function getQualifyingCommishSeasons(userId: string): number {
  if (!userId) return 0;
  const row = readAll()[userId];
  if (!row?.runs) return 0;
  let n = 0;
  for (const weeks of Object.values(row.runs)) {
    if ((weeks?.length || 0) >= IRON_COMMISH_TARGET) n += 1;
  }
  return n;
}

/** All run snapshots for profile UI */
export function listCommishRuns(userId: string): {
  runKey: string;
  weekCount: number;
  qualifies: boolean;
}[] {
  if (!userId) return [];
  const row = readAll()[userId];
  if (!row?.runs) return [];
  return Object.entries(row.runs)
    .map(([runKey, weeks]) => ({
      runKey,
      weekCount: weeks?.length || 0,
      qualifies: (weeks?.length || 0) >= IRON_COMMISH_TARGET,
    }))
    .sort((a, b) => b.weekCount - a.weekCount);
}

/**
 * Credit one week as commissioner for this league/season.
 * Returns best week count across all runs for this user.
 */
export function recordCommissionerWeek(opts: {
  userId: string;
  leagueId: string;
  weekNumber: number;
  seasonYear?: number;
}): number {
  const { userId, leagueId } = opts;
  if (!userId || !leagueId) return 0;

  const week = Math.floor(opts.weekNumber);
  // Allow week 0 (openers) through 18
  if (!Number.isFinite(week) || week < 0 || week > IRON_COMMISH_SEASON_WEEKS) {
    return getBestCommishWeeks(userId);
  }

  const year = opts.seasonYear ?? defaultSeasonYear();
  const map = readAll();
  const row = map[userId] || { runs: {} };
  const key = runKey(leagueId, year);
  const existing = new Set(row.runs[key] || []);
  existing.add(week);
  row.runs[key] = Array.from(existing).sort((a, b) => a - b);
  map[userId] = row;
  writeAll(map);

  const best = getBestCommishWeeks(userId);
  if (best >= IRON_COMMISH_TARGET) {
    // grantPermanentBadgeId is a no-op in sandbox for non-protected badges
    grantPermanentBadgeId(userId, IRON_COMMISH_BADGE_ID);
  }
  try {
    // Scale ladder: 1 → 10 qualifying seasons (Assistant to the Regional Manager)
    const { syncCommishLadderGrants } = require("./commish-ladder") as typeof import("./commish-ladder");
    syncCommishLadderGrants(userId);
  } catch {
    /* ignore */
  }
  return best;
}

function readActiveWeek(): number {
  if (!canUseStorage()) return 1;
  try {
    const saved = localStorage.getItem(ACTIVE_WEEK_KEY);
    if (saved == null || saved === "") return 1;
    const n = Number(saved);
    return Number.isFinite(n) ? n : 1;
  } catch {
    return 1;
  }
}

/**
 * If the signed-in user is league commissioner, credit the current active week.
 * Call from profile / badge eval / commissioner tools.
 */
export function syncCommissionerTenureFromSession(): number {
  const session = getSession();
  if (!session?.playerId || !session.leagueId || !session.isCommissioner) {
    return session?.playerId ? getBestCommishWeeks(session.playerId) : 0;
  }
  return recordCommissionerWeek({
    userId: session.playerId,
    leagueId: session.leagueId,
    weekNumber: readActiveWeek(),
  });
}

/** Clear tenure rows for one league (all seasons) — sandbox season reset. */
export function clearCommishTenureForLeague(leagueId: string): void {
  if (!leagueId) return;
  const map = readAll();
  let changed = false;
  for (const userId of Object.keys(map)) {
    const row = map[userId];
    if (!row?.runs) continue;
    const next: Record<string, number[]> = {};
    for (const [k, weeks] of Object.entries(row.runs)) {
      if (k.startsWith(`${leagueId}:`)) {
        changed = true;
        continue;
      }
      next[k] = weeks;
    }
    map[userId] = { runs: next };
  }
  if (changed) writeAll(map);
}
