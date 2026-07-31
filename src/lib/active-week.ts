/**
 * Resolve which week players should live on after scoring.
 * If the league's active week is already scored, advance to the next slot.
 */

import {
  loadLeagueActiveWeek,
  listScoredWeekNumbers,
  setLeagueActiveWeek,
} from "@/lib/cloud";
import { SEASON_MAX_WEEK } from "@/lib/season-calendar";
import { isOps } from "@/lib/league";

export function weekProgressLabel(week: number): string {
  const w = Math.max(0, Math.min(SEASON_MAX_WEEK, week));
  return `Week ${w} / ${SEASON_MAX_WEEK}`;
}

/**
 * If `active` is already scored, return the first unscored week at or after active+1
 * (capped at SEASON_MAX_WEEK). Otherwise return active.
 */
export function advancePastScoredWeeks(
  active: number,
  scored: number[]
): number {
  const scoredSet = new Set(scored);
  let w = active;
  // Cap loops
  for (let i = 0; i <= SEASON_MAX_WEEK + 1; i++) {
    if (!scoredSet.has(w) || w >= SEASON_MAX_WEEK) break;
    w = Math.min(SEASON_MAX_WEEK, w + 1);
  }
  return w;
}

/**
 * Home / picks: land on a live week after scoring.
 * Ops may also push league.current_week forward so the whole room advances.
 */
export async function resolvePlayerActiveWeek(opts?: {
  /** If true and user is ops, write advanced week to cloud once. */
  persistIfOps?: boolean;
}): Promise<{
  week: number;
  leagueWeek: number;
  advanced: boolean;
  scored: number[];
}> {
  const leagueWeek = await loadLeagueActiveWeek();
  let scored: number[] = [];
  try {
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }
  const week = advancePastScoredWeeks(leagueWeek, scored);
  const advanced = week !== leagueWeek;

  if (advanced && opts?.persistIfOps && isOps()) {
    try {
      // setLeagueActiveWeek requires ops session — already checked
      await setLeagueActiveWeek(week);
      try {
        localStorage.setItem("warroom-active-week", String(week));
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  } else if (advanced) {
    // Local only so picks/home agree even if cloud still lags
    try {
      localStorage.setItem("warroom-active-week", String(week));
    } catch {
      /* ignore */
    }
  }

  return { week, leagueWeek, advanced, scored };
}

/** After Commish scores week N, move league to N+1 when possible. */
export async function advanceLeagueAfterScore(
  scoredWeek: number
): Promise<{ ok: boolean; next?: number; error?: string }> {
  const next = scoredWeek + 1;
  if (next > SEASON_MAX_WEEK) {
    return { ok: true, next: scoredWeek };
  }
  const res = await setLeagueActiveWeek(next);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, next };
}
