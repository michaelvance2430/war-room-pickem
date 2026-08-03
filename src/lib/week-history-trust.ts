/**
 * Trust gate for week browsers / scored chips.
 * Constitution: War Room never invents or implies history that hasn't happened.
 *
 * Phantom pattern we kill: Week 0 live + "Week 5 · scored" with no weeks 0–4 scored.
 * That is residue (Foundry, sandbox, empty week_results shells) — not a season.
 */

import { firstSeasonWeek, seasonMaxWeek } from "@/lib/season-calendar";

/** Never surface practice week as league history */
export const PRACTICE_WEEK_INDEX = 99;

/**
 * Official scored weeks only:
 * - Must appear in published cards for this league (when published list known)
 * - Must form a contiguous chain from the first published week of the season
 * - Never week 99 / NaN / out of range
 *
 * Orphan "Week 5 scored" with no prior chain → stripped.
 */
export function trustOfficialScoredWeeks(
  scored: number[],
  published: number[] | null | undefined,
  sportId?: string | null
): number[] {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);

  const scoredClean = [
    ...new Set(
      (scored || [])
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

  if (scoredClean.length === 0) return [];

  const pubRaw = (published || [])
    .map((n) => Number(n))
    .filter(
      (n) =>
        Number.isFinite(n) &&
        n !== PRACTICE_WEEK_INDEX &&
        n >= first &&
        n <= max
    );
  const pubSorted = [...new Set(pubRaw)].sort((a, b) => a - b);

  // No published cards → cannot claim official scored history
  if (pubSorted.length === 0) return [];

  const scoredSet = new Set(scoredClean);
  const trusted: number[] = [];

  // Walk published season in order. Score only counts on a continuous prefix.
  for (const w of pubSorted) {
    if (scoredSet.has(w)) {
      trusted.push(w);
    } else {
      // First unscored published week ends the official scored prefix.
      // Later orphan scores (Foundry week 5 while week 0 still open) are dropped.
      break;
    }
  }

  return trusted;
}

/**
 * Weeks the Jump-to-week / Board chips may show.
 * Published cards + trusted scored + live active only. No practice, no phantoms.
 */
export function trustWeekBrowserWeeks(opts: {
  published: number[];
  scored: number[];
  activeWeek: number;
  sportId?: string | null;
}): number[] {
  const first = firstSeasonWeek(opts.sportId);
  const max = seasonMaxWeek(opts.sportId);
  const trustedScored = trustOfficialScoredWeeks(
    opts.scored,
    opts.published,
    opts.sportId
  );

  const clean = (n: number) =>
    Number.isFinite(n) &&
    n !== PRACTICE_WEEK_INDEX &&
    n >= first &&
    n <= max;

  const active = clean(opts.activeWeek) ? opts.activeWeek : first;

  return [
    ...new Set(
      [
        ...opts.published.filter(clean),
        ...trustedScored,
        active,
      ].filter(clean)
    ),
  ].sort((a, b) => a - b);
}
