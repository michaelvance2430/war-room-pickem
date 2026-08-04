/**
 * Empty Board — nothing public yet.
 * One job: reveal locked cards after kickoff. No tour, no CTAs.
 */

export type BoardEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

/** Single quiet empty state (kept as array for any residual callers). */
export const BOARD_EMPTY_TAKES: BoardEmptyTake[] = [
  {
    emoji: "🔒",
    title: "Nothing to reveal…yet.",
    body: "Cards become public after the first kickoff. Until then, everyone's picks stay secret.",
  },
];

export function boardEmptyTakeAt(_index?: number): BoardEmptyTake {
  return BOARD_EMPTY_TAKES[0]!;
}
