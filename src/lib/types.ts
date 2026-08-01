export type Division = "North" | "South" | "East" | "West";

export type BadgeTier = "common" | "rare" | "epic" | "legendary";

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
  /** Profile extras */
  avatarUrl?: string | null;
  memberSince?: string; // ISO date
  /** App creator — permanent Legendary badge */
  isCreator?: boolean;
  /** Demo/NPC filler */
  isMock?: boolean;
  /** Permanent badges (e.g. Cheevo King) — never revoked */
  permanentBadgeIds?: string[];
  /** profiles.last_seen_at — last app open (presence) */
  lastSeenAt?: string | null;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  howToEarn: string;
  tier: BadgeTier;
  points: number;
  lockedLabel?: string;
  creatorOnly?: boolean;
  icon: string;
  /**
   * Can be earned more than once (weekly last, perfect week, etc.).
   * Stack count shows on Status; re-earn can celebrate again.
   * Career points still bank once unless noted otherwise.
   */
  stackable?: boolean;
}

export interface BadgeStatus {
  def: BadgeDef;
  earned: boolean;
  /** ISO first-seen stamp (optional) */
  earnedAt?: string | null;
  /** CFB season year when first earned (e.g. 2026) */
  earnedSeasonYear?: number | null;
  /** League week when first earned (0–18), if known */
  earnedWeek?: number | null;
  /** Lifetime times earned (stackable cheevos) */
  earnCount?: number | null;
  progress?: { current: number; target: number } | null;
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
  /** The Odds API event id (for score matching) */
  oddsEventId?: string;
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
