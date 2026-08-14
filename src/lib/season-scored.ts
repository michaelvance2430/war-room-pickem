/**
 * Authoritative season-progress gate.
 * Constitution: War Room never awards what hasn't been earned.
 * Prefer listScoredWeekNumbers over membership season fields (can be dirty/sandbox residue).
 */

export type AchievementEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

/** Rotating empty-state takes — mash for more. */
export const ACHIEVEMENT_EMPTY_TAKES: AchievementEmptyTake[] = [
  {
    emoji: "🏆",
    title: "No Crown Yet",
    body: "Week 1 decides who gets to wear it. Until then, nobody's royalty.",
  },
  {
    emoji: "😅",
    title: "Wall of Shame is still under construction.",
    body: "Somebody will earn it soon enough. Don't volunteer early.",
  },
  {
    emoji: "📊",
    title: "Standings begin after the first scored week.",
    body: "Right now everybody is undefeated. Enjoy it while it lasts.",
  },
  {
    emoji: "🐐",
    title: "No goats. No bags. No receipts.",
    body: "Crowns and shame are for real cards that got scored — not vibes.",
  },
  {
    emoji: "🔒",
    title: "Nothing earned. Nothing awarded.",
    body: "War Room never invents champions, losers, or rankings. First score flips the lights on.",
  },
  {
    emoji: "⏳",
    title: "Football hasn't kept score yet.",
    body: "When the host scores Week 1, the board, the crown, and the grief all wake up together.",
  },
  {
    emoji: "🎯",
    title: "Power rankings need power.",
    body: "Zero scored weeks means zero heaters. Go lock a card instead of refreshing for drama.",
  },
  {
    emoji: "🚽",
    title: "Toilet Bowl is closed for business.",
    body: "You can't flush what hasn't been played. Come back after the season has a villain.",
  },
];

export function achievementEmptyTakeAt(index: number): AchievementEmptyTake {
  const n = ACHIEVEMENT_EMPTY_TAKES.length;
  if (n === 0) {
    return {
      emoji: "📊",
      title: "No standings yet",
      body: "Come back after the first week is scored.",
    };
  }
  return ACHIEVEMENT_EMPTY_TAKES[((index % n) + n) % n]!;
}

/**
 * True only when the league has at least one officially scored week.
 * This is the trust gate for Crown, Shame, competitive standings, power ranks, brackets.
 *
 * Single source of truth: LeagueTruth / official week_results path.
 * Never membership placeholder points alone.
 */
export async function hasOfficialScoredWeek(): Promise<boolean> {
  try {
    const { loadLeagueTruth } = await import("./league-truth");
    const truth = await loadLeagueTruth();
    return truth.seasonHasOfficialScore;
  } catch {
    try {
      const { listScoredWeekNumbers } = await import("./cloud");
      const weeks = await listScoredWeekNumbers();
      return Array.isArray(weeks) && weeks.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Competitive achievement chrome (Crown, Shame, PTS table, power ranks).
 *
 * Production is Reality: preseason / sandbox / foundry / guest may still
 * score practice weeks for learning, but those must NOT unlock the same
 * competitive UI as the real season — that is the trust break.
 *
 * Use this for Standings hero + competitive columns.
 * Use hasOfficialScoredWeek only when you need "did any week_results exist?"
 */
export async function hasCompetitiveAchievementData(opts?: {
  /**
   * Standings QA only: an explicitly marked Foundry room may render the real
   * competitive board without granting permanent career credit.
   */
  allowFoundryDisplay?: boolean;
}): Promise<boolean> {
  try {
    const { foundryLiveScoredWeeks, isFoundryLivePagesActive } = await import("./foundry-live-adapter");
    if (isFoundryLivePagesActive()) return (foundryLiveScoredWeeks()?.length || 0) > 0;
  } catch {
    /* continue through the production trust gate */
  }
  try {
    const { resolveLeagueMode } = await import("./league-mode");
    const mode = resolveLeagueMode();
    const displayOnlyFoundry =
      opts?.allowFoundryDisplay === true && mode === "foundry";
    if (mode !== "production" && !displayOnlyFoundry) return false;
  } catch {
    /* if mode helper missing, fall through to scored-only gate */
  }
  return hasOfficialScoredWeek();
}
