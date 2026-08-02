/**
 * Resolve which week players should live on after scoring.
 * If the league's active week is already scored, advance to the next slot.
 */

import {
  loadLeagueActiveWeek,
  listScoredWeekNumbers,
  setLeagueActiveWeek,
} from "@/lib/cloud";
import {
  firstSeasonWeek,
  seasonMaxWeek,
  weekTitle,
} from "@/lib/season-calendar";
import { getLeague, isOps } from "@/lib/league";

function activeSportId(): string | null {
  try {
    return getLeague()?.sportId || null;
  } catch {
    return null;
  }
}

/** Pill label e.g. "Week 3 / 22" (NFL) or "Week 0 / 18" (CFB). */
export function weekProgressLabel(
  week: number,
  sportId?: string | null
): string {
  const sid = sportId ?? activeSportId();
  const max = seasonMaxWeek(sid);
  const first = firstSeasonWeek(sid);
  // NFL has no week 0 — show Preseason when stale 0 is stored
  if (sid === "nfl" && week <= 0) {
    return `Preseason · / ${max}`;
  }
  const w = Math.max(first, Math.min(max, week));
  return `${weekTitle(w, sid)} · ${w} / ${max}`;
}

/**
 * If `active` is already scored, return the first unscored week at or after active+1
 * (capped at season max). Otherwise return active.
 */
export function advancePastScoredWeeks(
  active: number,
  scored: number[],
  sportId?: string | null
): number {
  const sid = sportId ?? activeSportId();
  const max = seasonMaxWeek(sid);
  const first = firstSeasonWeek(sid);
  const scoredSet = new Set(scored);
  let w = Math.max(first, active);
  if (sid === "nfl" && active <= 0) w = first;
  for (let i = 0; i <= max + 1; i++) {
    if (!scoredSet.has(w) || w >= max) break;
    w = Math.min(max, w + 1);
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
  const sid = activeSportId();
  const first = firstSeasonWeek(sid);

  try {
    const { isEyesLocalPlayActive } = await import("./creator-eyes");
    if (isEyesLocalPlayActive()) {
      const leagueWeek = await loadLeagueActiveWeek();
      return {
        week: leagueWeek,
        leagueWeek,
        advanced: false,
        scored: [],
      };
    }
  } catch {
    /* continue */
  }

  // Parallel — was serial week-then-scored (extra RTT on every Home open)
  const [leagueWeekRaw, scoredRaw] = await Promise.all([
    loadLeagueActiveWeek(),
    listScoredWeekNumbers().catch(() => [] as number[]),
  ]);
  let leagueWeek = leagueWeekRaw;
  // NFL: never treat week 0 as real open week
  if (sid === "nfl" && leagueWeek <= 0) leagueWeek = first;
  const scored = scoredRaw;
  const week = advancePastScoredWeeks(leagueWeek, scored, sid);
  const advanced = week !== leagueWeek;

  if (advanced) {
    try {
      localStorage.setItem("warroom-active-week", String(week));
    } catch {
      /* ignore */
    }
    // Never await cloud write on the picks hot path — freezes mobile open
    if (opts?.persistIfOps && isOps()) {
      void setLeagueActiveWeek(week).catch(() => {});
    }
  }

  return { week, leagueWeek, advanced, scored };
}

/** After Commish scores week N, move league to N+1 when possible. */
export async function advanceLeagueAfterScore(
  scoredWeek: number
): Promise<{ ok: boolean; next?: number; error?: string }> {
  const max = seasonMaxWeek(activeSportId());
  const next = scoredWeek + 1;
  if (next > max) {
    return { ok: true, next: scoredWeek };
  }
  const res = await setLeagueActiveWeek(next);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, next };
}
