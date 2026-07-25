import { Player } from "./types";
import { loadPlayers, savePlayers } from "./store";

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";

export interface League {
  id: string;
  name: string;
  code: string;
  commissionerId: string;
  createdAt: string;
}

export interface Session {
  playerId: string;
  playerName: string;
  isCommissioner: boolean;
  leagueId: string;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getLeague(): League | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isCommissioner(): boolean {
  const session = getSession();
  return !!session?.isCommissioner;
}

export function createLeague(leagueName: string, commissionerName: string): {
  league: League;
  session: Session;
} {
  const playerId = `p-${Date.now()}`;
  const league: League = {
    id: `lg-${Date.now()}`,
    name: leagueName.trim() || "War Room",
    code: generateCode(),
    commissionerId: playerId,
    createdAt: new Date().toISOString(),
  };

  const session: Session = {
    playerId,
    playerName: commissionerName.trim() || "Commissioner",
    isCommissioner: true,
    leagueId: league.id,
  };

  // Seed commissioner as player id "1" for scoring compatibility + fresh roster
  const commissioner: Player = {
    id: "1",
    name: session.playerName,
    division: "North",
    totalPoints: 0,
    weeklyPoints: [],
    atsCorrect: 0,
    atsTotal: 0,
    currentStreak: 0,
    bestWeek: 0,
    worstWeek: 0,
    perfectWeeks: 0,
    bestBetHits: 0,
    bestBetTotal: 0,
    propHits: 0,
    propTotal: 0,
    weeksPlayed: 0,
  };

  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Keep mock field for demo depth, but put commissioner first as id 1
    const existing = loadPlayers().filter((p) => p.id !== "1");
    savePlayers([commissioner, ...existing]);
  }

  return { league, session };
}

export function joinLeague(
  code: string,
  playerName: string
): { ok: boolean; error?: string; session?: Session } {
  const league = getLeague();
  if (!league) {
    return {
      ok: false,
      error: "No league on this device yet. Ask the commissioner for a link, or create one.",
    };
  }
  if (code.trim().toUpperCase() !== league.code) {
    return { ok: false, error: "Invalid league code." };
  }

  const name = playerName.trim();
  if (!name) return { ok: false, error: "Enter a display name." };

  const players = loadPlayers();
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    // Re-join as existing name
    const existing = players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    )!;
    const session: Session = {
      playerId: existing.id,
      playerName: existing.name,
      isCommissioner: existing.id === league.commissionerId || existing.id === "1",
      leagueId: league.id,
    };
    if (canUseStorage()) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return { ok: true, session };
  }

  const playerId = `p-${Date.now()}`;
  const player: Player = {
    id: playerId,
    name,
    division: "North",
    totalPoints: 0,
    weeklyPoints: [],
    atsCorrect: 0,
    atsTotal: 0,
    currentStreak: 0,
    bestWeek: 0,
    worstWeek: 0,
    perfectWeeks: 0,
    bestBetHits: 0,
    bestBetTotal: 0,
    propHits: 0,
    propTotal: 0,
    weeksPlayed: 0,
  };

  savePlayers([...players, player]);

  const session: Session = {
    playerId,
    playerName: name,
    isCommissioner: false,
    leagueId: league.id,
  };

  if (canUseStorage()) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return { ok: true, session };
}

export function leaveSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(SESSION_KEY);
}

export function resetLeague() {
  if (!canUseStorage()) return;
  localStorage.removeItem(LEAGUE_KEY);
  localStorage.removeItem(SESSION_KEY);
}
