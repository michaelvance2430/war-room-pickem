import { Player } from "./types";
import {
  comparePlayers,
  comparePlayersToilet,
  applyMatchupScores,
} from "./tiebreakers";

export type { } from "./tiebreakers";
export {
  comparePlayers as compareForSeed,
  comparePlayersToilet as compareForToiletSeed,
  headToHead,
  resolveMatchupWinner,
  applyMatchupScores,
  TIEBREAKER_CHAIN,
} from "./tiebreakers";

export interface BracketSlot {
  seed: number | null;
  player: Player | null;
  isBye: boolean;
}

export interface Matchup {
  id: string;
  round: number;
  position: number;
  slotA: BracketSlot;
  slotB: BracketSlot;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  advanceReason?: string | null;
}

export interface Bracket {
  type: "championship" | "toilet";
  rounds: Matchup[][];
  players: Player[];
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function seedChampionship(allPlayers: Player[]): Player[] {
  const sorted = [...allPlayers].sort(comparePlayers);
  const half = Math.max(4, Math.ceil(sorted.length / 2));
  const survivors = sorted.slice(0, half);

  const divs = ["North", "South", "East", "West"] as const;
  const winners: Player[] = [];
  for (const d of divs) {
    const inDiv = survivors
      .filter((p) => p.division === d)
      .sort(comparePlayers);
    if (inDiv[0]) winners.push(inDiv[0]);
  }
  winners.sort(comparePlayers);

  const winnerIds = new Set(winners.map((w) => w.id));
  const rest = survivors
    .filter((p) => !winnerIds.has(p.id))
    .sort(comparePlayers);

  return [...winners, ...rest];
}

export function seedToiletBowl(allPlayers: Player[]): Player[] {
  const sorted = [...allPlayers].sort(comparePlayersToilet);
  const half = Math.max(4, Math.ceil(sorted.length / 2));
  return sorted.slice(0, half);
}

export function buildBracket(
  type: "championship" | "toilet",
  seeded: Player[]
): Bracket {
  const n = seeded.length;
  const size = nextPow2(n);

  const slots: BracketSlot[] = [];
  for (let i = 0; i < size; i++) {
    slots.push({ seed: null, player: null, isBye: false });
  }

  const positions = getSeedPositions(size);

  for (let seed = 1; seed <= size; seed++) {
    const pos = positions[seed - 1];
    if (seed <= n) {
      slots[pos] = { seed, player: seeded[seed - 1], isBye: false };
    } else {
      slots[pos] = { seed: null, player: null, isBye: true };
    }
  }

  const rounds: Matchup[][] = [];
  const round1: Matchup[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    let winnerId: string | null = null;
    let advanceReason: string | null = null;
    if (a.isBye && b.player) {
      winnerId = b.player.id;
      advanceReason = "bye";
    }
    if (b.isBye && a.player) {
      winnerId = a.player.id;
      advanceReason = "bye";
    }

    round1.push({
      id: `r1-m${i / 2}`,
      round: 1,
      position: i / 2,
      slotA: a,
      slotB: b,
      winnerId,
      scoreA: null,
      scoreB: null,
      advanceReason,
    });
  }
  rounds.push(round1);

  let matchCount = size / 4;
  let roundNum = 2;
  while (matchCount >= 1) {
    const round: Matchup[] = [];
    for (let i = 0; i < matchCount; i++) {
      round.push({
        id: `r${roundNum}-m${i}`,
        round: roundNum,
        position: i,
        slotA: { seed: null, player: null, isBye: false },
        slotB: { seed: null, player: null, isBye: false },
        winnerId: null,
        scoreA: null,
        scoreB: null,
        advanceReason: null,
      });
    }
    rounds.push(round);
    matchCount /= 2;
    roundNum++;
  }

  if (rounds.length > 1) {
    for (const m of rounds[0]) {
      if (m.winnerId) {
        const nextPos = Math.floor(m.position / 2);
        const nextMatch = rounds[1][nextPos];
        const isA = m.position % 2 === 0;
        const winnerPlayer =
          m.slotA.player?.id === m.winnerId ? m.slotA.player : m.slotB.player;
        const winnerSeed =
          m.slotA.player?.id === m.winnerId ? m.slotA.seed : m.slotB.seed;
        if (isA) {
          nextMatch.slotA = { seed: winnerSeed, player: winnerPlayer, isBye: false };
        } else {
          nextMatch.slotB = { seed: winnerSeed, player: winnerPlayer, isBye: false };
        }
      }
    }
  }

  return { type, rounds, players: seeded };
}

/**
 * Score a matchup and determine winner (uses tiebreakers on equal scores).
 */
export function scoreMatchup(
  match: Matchup,
  scoreA: number,
  scoreB: number
): Matchup {
  const result = applyMatchupScores(
    match.slotA.player,
    match.slotB.player,
    scoreA,
    scoreB
  );
  return {
    ...match,
    scoreA,
    scoreB,
    winnerId: result.winnerId,
    advanceReason: result.reason,
  };
}

function getSeedPositions(size: number): number[] {
  if (size === 2) return [0, 1];
  if (size === 4) return [0, 3, 2, 1];
  if (size === 8) return [0, 7, 4, 3, 2, 5, 6, 1];
  if (size === 16)
    return [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
  return Array.from({ length: size }, (_, i) => i);
}

export function roundLabel(roundIndex: number, totalRounds: number): string {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}
