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

/** App weeks that power bracket rounds (CFP R1 → Final). */
/** CFB / default: CFP rounds map to app weeks 15–18 */
export const CFP_BRACKET_WEEKS = [15, 16, 17, 18] as const;

/** NFL: playoff cards after full RS (official weeks 1–18) */
export const NFL_BRACKET_WEEKS = [19, 20, 21, 22] as const;

export function bracketWeeksForLeague(
  sportId?: string | null
): readonly number[] {
  try {
    if (sportId === "nfl") return NFL_BRACKET_WEEKS;
    if (sportId == null) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getLeague } = require("./league") as typeof import("./league");
      if (getLeague()?.sportId === "nfl") return NFL_BRACKET_WEEKS;
    }
  } catch {
    /* ignore */
  }
  return CFP_BRACKET_WEEKS;
}

/**
 * Which season week scores a given bracket round index.
 * CFB: Final → week 18. NFL: Final → Super Bowl week 22.
 */
export function cfpWeekForRound(
  roundIndex: number,
  totalRounds: number,
  sportId?: string | null
): number {
  const weeks = bracketWeeksForLeague(sportId);
  const n = Math.min(totalRounds, weeks.length);
  const offset = weeks.length - n;
  const idx = Math.min(offset + roundIndex, weeks.length - 1);
  return weeks[idx];
}

function normalizeWeeklyPoints(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
  }
  // Postgres / JSON sometimes returns object map {"0":1,"1":2}
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const keys = Object.keys(obj)
      .map((k) => parseInt(k, 10))
      .filter((k) => !Number.isNaN(k));
    if (!keys.length) return [];
    const max = Math.max(...keys);
    const arr = new Array(max + 1).fill(0);
    for (const k of keys) {
      const n = Number(obj[String(k)]);
      arr[k] = Number.isFinite(n) ? n : 0;
    }
    return arr;
  }
  return [];
}

function weekPoints(player: Player | null | undefined, week: number): number {
  if (!player) return 0;
  const w = normalizeWeeklyPoints(player.weeklyPoints);
  if (week < 0 || week >= w.length) return 0;
  return w[week] || 0;
}

/** True if league marked week scored OR anyone has a weekly slot at that index. */
function weekIsPlayable(
  week: number,
  scored: Set<number>,
  players: Player[]
): boolean {
  if (scored.has(week)) return true;
  return players.some((p) => {
    const w = normalizeWeeklyPoints(p.weeklyPoints);
    return w.length > week;
  });
}

function cloneBracket(bracket: Bracket): Bracket {
  return {
    type: bracket.type,
    players: bracket.players,
    rounds: bracket.rounds.map((round) =>
      round.map((m) => ({
        ...m,
        slotA: { ...m.slotA },
        slotB: { ...m.slotB },
      }))
    ),
  };
}

function playerById(
  players: Player[],
  id: string | null | undefined
): Player | null {
  if (!id) return null;
  return players.find((p) => p.id === id) || null;
}

function placeWinnerIntoNext(
  rounds: Matchup[][],
  match: Matchup,
  players: Player[]
) {
  if (!match.winnerId) return;
  // match.round is 1-based (R1 = 1) → next round array index is match.round
  const nextRoundIdx = match.round;
  if (nextRoundIdx >= rounds.length) return;

  const nextMatch = rounds[nextRoundIdx]?.[Math.floor(match.position / 2)];
  if (!nextMatch) return;

  // Prefer canonical player from roster so weeklyPoints stay attached
  const winnerPlayer =
    playerById(players, match.winnerId) ||
    (match.slotA.player?.id === match.winnerId
      ? match.slotA.player
      : match.slotB.player);
  const winnerSeed =
    match.slotA.player?.id === match.winnerId
      ? match.slotA.seed
      : match.slotB.player?.id === match.winnerId
        ? match.slotB.seed
        : null;
  const slot = {
    seed: winnerSeed,
    player: winnerPlayer,
    isBye: false,
  };
  if (match.position % 2 === 0) nextMatch.slotA = slot;
  else nextMatch.slotB = slot;
}

/**
 * Advance bracket slots using CFP weekly pick'em scores.
 * - Round 1 → week 15, QF → 16, SF → 17, Final → 18 (aligned for smaller fields)
 * - Higher weekly score advances; ties use season tiebreakers
 * - Resolves a round if week is scored OR weekly_points exist for that week
 * - 0–0 still advances via tiebreakers so the board never stays blank after a scored week
 * - Byes auto-advance
 */
export function advanceBracketFromCfpWeeks(
  bracket: Bracket,
  scoredWeeks: number[] | Set<number>,
  sportId?: string | null
): Bracket {
  const scored =
    scoredWeeks instanceof Set ? scoredWeeks : new Set(scoredWeeks);
  const out = cloneBracket(bracket);
  const totalRounds = out.rounds.length;
  const roster = out.players;

  // Clear non-R1 slots; re-fill from winners as we go
  for (let r = 1; r < totalRounds; r++) {
    for (const m of out.rounds[r]) {
      m.slotA = { seed: null, player: null, isBye: false };
      m.slotB = { seed: null, player: null, isBye: false };
      m.winnerId = null;
      m.scoreA = null;
      m.scoreB = null;
      m.advanceReason = null;
    }
  }

  // Re-hydrate R1 player refs from roster (fresh weeklyPoints)
  for (const m of out.rounds[0] || []) {
    if (m.slotA.player) {
      m.slotA.player =
        playerById(roster, m.slotA.player.id) || m.slotA.player;
    }
    if (m.slotB.player) {
      m.slotB.player =
        playerById(roster, m.slotB.player.id) || m.slotB.player;
    }
  }

  for (let r = 0; r < totalRounds; r++) {
    const week = cfpWeekForRound(r, totalRounds, sportId);
    const playable = weekIsPlayable(week, scored, roster);

    for (const m of out.rounds[r]) {
      // Refresh player objects if already filled from prior round
      if (m.slotA.player) {
        m.slotA.player =
          playerById(roster, m.slotA.player.id) || m.slotA.player;
      }
      if (m.slotB.player) {
        m.slotB.player =
          playerById(roster, m.slotB.player.id) || m.slotB.player;
      }

      if (m.slotA.isBye && m.slotB.player) {
        m.winnerId = m.slotB.player.id;
        m.advanceReason = "bye";
        m.scoreA = null;
        m.scoreB = null;
      } else if (m.slotB.isBye && m.slotA.player) {
        m.winnerId = m.slotA.player.id;
        m.advanceReason = "bye";
        m.scoreA = null;
        m.scoreB = null;
      } else if (m.slotA.player && m.slotB.player && playable) {
        const scoreA = weekPoints(m.slotA.player, week);
        const scoreB = weekPoints(m.slotB.player, week);
        const scoredMatch = scoreMatchup(m, scoreA, scoreB);
        m.scoreA = scoredMatch.scoreA;
        m.scoreB = scoredMatch.scoreB;
        m.winnerId = scoredMatch.winnerId;
        m.advanceReason = scoredMatch.advanceReason || "higher weekly score";
      }

      if (m.winnerId) {
        placeWinnerIntoNext(out.rounds, m, roster);
      }
    }
  }

  return out;
}

function getSeedPositions(size: number): number[] {
  if (size === 2) return [0, 1];
  if (size === 4) return [0, 3, 2, 1];
  if (size === 8) return [0, 7, 4, 3, 2, 5, 6, 1];
  if (size === 16)
    return [0, 15, 8, 7, 4, 11, 12, 3, 2, 13, 10, 5, 6, 9, 14, 1];
  return Array.from({ length: size }, (_, i) => i);
}

export function roundLabel(
  roundIndex: number,
  totalRounds: number,
  sportId?: string | null
): string {
  const remaining = totalRounds - roundIndex;
  let nfl = sportId === "nfl";
  if (!nfl && sportId == null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getLeague } = require("./league") as typeof import("./league");
      nfl = getLeague()?.sportId === "nfl";
    } catch {
      nfl = false;
    }
  }
  // NFL 4-round champ path: WC → Div → Conf → Super Bowl
  if (nfl && totalRounds === 4) {
    if (remaining === 1) return "Super Bowl";
    if (remaining === 2) return "Conference";
    if (remaining === 3) return "Divisional";
    return "Wild Card";
  }
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}
