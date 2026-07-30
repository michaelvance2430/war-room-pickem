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

export function leagueFullMessage(memberCount = MAX_LEAGUE_PLAYERS): string {
  return `This league is full (${memberCount}/${MAX_LEAGUE_PLAYERS}). Championship + Toilet Bowl are built for ${MAX_LEAGUE_PLAYERS} max so both brackets finish in the CFP weeks. Ask the commissioner to open a second league or free a seat.`;
}

export function capacityLabel(memberCount: number): string {
  return `${memberCount} / ${MAX_LEAGUE_PLAYERS} players`;
}
