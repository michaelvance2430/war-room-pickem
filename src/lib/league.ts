import { Player } from "./types";
import { loadPlayers, savePlayers } from "./store";

const LEAGUE_KEY = "warroom-league";
const SESSION_KEY = "warroom-session";

export interface LeagueSettings {
  cutPercent: number; // bottom X% to Toilet Bowl
  regularSeasonWeeks: number;
  gamesPerWeek: number;
}

export interface League {
  id: string;
  name: string;
  code: string;
  commissionerId: string;
  createdAt: string;
  settings: LeagueSettings;
}

export interface Session {
  playerId: string;
  playerName: string;
  isCommissioner: boolean;
  leagueId: string;
}

const DEFAULT_SETTINGS: LeagueSettings = {
  cutPercent: 50,
  regularSeasonWeeks: 12,
  gamesPerWeek: 5,
};

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
    if (!raw) return null;
    const league = JSON.parse(raw) as League;
    if (!league.settings) league.settings = { ...DEFAULT_SETTINGS };
    return league;
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

export function updateLeagueName(name: string): League | null {
  const league = getLeague();
  if (!league) return null;
  league.name = name.trim() || league.name;
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
  return league;
}

export function updateLeagueSettings(partial: Partial<LeagueSettings>): League | null {
  const league = getLeague();
  if (!league) return null;
  league.settings = { ...DEFAULT_SETTINGS, ...(league.settings || {}), ...partial };
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
  return league;
}

export function regenerateCode(): League | null {
  const league = getLeague();
  if (!league) return null;
  league.code = generateCode();
  if (canUseStorage()) {
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  }
  return league;
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
    settings: { ...DEFAULT_SETTINGS },
  };

  const session: Session = {
    playerId,
    playerName: commissionerName.trim() || "Commissioner",
    isCommissioner: true,
    leagueId: league.id,
  };

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
  localStorage.removeItem("warroom-players");
  localStorage.removeItem("warroom-picks-week-1");
  localStorage.removeItem("warroom-results-week-1");
  localStorage.removeItem("warroom-card-week-1");
}
