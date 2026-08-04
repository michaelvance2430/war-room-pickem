/**
 * League active week — cloud is source of truth; local is scoped per league.
 *
 * Legacy unscoped key `warroom-active-week` is never written as cloud truth
 * and is ignored once a league-scoped value or cloud week is available.
 */

import {
  firstSeasonWeek,
  seasonMaxWeek,
  weekWindowMs,
} from "@/lib/season-calendar";
import type { SportId } from "@/lib/sports/types";

export const LEGACY_ACTIVE_WEEK_KEY = "warroom-active-week";

const SEASON_LABEL = "2026";

export function activeWeekStorageKey(opts: {
  userId?: string | null;
  leagueId: string;
  sportId?: string | null;
}): string {
  const uid = (opts.userId || "anon").slice(0, 64);
  const lid = opts.leagueId;
  const sport = (opts.sportId || "cfb").trim() || "cfb";
  return `warroom-active-week:${uid}:${lid}:${sport}:${SEASON_LABEL}`;
}

/**
 * Opening week for a newly created league.
 * 1) Explicit override when provided
 * 2) Late-start: current/next eligible calendar week if season already open
 * 3) firstSeasonWeek(sport) for preseason
 */
export function resolveNewLeagueOpeningWeek(
  sportId?: string | null,
  opts?: { explicitWeek?: number | null; nowMs?: number }
): number {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);
  if (
    opts?.explicitWeek != null &&
    Number.isFinite(opts.explicitWeek) &&
    opts.explicitWeek >= first &&
    opts.explicitWeek <= max
  ) {
    return Math.floor(opts.explicitWeek);
  }

  const now = opts?.nowMs ?? Date.now();
  const firstWin = weekWindowMs(first, sportId);
  // Preseason: before first kickoff window of opening week
  if (!firstWin || now < firstWin.startMs) return first;

  // Inside a week window → that week
  for (let w = first; w <= max; w++) {
    const win = weekWindowMs(w, sportId);
    if (!win) continue;
    if (now >= win.startMs && now <= win.endMs) return w;
  }

  // Between or past windows: next week after last started, else last started
  let lastStarted = first;
  for (let w = first; w <= max; w++) {
    const win = weekWindowMs(w, sportId);
    if (win && now >= win.startMs) lastStarted = w;
  }
  const lastWin = weekWindowMs(lastStarted, sportId);
  if (lastWin && now > lastWin.endMs && lastStarted < max) {
    return lastStarted + 1;
  }
  return lastStarted;
}

export function readScopedActiveWeek(opts: {
  userId?: string | null;
  leagueId: string;
  sportId?: string | null;
}): number | null {
  if (typeof window === "undefined") return null;
  try {
    const key = activeWeekStorageKey(opts);
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Write league-scoped view week only — never the legacy global key. */
export function writeScopedActiveWeek(
  week: number,
  opts: {
    userId?: string | null;
    leagueId: string;
    sportId?: string | null;
  }
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(activeWeekStorageKey(opts), String(week));
  } catch {
    /* ignore */
  }
  // Drop unscoped legacy so it cannot leak across leagues after cloud load
  try {
    localStorage.removeItem(LEGACY_ACTIVE_WEEK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Fallback only when cloud is unavailable.
 * Prefer scoped key; do not promote legacy into cloud.
 */
export function readActiveWeekFallback(opts: {
  userId?: string | null;
  leagueId?: string | null;
  sportId?: string | null;
}): number {
  const first = firstSeasonWeek(opts.sportId);
  if (opts.leagueId) {
    const scoped = readScopedActiveWeek({
      userId: opts.userId,
      leagueId: opts.leagueId,
      sportId: opts.sportId,
    });
    if (scoped != null) return clampWeek(scoped, opts.sportId);
  }
  return first;
}

export function clampWeek(
  week: number,
  sportId?: string | null
): number {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);
  let w = week;
  if (!Number.isFinite(w)) w = first;
  if ((sportId || "cfb") === "nfl" && w <= 0) w = first;
  return Math.max(first, Math.min(max, Math.floor(w)));
}

export function normalizeSportId(
  sportId?: string | null
): SportId | string {
  return (sportId || "cfb").trim() || "cfb";
}
