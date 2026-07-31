import { Player, Game, Prop, UserPick } from "./types";
import { syncLeagueCheevoKing } from "./badges";
import { scoreWeek, GameResult } from "./scoring";
import { mockPlayers } from "./mock-data";

const PLAYERS_KEY = "warroom-players";
const RESULTS_KEY = "warroom-results-week-1";
const CARD_KEY = "warroom-card-week-1";
const PICKS_KEY = "warroom-picks-week-1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function withDefaults(p: Player): Player {
  return {
    ...p,
    bestWeek: p.bestWeek ?? 0,
    worstWeek: p.worstWeek ?? 0,
    perfectWeeks: p.perfectWeeks ?? 0,
    bestBetHits: p.bestBetHits ?? 0,
    bestBetTotal: p.bestBetTotal ?? 0,
    propHits: p.propHits ?? 0,
    propTotal: p.propTotal ?? 0,
    weeksPlayed: p.weeksPlayed ?? p.weeklyPoints?.length ?? 0,
    avatarUrl: p.avatarUrl ?? null,
    memberSince: p.memberSince ?? "2025-08-01T12:00:00.000Z",
    isCreator: p.id === "1" || !!p.isCreator,
    // NPC if marked, or still matches a demo catalog entry (not you)
    isMock:
      p.id === "1" || p.isCreator
        ? false
        : p.isMock === true ||
          mockPlayers.some((m) => m.id === p.id && m.name === p.name && m.isMock),
    permanentBadgeIds: p.permanentBadgeIds ?? [],
  };
}

/** Always returns a roster. Defaults to mock players. */
export function loadPlayers(): Player[] {
  if (!canUseStorage()) return mockPlayers.map(withDefaults);

  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Player[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(withDefaults);
      }
    }
  } catch {
    /* use mocks */
  }

  try {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(mockPlayers));
  } catch {
    /* ignore */
  }
  return mockPlayers.map(withDefaults);
}

/**
 * Load roster, crown Cheevo King(s), save if anyone newly earned it.
 * Use when opening profiles / standings so the rare badge stays in sync.
 */
export function loadPlayersAndSyncCheevos(): Player[] {
  const players = loadPlayers();
  const synced = syncLeagueCheevoKing(players);
  if (synced !== players) {
    savePlayers(synced);
  }
  return synced;
}

export function savePlayers(players: Player[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  } catch {
    /* ignore */
  }
}

/** Simple: look up by id in roster (after cheevo sync), then mock catalog. */
export function findPlayer(id: string | null | undefined): Player | null {
  if (!id) return null;
  const key = String(id);

  const fromRoster = loadPlayersAndSyncCheevos().find((p) => p.id === key);
  if (fromRoster) return fromRoster;

  const fromMocks = mockPlayers.find((p) => p.id === key);
  return fromMocks ? withDefaults(fromMocks) : null;
}

export function playerProfilePath(playerId: string): string {
  return `/profile/${playerId}`;
}

export function applyWeekScores(): Player[] {
  if (!canUseStorage()) return mockPlayers.map(withDefaults);

  const players = loadPlayers();

  let results: Record<string, GameResult> = {};
  let propResult: string | null = null;
  let games: Game[] = [];
  let prop: Prop | null = null;

  try {
    const resRaw = localStorage.getItem(RESULTS_KEY);
    if (resRaw) {
      const data = JSON.parse(resRaw);
      results = data.results || {};
      propResult = data.propResult || null;
    }
    const cardRaw = localStorage.getItem(CARD_KEY);
    if (cardRaw) {
      const data = JSON.parse(cardRaw);
      games = data.games || [];
      prop = data.prop || null;
    }
  } catch {
    return players;
  }

  if (!prop || games.length === 0) return players;

  let picks: Record<string, UserPick> = {};
  let bestBetId: string | null = null;
  let propChoice: string | null = null;

  try {
    const picksRaw = localStorage.getItem(PICKS_KEY);
    if (picksRaw) {
      const data = JSON.parse(picksRaw);
      picks = data.picks || {};
      bestBetId = data.bestBetId || null;
      propChoice = data.propChoice || null;
    }
  } catch {
    return players;
  }

  if (Object.keys(picks).length === 0) return players;

  const weekScore = scoreWeek(
    picks,
    bestBetId,
    propChoice,
    games,
    results,
    prop,
    propResult
  );

  const bestBetHit = weekScore.gameScores.some(
    (g) => g.isBestBet && g.correct
  );
  const hadBestBet = weekScore.gameScores.some((g) => g.isBestBet);

  const updated = players.map((p) => {
    if (p.id !== "1") return p;

    const pts = weekScore.totalPoints;
    const newWeekly = [...p.weeklyPoints, pts];
    const bestWeek = Math.max(p.bestWeek || 0, pts);
    const worstWeek =
      p.weeksPlayed === 0 ? pts : Math.min(p.worstWeek ?? pts, pts);

    let streak = p.currentStreak;
    if (pts >= 10) streak = streak > 0 ? streak + 1 : 1;
    else streak = streak < 0 ? streak - 1 : -1;

    return {
      ...p,
      totalPoints: p.totalPoints + pts,
      weeklyPoints: newWeekly,
      atsCorrect: p.atsCorrect + weekScore.correctCount,
      atsTotal: p.atsTotal + games.length + 1,
      currentStreak: streak,
      bestWeek,
      worstWeek,
      perfectWeeks: p.perfectWeeks + (pts >= 18 ? 1 : 0),
      bestBetHits: p.bestBetHits + (bestBetHit ? 1 : 0),
      bestBetTotal: p.bestBetTotal + (hadBestBet ? 1 : 0),
      propHits: p.propHits + (weekScore.propCorrect ? 1 : 0),
      propTotal: p.propTotal + 1,
      weeksPlayed: p.weeksPlayed + 1,
    };
  });

  savePlayers(updated);
  return updated;
}

export function resetPlayers() {
  if (!canUseStorage()) return mockPlayers.map(withDefaults);
  try {
    localStorage.removeItem(PLAYERS_KEY);
  } catch {
    /* ignore */
  }
  return loadPlayers();
}
