/**
 * Empty Board — nothing public yet.
 * One job: reveal locked cards after kickoff. No tour, no CTAs.
 * Voice: War Room — fun, dry, a little mean. Not corporate.
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
    title: "Still classified.",
    body: "Picks stay secret until the first whistle. Come back after kickoff when the whole room gets exposed.",
  },
];

export function boardEmptyTakeAt(_index?: number): BoardEmptyTake {
  return BOARD_EMPTY_TAKES[0]!;
}
