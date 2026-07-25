import { Player } from "./types";

/** Official tiebreaker chain labels (for UI). */
export const TIEBREAKER_CHAIN = [
  "Total points",
  "Head-to-head (weekly wins)",
  "ATS %",
  "Avg points/week",
  "Best week",
  "Current streak",
  "Best Bet %",
  "Name (A–Z)",
] as const;

function atsPct(p: Player): number {
  return p.atsTotal > 0 ? p.atsCorrect / p.atsTotal : 0;
}

function avgPoints(p: Player): number {
  const weeks = p.weeksPlayed || p.weeklyPoints.length;
  return weeks > 0 ? p.totalPoints / weeks : 0;
}

function bestWeek(p: Player): number {
  if (typeof p.bestWeek === "number" && p.bestWeek > 0) return p.bestWeek;
  if (p.weeklyPoints?.length) return Math.max(...p.weeklyPoints);
  return 0;
}

function bestBetPct(p: Player): number {
  return p.bestBetTotal > 0 ? p.bestBetHits / p.bestBetTotal : 0;
}

/**
 * Head-to-head from weekly point arrays.
 * Positive = A won more weeks than B.
 */
export function headToHead(a: Player, b: Player): number {
  const wa = a.weeklyPoints || [];
  const wb = b.weeklyPoints || [];
  const len = Math.min(wa.length, wb.length);
  if (len === 0) return 0;

  let aWins = 0;
  let bWins = 0;
  for (let i = 0; i < len; i++) {
    if (wa[i] > wb[i]) aWins++;
    else if (wb[i] > wa[i]) bWins++;
  }
  return aWins - bWins;
}

/**
 * Full ranking compare (Championship / standings).
 * Returns < 0 if A ranks above B.
 */
export function comparePlayers(a: Player, b: Player): number {
  // 1. Total points
  if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;

  // 2. Head-to-head
  const h2h = headToHead(a, b);
  if (h2h !== 0) return -h2h;

  // 3. ATS %
  const ats = atsPct(b) - atsPct(a);
  if (Math.abs(ats) > 1e-9) return ats > 0 ? 1 : -1;

  // 4. Avg points/week
  const avg = avgPoints(b) - avgPoints(a);
  if (Math.abs(avg) > 1e-9) return avg > 0 ? 1 : -1;

  // 5. Best week
  const bw = bestWeek(b) - bestWeek(a);
  if (bw !== 0) return bw;

  // 6. Streak
  if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;

  // 7. Best Bet %
  const bb = bestBetPct(b) - bestBetPct(a);
  if (Math.abs(bb) > 1e-9) return bb > 0 ? 1 : -1;

  // 8. Name
  return a.name.localeCompare(b.name);
}

/** Toilet Bowl: worst ranks first. */
export function comparePlayersToilet(a: Player, b: Player): number {
  return comparePlayers(b, a);
}

/**
 * Decide a heads-up matchup winner from weekly scores.
 * Higher score wins. On a tie, fall through the full tiebreaker chain
 * (better season rank advances — Championship style).
 */
export function resolveMatchupWinner(
  playerA: Player,
  scoreA: number,
  playerB: Player,
  scoreB: number
): { winner: Player; reason: string } {
  if (scoreA > scoreB) {
    return { winner: playerA, reason: "higher weekly score" };
  }
  if (scoreB > scoreA) {
    return { winner: playerB, reason: "higher weekly score" };
  }

  // Tied weekly score → season tiebreakers
  const cmp = comparePlayers(playerA, playerB);
  if (cmp < 0) {
    return { winner: playerA, reason: "tiebreaker (season rank)" };
  }
  if (cmp > 0) {
    return { winner: playerB, reason: "tiebreaker (season rank)" };
  }

  // Absolute deadlock — lower seed number (better seed) wins if available via name
  return { winner: playerA, reason: "tiebreaker (name)" };
}

/**
 * Apply scores to a matchup and set winnerId.
 */
export function applyMatchupScores(
  playerA: Player | null,
  playerB: Player | null,
  scoreA: number | null,
  scoreB: number | null
): { winnerId: string | null; reason: string | null } {
  if (!playerA && playerB) return { winnerId: playerB.id, reason: "bye" };
  if (playerA && !playerB) return { winnerId: playerA.id, reason: "bye" };
  if (!playerA || !playerB) return { winnerId: null, reason: null };
  if (scoreA === null || scoreB === null) return { winnerId: null, reason: null };

  const { winner, reason } = resolveMatchupWinner(playerA, scoreA, playerB, scoreB);
  return { winnerId: winner.id, reason };
}
