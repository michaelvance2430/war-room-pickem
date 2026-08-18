/**
 * Deployment Credit — conservative late-join standings credit.
 *
 * Product law:
 * - Calculate each completed week independently.
 * - Ignore bots, no-submission rows, and scores <= 0.
 * - Take the lowest ceil(15%) of qualifying human scores.
 * - Award floor(their average), then sum the already-rounded weeks.
 *
 * This module is deliberately pure so the browser, Foundry checks, and the
 * Supabase join RPC can share fixtures without granting synthetic credit any
 * achievement/weekly-result semantics.
 */

export const DEPLOYMENT_CREDIT_BOTTOM_FRACTION = 0.15;

export type DeploymentCreditPolicy =
  | "reinforcement_credit"
  | "zero_backfill"
  | "closed_roster";

export type DeploymentCreditScore = {
  score: number | null | undefined;
  isBot?: boolean | null;
  /** False means the player did not submit/lock a card. */
  submitted?: boolean | null;
};

export type DeploymentCreditWeek = {
  weekNumber: number;
  qualifyingScores: number[];
  bottomCount: number;
  bottomScores: number[];
  credit: number;
};

export type DeploymentCreditResult = {
  total: number;
  weeks: DeploymentCreditWeek[];
};

function qualifyingHumanScores(rows: readonly DeploymentCreditScore[]): number[] {
  return rows
    .filter((row) => !row.isBot && row.submitted !== false)
    .map((row) => Number(row.score))
    .filter((score) => Number.isFinite(score) && score > 0)
    .sort((a, b) => a - b);
}

/** Calculate one completed week's credit. */
export function calculateDeploymentCreditWeek(
  weekNumber: number,
  rows: readonly DeploymentCreditScore[],
  bottomFraction = DEPLOYMENT_CREDIT_BOTTOM_FRACTION
): DeploymentCreditWeek {
  const qualifyingScores = qualifyingHumanScores(rows);
  if (!qualifyingScores.length) {
    return {
      weekNumber,
      qualifyingScores,
      bottomCount: 0,
      bottomScores: [],
      credit: 0,
    };
  }

  const fraction = Math.min(1, Math.max(0, bottomFraction));
  const bottomCount = Math.max(1, Math.ceil(qualifyingScores.length * fraction));
  const bottomScores = qualifyingScores.slice(0, bottomCount);
  const average =
    bottomScores.reduce((sum, score) => sum + score, 0) / bottomScores.length;

  return {
    weekNumber,
    qualifyingScores,
    bottomCount,
    bottomScores,
    credit: Math.max(0, Math.floor(average)),
  };
}

/** Sum independently rounded credit for every completed pre-join week. */
export function calculateDeploymentCredit(
  completedWeeks: ReadonlyArray<{
    weekNumber: number;
    scores: readonly DeploymentCreditScore[];
  }>
): DeploymentCreditResult {
  const weeks = [...completedWeeks]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((week) => calculateDeploymentCreditWeek(week.weekNumber, week.scores));

  return {
    total: weeks.reduce((sum, week) => sum + week.credit, 0),
    weeks,
  };
}

