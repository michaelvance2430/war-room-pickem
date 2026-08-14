import type { CloudCard, LeagueRosterMember } from "@/lib/cloud";
import type { GameResult } from "@/lib/scoring";
import type { Player, UserPick } from "@/lib/types";
import {
  FOUNDRY_WALKTHROUGH_EVENT,
  createFoundryWalkthrough,
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

function stateForWeek(weekNumber: number): FoundryWalkthrough | null {
  const current = state();
  if (!current) return null;
  if (current.week === weekNumber) return current;
  const snapshot = current.weekHistory?.find((entry) => entry.week === weekNumber);
  if (!snapshot) return null;
  const historical = createFoundryWalkthrough(current.sport, weekNumber, current.role);
  return {
    ...historical,
    gazetteWeeks: current.gazetteWeeks,
    weekHistory: current.weekHistory,
    generatedAt: snapshot.generatedAt,
    players: snapshot.players,
    games: snapshot.games,
  };
}

function picksForGames(games: FoundryWalkthrough["games"]): Record<string, UserPick> {
  return Object.fromEntries(games.map((game) => [game.id, {
    gameId: game.id,
    pick: game.pick === game.away ? "away" as const : "home" as const,
    confidence: game.confidence,
    isBestBet: game.confidence === 5,
    lockedSpread: Math.abs(lineFor(game)),
    lockedFavorite: favoriteFor(game),
  }]));
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
  const current = state();
  if (!current?.gazetteWeeks.includes(weekNumber)) return null;
  const s = stateForWeek(weekNumber);
  if (!s) return null;

  const results: Record<string, GameResult> = {};
  for (const game of s.games) {
    if (!(game.status === "final" && game.result)) continue;
    const sides = game.result.split("·");
    const awayScore = Number(sides[0]?.match(/(\d+)\s*$/)?.[1]);
    const homeScore = Number(sides[1]?.match(/(\d+)\s*$/)?.[1]);
    if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) continue;
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

export function foundryLiveWeekBoard(weekNumber: number) {
  const s = stateForWeek(weekNumber);
  if (!s) return null;
  const scored = s.gazetteWeeks.includes(weekNumber);
  const picks = picksForGames(s.games);
  return {
    ok: true,
    scored,
    lockedOpen: true,
    slips: s.players.map((player, index) => ({
      userId: player.id,
      name: player.name,
      isBot: index > 0,
      picks,
      bestBetId: s.games.find((game) => game.confidence === 5)?.id || null,
      propChoice: "Absolutely",
      lockedAt: player.locked ? new Date(s.generatedAt).toISOString() : null,
      totalPoints: scored ? player.weekPoints : null,
      isChaos: false,
    })).sort((a, b) => (b.totalPoints ?? -1) - (a.totalPoints ?? -1) || a.name.localeCompare(b.name)),
  };
}

export function foundryLivePickSubmissionStatus(weekNumber: number) {
  const s = stateForWeek(weekNumber);
  if (!s) return null;
  return {
    ok: true,
    rows: s.players.map((player, index) => ({
      userId: player.id,
      name: player.name,
      division: (["North", "South", "East", "West"] as const)[index % 4],
      role: index === 0 ? "commissioner" as const : "player" as const,
      submitted: player.locked,
      complete: player.locked,
      gamePickCount: player.locked ? s.games.length : 0,
      hasProp: player.locked,
      hasBestBet: player.locked,
      lockedAt: player.locked ? new Date(s.generatedAt).toISOString() : null,
    })),
  };
}

export function foundryLiveNoLockNames(weekNumber: number): string[] | null {
  const s = stateForWeek(weekNumber);
  return s ? s.players.filter((player) => !player.locked).map((player) => player.name).sort() : null;
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

function playersForState(s: FoundryWalkthrough): Player[] {
  const history = [...(s.weekHistory || [])].sort((a, b) => a.week - b.week);
  return s.players.map((p, index) => ({
    id: p.id,
    name: p.name,
    division: (["North", "South", "East", "West"] as const)[index % 4],
    totalPoints: history.reduce((sum, snapshot) => sum + (snapshot.players.find((row) => row.id === p.id)?.weekPoints || 0), 0),
    weeklyPoints: history.map((snapshot) => snapshot.players.find((row) => row.id === p.id)?.weekPoints || 0),
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
    weeksPlayed: history.length,
    isMock: true,
  }));
}

export function foundryLivePlayers(): Player[] | null {
  const s = state();
  return s ? playersForState(s) : null;
}

export function foundryLivePlayersForWeek(weekNumber: number): Player[] | null {
  const current = state();
  if (!current) return null;
  const snapshots = (current.weekHistory || []).filter((snapshot) => snapshot.week <= weekNumber);
  const target = snapshots.find((snapshot) => snapshot.week === weekNumber);
  if (!target) return null;
  return playersForState({ ...current, players: target.players, weekHistory: snapshots });
}

export function foundryLiveRoster(): LeagueRosterMember[] | null {
  const players = foundryLivePlayers();
  if (!players) return null;
  return players.map((p, index) => ({ membershipId: `foundry-membership-${p.id}`, userId: p.id, name: p.name, division: p.division, role: index === 0 ? "commissioner" : "player", totalPoints: p.totalPoints, isBot: index > 0, joinedAt: new Date(Date.now() - index * 86_400_000).toISOString() }));
}

export function foundryLiveScoredWeeks(): number[] | null {
  const s = state();
  if (!s) return null;
  return [...s.gazetteWeeks].sort((a, b) => a - b);
}

export function foundryLivePublishedWeeks(): number[] | null {
  const s = state();
  if (!s) return null;
  return Array.from(new Set([...(s.gazetteWeeks || []), s.week])).sort((a, b) => a - b);
}
