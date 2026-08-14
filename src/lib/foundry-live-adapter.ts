import type { CloudCard, LeagueRosterMember } from "@/lib/cloud";
import type { GameResult } from "@/lib/scoring";
import type { Player, UserPick } from "@/lib/types";
import {
  FOUNDRY_WALKTHROUGH_EVENT,
  loadFoundryWalkthrough,
  saveFoundryWalkthrough,
  type FoundryWalkthrough,
} from "@/lib/foundry-walkthrough";

const ACTIVE_KEY = "warroom-foundry-live-pages-v1";

export function isFoundryLivePagesActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ACTIVE_KEY) === "1" && !!loadFoundryWalkthrough();
  } catch {
    return false;
  }
}

export function setFoundryLivePagesActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) localStorage.setItem(ACTIVE_KEY, "1");
  else localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new CustomEvent(FOUNDRY_WALKTHROUGH_EVENT));
}

function state(): FoundryWalkthrough | null {
  return isFoundryLivePagesActive() ? loadFoundryWalkthrough() : null;
}

function lineFor(game: FoundryWalkthrough["games"][number]) {
  return Number(game.spread.match(/(-?\d+(?:\.\d+)?)$/)?.[1] || 0);
}

function favoriteFor(game: FoundryWalkthrough["games"][number]) {
  return lineFor(game) <= 0 ? "home" as const : "away" as const;
}

export function foundryLiveWeek(): number | null {
  return state()?.week ?? null;
}

export function foundryLiveCard(weekNumber: number): CloudCard | null {
  const s = state();
  if (!s || weekNumber !== s.week) return null;
  return {
    weekCardId: `foundry-${s.sport}-${s.week}`,
    weekNumber: s.week,
    publishedAt: new Date(s.generatedAt).toISOString(),
    games: s.games.map((game) => {
      const favorite = favoriteFor(game);
      return {
        id: game.id,
        awayTeam: game.away,
        homeTeam: game.home,
        spread: Math.abs(lineFor(game)),
        favorite,
        startTime: new Date(game.kickoffAt).toLocaleString(),
        commenceTime: game.kickoffAt,
      };
    }),
    prop: {
      id: `foundry-prop-${s.week}`,
      question: "Will the Foundry room survive the pressure?",
      options: ["Absolutely", "Not a chance"],
      points: 3,
    },
  };
}

export function foundryLiveMyPicks(weekNumber: number): {
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
  lockedAt: string | null;
  isChaos: boolean;
} | null {
  const s = state();
  if (!s || s.week !== weekNumber) return null;
  const picks: Record<string, UserPick> = {};
  for (const game of s.games) {
    if (!game.pick) continue;
    const favorite = favoriteFor(game);
    picks[game.id] = {
      gameId: game.id,
      pick: game.pick === game.home ? "home" : "away",
      confidence: game.confidence,
      isBestBet: game.confidence === 5,
      lockedSpread: Math.abs(Number(game.spread.match(/(-?\d+(?:\.\d+)?)$/)?.[1] || 0)),
      lockedFavorite: favorite,
    };
  }
  if (!Object.keys(picks).length) return null;
  return { picks, bestBetId: Object.values(picks).find((p) => p.isBestBet)?.gameId || null, propChoice: "Absolutely", lockedAt: s.players[0]?.locked ? new Date(s.generatedAt).toISOString() : null, isChaos: false };
}

export function foundryLiveWeekResults(weekNumber: number): {
  results: Record<string, GameResult>;
  propResult: string | null;
  scoredAt: string | null;
} | null {
  const s = state();
  if (!s || s.week !== weekNumber) return null;

  const results: Record<string, GameResult> = {};
  for (const game of s.games) {
    if (game.status !== "final" || !game.result) continue;
    const scores = [...game.result.matchAll(/(\d+)/g)].map((match) => Number(match[1]));
    if (scores.length < 2) continue;
    const [awayScore, homeScore] = scores;
    const favorite = favoriteFor(game);
    const spread = Math.abs(lineFor(game));
    const awayAdjusted = awayScore + (favorite === "away" ? -spread : spread);
    const winner = awayAdjusted === homeScore
      ? "push"
      : awayAdjusted > homeScore ? "away" : "home";
    results[game.id] = { gameId: game.id, winner };
  }

  if (!Object.keys(results).length) return null;
  return {
    results,
    propResult: "Absolutely",
    scoredAt: new Date(s.generatedAt).toISOString(),
  };
}

export function saveFoundryLivePicks(weekNumber: number, picks: Record<string, UserPick>): boolean {
  const s = state();
  if (!s || s.week !== weekNumber) return false;
  const games = s.games.map((game) => {
    const pick = picks[game.id];
    if (!pick) return game;
    return { ...game, pick: pick.pick === "home" ? game.home : game.away, confidence: pick.confidence };
  });
  const players = s.players.map((player, index) => index === 0 ? { ...player, locked: true } : player);
  saveFoundryWalkthrough({ ...s, games, players, generatedAt: Date.now() });
  return true;
}

export function foundryLivePlayers(): Player[] | null {
  const s = state();
  if (!s) return null;
  return s.players.map((p, index) => ({
    id: p.id,
    name: p.name,
    division: (["North", "South", "East", "West"] as const)[index % 4],
    totalPoints: p.points,
    weeklyPoints: Array.from({ length: Math.max(1, s.week + 1) }, (_, week) => week === s.week ? p.weekPoints : Math.max(0, Math.round((p.points - p.weekPoints) / Math.max(1, s.week)))),
    atsCorrect: p.correct + Math.max(0, s.week * 2),
    atsTotal: Math.max(p.correct, s.week * 5),
    currentStreak: p.streak,
    bestWeek: Math.max(p.weekPoints, 20),
    worstWeek: Math.min(p.weekPoints, 7),
    perfectWeeks: index % 7 === 0 ? 1 : 0,
    bestBetHits: Math.max(0, Math.floor(s.week / 2)),
    bestBetTotal: Math.max(0, s.week),
    propHits: Math.max(0, Math.floor(s.week / 3)),
    propTotal: Math.max(0, s.week),
    weeksPlayed: Math.max(0, s.week),
    isMock: true,
  }));
}

export function foundryLiveRoster(): LeagueRosterMember[] | null {
  const players = foundryLivePlayers();
  if (!players) return null;
  return players.map((p, index) => ({ membershipId: `foundry-membership-${p.id}`, userId: p.id, name: p.name, division: p.division, role: index === 0 ? "commissioner" : "player", totalPoints: p.totalPoints, isBot: index > 0, joinedAt: new Date(Date.now() - index * 86_400_000).toISOString() }));
}

export function foundryLiveScoredWeeks(): number[] | null {
  const s = state();
  if (!s) return null;
  return s.games.some((game) => game.status === "final" && !!game.result)
    ? [s.week]
    : [];
}
