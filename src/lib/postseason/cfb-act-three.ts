/** CFB Phase III — Bowl Mania and the separate College Football Playoff. */

export const CFB_BOWL_BOARD = {
  totalGames: 25,
  marqueeGames: 15,
  sickoGames: 10,
  bankroll: 100,
  cfpTeams2026: 12,
  cfpGames2026: 11,
  cfpReseeding: false,
} as const;

export type CfbBowlTier = "marquee" | "sicko";

export type CfbBowlCandidate = {
  id: string;
  name: string;
  tier: CfbBowlTier;
  /** Lower rank is preferred inside its tier. */
  rank: number;
  /** True when this bowl is hosting a CFP quarterfinal or semifinal this season. */
  hostsCfpGame: boolean;
};

export type CfbBowlBoardGame = Omit<CfbBowlCandidate, "hostsCfpGame">;

export type CfbBowlBoard = {
  games: CfbBowlBoardGame[];
  marquee: CfbBowlBoardGame[];
  sicko: CfbBowlBoardGame[];
};

/**
 * Annual selection rule from the Bowl Mania design:
 * 15 best non-CFP bowls + 10 intentional Sicko bowls. A bowl hosting a CFP
 * game is automatically ineligible and the next ranked non-CFP bowl replaces it.
 */
export function buildCfbBowlBoard(candidates: readonly CfbBowlCandidate[]): CfbBowlBoard {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id.trim() || !candidate.name.trim()) throw new Error("Every bowl needs an id and name.");
    if (ids.has(candidate.id)) throw new Error(`Duplicate bowl id: ${candidate.id}`);
    if (!Number.isInteger(candidate.rank) || candidate.rank < 1) throw new Error(`Invalid bowl rank: ${candidate.id}`);
    ids.add(candidate.id);
  }

  const select = (tier: CfbBowlTier, count: number) =>
    candidates
      .filter((game) => game.tier === tier && !game.hostsCfpGame)
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .slice(0, count)
      .map(({ hostsCfpGame: _hostsCfpGame, ...game }) => game);

  const marquee = select("marquee", CFB_BOWL_BOARD.marqueeGames);
  const sicko = select("sicko", CFB_BOWL_BOARD.sickoGames);
  if (marquee.length !== CFB_BOWL_BOARD.marqueeGames) {
    throw new Error(`Bowl Board needs ${CFB_BOWL_BOARD.marqueeGames} eligible Marquee bowls.`);
  }
  if (sicko.length !== CFB_BOWL_BOARD.sickoGames) {
    throw new Error(`Bowl Board needs ${CFB_BOWL_BOARD.sickoGames} eligible Sicko bowls.`);
  }
  return { games: [...marquee, ...sicko], marquee, sicko };
}

export type CfbBowlAllocation = Record<string, number>;

/**
 * Players must put a positive whole-number wager on every selected bowl and
 * allocate exactly 100 total. Payout/scoring is intentionally a separate rule.
 */
export function validateCfbBowlAllocation(
  board: CfbBowlBoard,
  allocation: CfbBowlAllocation
): string[] {
  const errors: string[] = [];
  const eligibleIds = new Set(board.games.map((game) => game.id));
  const allocationIds = Object.keys(allocation);
  const unknown = allocationIds.filter((id) => !eligibleIds.has(id));
  if (unknown.length) errors.push(`Unknown Bowl Board games: ${unknown.join(", ")}.`);

  for (const game of board.games) {
    const wager = allocation[game.id];
    if (!Number.isInteger(wager) || wager < 1) {
      errors.push(`${game.name} needs a positive whole-number wager.`);
    }
  }
  const total = board.games.reduce((sum, game) => {
    const wager = allocation[game.id];
    return sum + (Number.isFinite(wager) ? wager : 0);
  }, 0);
  if (total !== CFB_BOWL_BOARD.bankroll) {
    errors.push(`Allocate exactly ${CFB_BOWL_BOARD.bankroll} points; current total is ${total}.`);
  }
  return errors;
}

/** Certified Sicko standings may consume only the ten designated Sicko games. */
export function cfbSickoGameIds(board: CfbBowlBoard): string[] {
  return board.sicko.map((game) => game.id);
}
