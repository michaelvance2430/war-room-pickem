/**
 * Trust gate for week browsers / scored chips / published inventory.
 * Constitution: War Room never invents or implies history that hasn't happened.
 *
 * PLAYER WEEK SELECTOR RULE (Picks bar) — FREEZE:
 *   Show every published week ≤ trusted live (season archive).
 *   Gaps stay visible when those weeks had real cards.
 *   Never show weeks > activeWeek (future residue).
 *   Never invent a week without a week_cards row with games.
 *
 * OFFICIAL SCORED RULE — FREEZE:
 *   Any week_results+game_results week with a published card is official.
 *   Contiguous-from-Week-0 is NOT required (that zeroed Foundry standings).
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
 * Official scored weeks (standings gate + scored chips).
 *
 * FREEZE RULE: Any week that was truly scored (week_results + game_results)
 * and has a published card is official — including mid-season Foundry sims.
 *
 * Do NOT require a contiguous scored prefix from Week 0. That hid legitimate
 * points when week 0 was published but not scored yet (Foundry post/score on
 * week N left standings empty forever).
 *
 * Still drop practice week 99 and weeks outside the sport calendar.
 * Prefer intersection with published cards when that list is available.
 */
export function trustOfficialScoredWeeks(
  scored: number[],
  published: number[] | null | undefined,
  sportId?: string | null
): number[] {
  const scoredClean = cleanWeekList(scored, sportId);
  if (scoredClean.length === 0) return [];

  const pubSorted = cleanWeekList(published, sportId);
  // No published inventory yet — still trust real scores (caller already
  // filtered empty week_results shells via game_results).
  if (pubSorted.length === 0) return scoredClean;

  const pubSet = new Set(pubSorted);
  return scoredClean.filter((w) => pubSet.has(w));
}

/**
 * Published history at-or-before the official live week.
 *
 * FREEZE RULE (season archive): every published week ≤ live stays visible,
 * even with gaps. Contiguous-only walk was hiding Week 0–11 when live was 12
 * after a gap or sparse Foundry inventory.
 *
 * PRODUCT RULE: Never show a week ahead of trusted live.
 *   live=0 + week_cards [0,1,5] → player sees [0] only (1 and 5 are future)
 *   live=12 + week_cards [0..12] → player sees [0..12]
 *   live=12 + week_cards [0,1,2,12] → player sees [0,1,2,12]
 *
 * Never invents chips without a published card.
 */
export function trustContiguousPublishedAroundLive(
  published: number[],
  activeWeek: number,
  sportId?: string | null
): number[] {
  const set = new Set(cleanWeekList(published, sportId));
  const live = clampLiveWeek(activeWeek, sportId);

  // Cap inventory to at-or-before live — future week_cards are not player-visible
  return [...set].filter((w) => w <= live).sort((a, b) => a - b);
}

/**
 * Player-facing week selector inventory (Picks bar, etc.).
 *
 * Season archive: every published week ≤ live, plus any scored week ≤ live
 * that still has a card in the published list. Never invents future weeks.
 * Never invents a week without a published card.
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

  // Union with scored ≤ live that still have cards (archive of finished weeks)
  const scoredClean = cleanWeekList(opts.scored, opts.sportId);
  const createdSet = new Set(notFuture);
  for (const w of scoredClean) {
    if (w <= live && createdSet.has(w)) {
      /* already in set via published */
    }
  }

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
