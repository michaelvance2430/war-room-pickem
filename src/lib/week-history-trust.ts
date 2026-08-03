/**
 * Trust gate for week browsers / scored chips / published inventory.
 * Constitution: War Room never invents or implies history that hasn't happened.
 *
 * Phantom patterns:
 * - Week 0 live + "Week 5 · scored" with no 0–4 scored (Foundry residue)
 * - Week 0 live + chips 0,1,5,6,7 (orphan week_cards, non-contiguous)
 *
 * Do not silently delete week_cards. Filter player-facing inventory instead.
 */

import { firstSeasonWeek, seasonMaxWeek } from "@/lib/season-calendar";

/** Never surface practice week as league history */
export const PRACTICE_WEEK_INDEX = 99;

function cleanWeekList(
  weeks: number[] | null | undefined,
  sportId?: string | null
): number[] {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);
  return [
    ...new Set(
      (weeks || [])
        .map((n) => Number(n))
        .filter(
          (n) =>
            Number.isFinite(n) &&
            n !== PRACTICE_WEEK_INDEX &&
            n >= first &&
            n <= max
        )
    ),
  ].sort((a, b) => a - b);
}

/**
 * Official scored weeks only:
 * Contiguous published prefix from the start of the published season.
 * Orphan mid-season scores with gaps → stripped.
 */
export function trustOfficialScoredWeeks(
  scored: number[],
  published: number[] | null | undefined,
  sportId?: string | null
): number[] {
  const scoredClean = cleanWeekList(scored, sportId);
  if (scoredClean.length === 0) return [];

  const pubSorted = cleanWeekList(published, sportId);
  if (pubSorted.length === 0) return [];

  const scoredSet = new Set(scoredClean);
  const trusted: number[] = [];

  for (const w of pubSorted) {
    if (scoredSet.has(w)) {
      trusted.push(w);
    } else {
      // First unscored published week ends the official scored prefix.
      break;
    }
  }

  return trusted;
}

/**
 * Contiguous published run that touches the official live week.
 *
 * Walk backward and forward from `activeWeek` only while week_cards exist.
 * Stops at the first gap — so [0,1,5,6,7] with live=0 → [0,1] only.
 *
 * Does not invent weeks that aren't published (except the live week chip itself).
 */
export function trustContiguousPublishedAroundLive(
  published: number[],
  activeWeek: number,
  sportId?: string | null
): number[] {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);
  const set = new Set(cleanWeekList(published, sportId));

  let live = Number(activeWeek);
  if (!Number.isFinite(live) || live === PRACTICE_WEEK_INDEX) live = first;
  live = Math.max(first, Math.min(max, live));

  const out = new Set<number>();
  // Always show the official live week (even if card missing — waiting room)
  out.add(live);

  // Backward through contiguous published history
  for (let w = live - 1; w >= first; w--) {
    if (set.has(w)) out.add(w);
    else break;
  }

  // Forward through contiguous prepared future cards only
  for (let w = live + 1; w <= max; w++) {
    if (set.has(w)) out.add(w);
    else break;
  }

  return [...out].sort((a, b) => a - b);
}

/**
 * Player-facing week selector inventory.
 * Live + contiguous published around live + trusted scored history.
 * Never practice week. Never orphan islands (5–7 while live is 0).
 */
export function trustWeekBrowserWeeks(opts: {
  published: number[];
  scored: number[];
  activeWeek: number;
  sportId?: string | null;
}): number[] {
  const contiguousPub = trustContiguousPublishedAroundLive(
    opts.published,
    opts.activeWeek,
    opts.sportId
  );
  const trustedScored = trustOfficialScoredWeeks(
    opts.scored,
    // Score trust uses full published list so contiguous prefix is correct
    opts.published,
    opts.sportId
  );

  return [
    ...new Set([...contiguousPub, ...trustedScored]),
  ].sort((a, b) => a - b);
}

/**
 * Report non-contiguous published weeks (for Foundry / audit — not player UI).
 * Orphans = published weeks not reachable by walking from activeWeek.
 */
export function findOrphanPublishedWeeks(opts: {
  published: number[];
  activeWeek: number;
  sportId?: string | null;
}): { visible: number[]; orphans: number[] } {
  const all = cleanWeekList(opts.published, opts.sportId);
  const visible = trustContiguousPublishedAroundLive(
    opts.published,
    opts.activeWeek,
    opts.sportId
  );
  const vis = new Set(visible);
  const orphans = all.filter((w) => !vis.has(w));
  return { visible, orphans };
}
