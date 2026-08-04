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
 * Contiguous published run around the official live week.
 *
 * PRODUCT RULE: Never show a week that hasn't been created (no week_card).
 * No ghost "Week 1" when only Week 0 exists. The season bar grows as cards exist.
 *
 * Walk backward and forward from `activeWeek` only while week_cards exist.
 * Stops at the first gap — so [0,1,5,6,7] with live=0 → [0,1] only.
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
  // Live week only if a real card exists — never a placeholder chip
  if (set.has(live)) out.add(live);

  // Prefer a seed: if live has no card yet, still show contiguous published history
  // ending at the highest published week ≤ live (season growing behind you)
  let seed = live;
  if (!set.has(live)) {
    const publishedSorted = [...set].sort((a, b) => a - b);
    const behind = publishedSorted.filter((w) => w <= live);
    if (behind.length === 0) {
      // Nothing created yet — empty bar (header still names the live week)
      return [];
    }
    seed = behind[behind.length - 1]!;
    out.add(seed);
  }

  // Backward through contiguous published history
  for (let w = seed - 1; w >= first; w--) {
    if (set.has(w)) out.add(w);
    else break;
  }

  // Forward through contiguous prepared future cards only (real cards only)
  for (let w = seed + 1; w <= max; w++) {
    if (set.has(w)) out.add(w);
    else break;
  }

  return [...out].sort((a, b) => a - b);
}

/**
 * Player-facing week selector inventory.
 *
 * PRODUCT RULE: Only weeks that exist (real created cards in `published`).
 * - No future placeholders
 * - No disabled ghost pills
 * - No inventing activeWeek without a card
 * Season bar grows as the commissioner creates weeks.
 *
 * Still strips orphan residue islands when possible (contiguous around live).
 */
export function trustWeekBrowserWeeks(opts: {
  published: number[];
  scored: number[];
  activeWeek: number;
  sportId?: string | null;
}): number[] {
  const created = cleanWeekList(opts.published, opts.sportId);
  if (created.length === 0) return [];

  // Prefer contiguous run around live so orphan high weeks don't appear early
  const contiguous = trustContiguousPublishedAroundLive(
    opts.published,
    opts.activeWeek,
    opts.sportId
  );
  // Contiguous may be empty if live has no card yet but older cards exist —
  // then show all created weeks (season history growing behind you)
  if (contiguous.length > 0) return contiguous;

  return created;
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
