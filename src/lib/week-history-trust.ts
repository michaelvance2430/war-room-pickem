/**
 * Trust gate for week browsers / scored chips / published inventory.
 * Constitution: War Room never invents or implies history that hasn't happened.
 *
 * Phantom patterns (all real in production):
 * - Week 0 live + "Week 5 · scored" with no 0–4 scored (Foundry residue)
 * - Week 0 live + chips 0,1 (contiguous week_cards for Week 1 that is NOT live yet)
 * - Week 0 live + chips 0,1,5,6,7 (orphan islands after a gap)
 *
 * PLAYER WEEK SELECTOR RULE (Picks bar):
 *   Show only:
 *     • trusted live/current week (if a real card exists)
 *     • prior legitimate published weeks (contiguous history behind live)
 *   Never show:
 *     • weeks > activeWeek (future — even if week_cards rows exist)
 *     • currentWeek + 1 anticipation
 *     • non-contiguous orphan / Foundry residue islands
 *
 * Do not silently delete week_cards. Filter player-facing inventory instead.
 * Use findOrphanPublishedWeeks / week-inventory-audit to report residue.
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

function clampLiveWeek(
  activeWeek: number,
  sportId?: string | null
): number {
  const first = firstSeasonWeek(sportId);
  const max = seasonMaxWeek(sportId);
  let live = Number(activeWeek);
  if (!Number.isFinite(live) || live === PRACTICE_WEEK_INDEX) live = first;
  return Math.max(first, Math.min(max, live));
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
 * Contiguous published history at-or-before the official live week.
 *
 * PRODUCT RULE (P0): Never show a week ahead of trusted live.
 *   live=0 + week_cards [0,1,5] → player sees [0] only
 *   live=1 + week_cards [0,1]   → player sees [0,1]
 *   live=0 + week_cards [1,5]   → [] (nothing at-or-before live with a card
 *                                    on a contiguous walk from live)
 *
 * Walks BACKWARD from live only. Forward walk was the Week 1 ghost bug:
 * residue week_cards for week 1 while live is still 0 looked "contiguous"
 * and became a pill.
 */
export function trustContiguousPublishedAroundLive(
  published: number[],
  activeWeek: number,
  sportId?: string | null
): number[] {
  const first = firstSeasonWeek(sportId);
  const set = new Set(cleanWeekList(published, sportId));
  const live = clampLiveWeek(activeWeek, sportId);

  // Cap inventory to at-or-before live — future week_cards are not player-visible
  const atOrBefore = [...set].filter((w) => w <= live).sort((a, b) => a - b);
  if (atOrBefore.length === 0) return [];

  const out = new Set<number>();

  // Live week only if a real card exists — never invent a placeholder chip
  if (set.has(live)) out.add(live);

  // Seed: live card if present, else highest published week ≤ live
  let seed = live;
  if (!set.has(live)) {
    seed = atOrBefore[atOrBefore.length - 1]!;
    out.add(seed);
  }

  // Backward through contiguous published history only
  for (let w = seed - 1; w >= first; w--) {
    if (set.has(w)) out.add(w);
    else break;
  }

  // NO forward walk past live. Future cards (even commissioner-prebuilt) stay
  // invisible on the player bar until they become the trusted live week
  // (or fall behind it as prior history).

  return [...out].sort((a, b) => a - b);
}

/**
 * Player-facing week selector inventory (Picks bar, etc.).
 *
 * Only weeks that exist AND are ≤ trusted live week, contiguous around live.
 * Never invents activeWeek without a card. Never anticipates currentWeek+1.
 */
export function trustWeekBrowserWeeks(opts: {
  published: number[];
  scored: number[];
  activeWeek: number;
  sportId?: string | null;
}): number[] {
  const live = clampLiveWeek(opts.activeWeek, opts.sportId);
  const created = cleanWeekList(opts.published, opts.sportId);
  if (created.length === 0) return [];

  // Hard cap: future published rows never enter the player inventory
  const notFuture = created.filter((w) => w <= live);
  if (notFuture.length === 0) return [];

  return trustContiguousPublishedAroundLive(
    notFuture,
    live,
    opts.sportId
  );
}

/**
 * Report published weeks that are NOT player-visible.
 * Includes:
 *  - non-contiguous orphan islands (e.g. 5–7 while live is 0)
 *  - future week_cards ahead of live (e.g. week 1 while live is 0)
 * Foundry / audit only — never auto-delete.
 */
export function findOrphanPublishedWeeks(opts: {
  published: number[];
  activeWeek: number;
  sportId?: string | null;
}): { visible: number[]; orphans: number[]; future: number[] } {
  const live = clampLiveWeek(opts.activeWeek, opts.sportId);
  const all = cleanWeekList(opts.published, opts.sportId);
  const visible = trustContiguousPublishedAroundLive(
    opts.published,
    opts.activeWeek,
    opts.sportId
  );
  const vis = new Set(visible);
  const future = all.filter((w) => w > live);
  const orphans = all.filter((w) => !vis.has(w));
  return { visible, orphans, future };
}

/**
 * Debug / acceptance proof for Picks week bar.
 * Safe to call from client; pure function over known inputs.
 */
export function explainWeekBrowser(opts: {
  published: number[];
  scored: number[];
  activeWeek: number;
  sportId?: string | null;
}): {
  trustedActiveWeek: number;
  rawPublished: number[];
  legitimateVisible: number[];
  futureResidue: number[];
  orphanResidue: number[];
  week1Visible: boolean;
  week1Source: string;
} {
  const live = clampLiveWeek(opts.activeWeek, opts.sportId);
  const raw = cleanWeekList(opts.published, opts.sportId);
  const legitimateVisible = trustWeekBrowserWeeks(opts);
  const { orphans, future } = findOrphanPublishedWeeks({
    published: opts.published,
    activeWeek: opts.activeWeek,
    sportId: opts.sportId,
  });
  const week1InRaw = raw.includes(1);
  const week1Visible = legitimateVisible.includes(1);
  let week1Source = "not present";
  if (week1InRaw && live < 1) {
    week1Source =
      "week_cards row (or cached listPublishedWeekNumbers) ahead of live — filtered as future residue";
  } else if (week1InRaw && live >= 1) {
    week1Source =
      "legitimate: live ≥ 1 and week_cards exists for week 1";
  } else if (!week1InRaw && week1Visible) {
    week1Source = "BUG: invented without published source";
  }

  return {
    trustedActiveWeek: live,
    rawPublished: raw,
    legitimateVisible,
    futureResidue: future,
    orphanResidue: orphans,
    week1Visible,
    week1Source,
  };
}
