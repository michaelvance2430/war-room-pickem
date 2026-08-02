/**
 * Public product default: hard league capacity.
 *
 * Why 32: 50% cut → 16-team Championship + 16-team Toilet Bowl.
 * 16-team single-elim = 4 rounds = CFP weeks 15–18. Larger fields need a
 * 5th+ round the season calendar doesn't have (and seed placement degrades).
 */
export const MAX_LEAGUE_PLAYERS = 32;

export function seatsRemaining(memberCount: number): number {
  return Math.max(0, MAX_LEAGUE_PLAYERS - memberCount);
}

export function isLeagueFull(memberCount: number): boolean {
  return memberCount >= MAX_LEAGUE_PLAYERS;
}

/**
 * Friendly “no seats” copy — playful, never mean.
 * Used when join-by-code or open-room hit capacity.
 */
export function leagueFullMessage(memberCount = MAX_LEAGUE_PLAYERS): string {
  return (
    `This room is full (${memberCount}/${MAX_LEAGUE_PLAYERS}) — every seat’s taken, ` +
    `including the good ones by the snacks. ` +
    `We cap at ${MAX_LEAGUE_PLAYERS} so Championship + Toilet Bowl both finish clean. ` +
    `Ask the commish for a second league code, free a seat, or hop into another open room.`
  );
}

/** Short toast for open-lobby when a listed room filled mid-claim */
export function leagueJustFilledMessage(): string {
  return "That room just filled up — no hard feelings. Finding the next open seat…";
}

export function capacityLabel(memberCount: number): string {
  return `${memberCount} / ${MAX_LEAGUE_PLAYERS} players`;
}
