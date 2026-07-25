import { Game, UserPick, Prop } from "./types";

export interface GameResult {
  gameId: string;
  winner: "home" | "away" | "push" | null;
}

export interface ScoredPick {
  gameId: string;
  correct: boolean;
  points: number;
  confidence: number;
  isBestBet: boolean;
  pushed: boolean;
}

export interface WeekScore {
  gameScores: ScoredPick[];
  propCorrect: boolean;
  propPoints: number;
  totalPoints: number;
  correctCount: number;
}

export function scoreWeek(
  picks: Record<string, UserPick>,
  bestBetId: string | null,
  propChoice: string | null,
  games: Game[],
  results: Record<string, GameResult>,
  prop: Prop,
  propResult: string | null
): WeekScore {
  const gameScores: ScoredPick[] = [];
  let totalPoints = 0;
  let correctCount = 0;

  for (const game of games) {
    const pick = picks[game.id];
    const result = results[game.id];

    if (!pick || !result || !result.winner) {
      gameScores.push({
        gameId: game.id,
        correct: false,
        points: 0,
        confidence: pick?.confidence ?? 0,
        isBestBet: bestBetId === game.id,
        pushed: false,
      });
      continue;
    }

    const pushed = result.winner === "push";
    const correct = !pushed && pick.pick === result.winner;
    let points = 0;

    if (correct) {
      points = pick.confidence || 0;
      if (bestBetId === game.id || pick.isBestBet) {
        points *= 2;
      }
      correctCount += 1;
    }

    totalPoints += points;

    gameScores.push({
      gameId: game.id,
      correct,
      points,
      confidence: pick.confidence || 0,
      isBestBet: !!(bestBetId === game.id || pick.isBestBet),
      pushed,
    });
  }

  const propCorrect =
    propChoice !== null && propResult !== null && propChoice === propResult;
  const propPoints = propCorrect ? prop.points : 0;
  totalPoints += propPoints;
  if (propCorrect) correctCount += 1;

  return {
    gameScores,
    propCorrect,
    propPoints,
    totalPoints,
    correctCount,
  };
}
