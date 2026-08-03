/**
 * LeagueTruthService — single authority for production-facing reality.
 *
 * North Star: War Room should never lie to the user—even with placeholder data.
 *
 * Architectural rule:
 *   Every production-facing value must be traceable back to a single
 *   authoritative source. Prefer Official Results + Trusted Live Week over
 *   membership arrays, max week_cards, or local caches.
 *
 * Trace (example: "Why does Mike have 27 points?"):
 *   Official week_results + game_results
 *     → week score applied to membership (only after score)
 *     → season total
 *     → Standings / Hero / Profile
 *
 * Do NOT invent:
 *   - standings/points/ATS/streak/rank/Crown/Shame/swing/recap from membership alone
 *   - "live week" from max(week_cards.week_number)
 *   - urgency from orphan future cards
 */

import { getLeague } from "@/lib/league";
import {
  firstSeasonWeek,
  seasonMaxWeek,
  weekWindowMs,
} from "@/lib/season-calendar";
import {
  trustContiguousPublishedAroundLive,
  trustOfficialScoredWeeks,
  trustWeekBrowserWeeks,
} from "@/lib/week-history-trust";

export type LeagueTruthSnapshot = {
  sportId: string;
  /** leagues.current_week (raw cloud / local resolve) */
  leagueWeek: number;
  /**
   * Trusted Live Week — the only week hub/picks/home should treat as "now".
   * Never max(week_cards). Never highest residue number.
   */
  trustedLiveWeek: number;
  /** Official scored weeks (trusted contiguous prefix only) */
  scoredWeeks: number[];
  /** Published week numbers (raw list; prefer visiblePublished for UI chips) */
  publishedWeeks: number[];
  /** Contiguous published around trusted live (player-facing inventory) */
  visiblePublishedWeeks: number[];
  /** Orphan published islands (Foundry/residue) — never drive urgency */
  orphanPublishedWeeks: number[];
  /** True when ≥1 official scored week exists */
  seasonHasOfficialScore: boolean;
  /** Latest officially scored week, or null */
  latestScoredWeek: number | null;
};

export type LeagueTruthOptions = {
  sportId?: string | null;
  /** Skip network and use provided arrays (tests / already-fetched) */
  prefetched?: {
    leagueWeek?: number;
    scoredWeeks?: number[];
    publishedWeeks?: number[];
  };
};

function sport(explicit?: string | null): string {
  if (explicit === "nfl" || explicit === "cfb") return explicit;
  try {
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  } catch {
    return "cfb";
  }
}

/**
 * Trusted Live Week from already-known league week + trusted scores.
 * Pure — no I/O.
 */
export function computeTrustedLiveWeek(
  leagueWeek: number,
  scoredWeeks: number[],
  sportId?: string | null
): number {
  const sid = sport(sportId);
  const first = firstSeasonWeek(sid);
  const max = seasonMaxWeek(sid);
  let w = Number(leagueWeek);
  if (!Number.isFinite(w)) w = first;
  if (sid === "nfl" && w <= 0) w = first;
  w = Math.max(first, Math.min(max, w));

  // Advance past contiguous official scores (same idea as advancePastScoredWeeks)
  const scoredSet = new Set(scoredWeeks);
  for (let i = 0; i <= max + 1; i++) {
    if (!scoredSet.has(w) || w >= max) break;
    w = Math.min(max, w + 1);
  }
  return w;
}

/**
 * Has the season produced at least one official scored week?
 * Single source: trusted scored week list — never membership points.
 */
export function seasonHasOfficialScoreFromList(scoredWeeks: number[]): boolean {
  return Array.isArray(scoredWeeks) && scoredWeeks.length > 0;
}

/**
 * Is this week officially scored? (in trusted scored list only)
 */
export function isWeekOfficiallyScored(
  weekNumber: number,
  scoredWeeks: number[]
): boolean {
  return scoredWeeks.includes(weekNumber);
}

/**
 * Has the sports calendar opened this week for configuration / play?
 * Uses season-calendar windows (ET). Not the same as "has a week_card".
 */
export function isWeekCalendarOpen(
  weekNumber: number,
  sportId?: string | null,
  nowMs = Date.now()
): boolean {
  const win = weekWindowMs(weekNumber, sport(sportId));
  if (!win) return false;
  return nowMs >= win.startMs;
}

/**
 * May production UI show competitive stats for this player row?
 * Official score exists AND this membership has weeksPlayed > 0.
 * Membership points alone are never enough.
 */
export function mayShowPlayerCompetitiveStats(opts: {
  seasonHasOfficialScore: boolean;
  weeksPlayed?: number | null;
}): boolean {
  if (!opts.seasonHasOfficialScore) return false;
  return (opts.weeksPlayed || 0) > 0;
}

/**
 * May production UI show Crown / Shame / standings ranks / swing / recaps?
 * Only after official results exist.
 */
export function mayShowSeasonCompetitiveChrome(
  seasonHasOfficialScore: boolean
): boolean {
  return seasonHasOfficialScore;
}

/**
 * Load authoritative truth for the active league (or prefetched).
 * Prefer this over ad-hoc listScored + max(week_cards) on each page.
 */
export async function loadLeagueTruth(
  opts?: LeagueTruthOptions
): Promise<LeagueTruthSnapshot> {
  const sid = sport(opts?.sportId);
  const first = firstSeasonWeek(sid);

  let leagueWeek = first;
  let scoredRaw: number[] = [];
  let publishedRaw: number[] = [];

  if (opts?.prefetched) {
    leagueWeek =
      opts.prefetched.leagueWeek != null
        ? Number(opts.prefetched.leagueWeek)
        : first;
    scoredRaw = opts.prefetched.scoredWeeks || [];
    publishedRaw = opts.prefetched.publishedWeeks || [];
  } else {
    const { loadLeagueActiveWeek, listScoredWeekNumbers, listPublishedWeekNumbers } =
      await import("@/lib/cloud");
    const [lw, scored, published] = await Promise.all([
      loadLeagueActiveWeek().catch(() => first),
      listScoredWeekNumbers().catch(() => [] as number[]),
      listPublishedWeekNumbers().catch(() => [] as number[]),
    ]);
    leagueWeek = lw;
    // listScored already applies trustOfficialScoredWeeks internally
    scoredRaw = scored;
    publishedRaw = published;
  }

  // Re-apply trust if prefetched raw lists bypass cloud helpers
  const scoredWeeks = trustOfficialScoredWeeks(
    scoredRaw,
    publishedRaw,
    sid
  );
  const trustedLiveWeek = computeTrustedLiveWeek(
    leagueWeek,
    scoredWeeks,
    sid
  );
  const visiblePublishedWeeks = trustContiguousPublishedAroundLive(
    publishedRaw,
    trustedLiveWeek,
    sid
  );
  const browserWeeks = trustWeekBrowserWeeks({
    published: publishedRaw,
    scored: scoredWeeks,
    activeWeek: trustedLiveWeek,
    sportId: sid,
  });
  const visSet = new Set(browserWeeks);
  const orphanPublishedWeeks = [
    ...new Set(publishedRaw),
  ]
    .filter((w) => Number.isFinite(w) && !visSet.has(w) && w !== 99)
    .sort((a, b) => a - b);

  const latestScoredWeek =
    scoredWeeks.length > 0
      ? scoredWeeks[scoredWeeks.length - 1]!
      : null;

  return {
    sportId: sid,
    leagueWeek,
    trustedLiveWeek,
    scoredWeeks,
    publishedWeeks: [...new Set(publishedRaw)].sort((a, b) => a - b),
    visiblePublishedWeeks,
    orphanPublishedWeeks,
    seasonHasOfficialScore: seasonHasOfficialScoreFromList(scoredWeeks),
    latestScoredWeek,
  };
}

/**
 * Convenience: Trusted Live Week only (network).
 */
export async function getTrustedLiveWeek(
  sportId?: string | null
): Promise<number> {
  const t = await loadLeagueTruth({ sportId });
  return t.trustedLiveWeek;
}
