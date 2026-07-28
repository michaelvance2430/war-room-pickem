export type Division = "North" | "South" | "East" | "West";

export interface Player {
  id: string;
  name: string;
  division: Division;
  totalPoints: number;
  weeklyPoints: number[];
  atsCorrect: number;
  atsTotal: number;
  currentStreak: number;
  // Expanded stats
  bestWeek: number;
  worstWeek: number;
  perfectWeeks: number;
  bestBetHits: number;
  bestBetTotal: number;
  propHits: number;
  propTotal: number;
  weeksPlayed: number;
}

export interface Game {
  id: string;
  awayTeam: string;
  homeTeam: string;
  spread: number;
  favorite: "home" | "away";
  /** Display string (legacy + short); prefer commenceTime for real dates */
  startTime: string;
  /** ISO kickoff from odds API — use for date under matchup */
  commenceTime?: string;
  bookmaker?: string;
  lastUpdate?: string;
  /** AP / FPI rank when available (1–25) */
  awayRank?: number | null;
  homeRank?: number | null;
}

export interface Prop {
  id: string;
  question: string;
  options: [string, string];
  points: number;
}

export interface WeeklyCard {
  week: number;
  games: Game[];
  prop: Prop;
  lockTime: string;
}

export interface UserPick {
  gameId: string;
  pick: "home" | "away";
  confidence: number;
  isBestBet: boolean;
  lockedSpread: number;
  lockedFavorite: "home" | "away";
}

export interface UserPropPick {
  propId: string;
  choice: string;
}

export interface OddsApiGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: string;
      outcomes: { name: string; price?: number; point?: number }[];
    }[];
  }[];
}
