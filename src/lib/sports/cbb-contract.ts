/**
 * THE FIELDHOUSE — College Basketball product contract.
 *
 * This is one sport with a changing seasonal heartbeat. The national
 * tournament is not a disconnected sport pack and never falls back to the
 * five-game regular-season card.
 */

export const CBB_PRODUCT_NAME = "College Basketball";
export const CBB_ROOM_NAME = "The Fieldhouse";
export const CBB_PUBLIC_STATUS = "under_construction" as const;

export type CbbSeasonPhase =
  | "regular_season"
  | "tournament_takeover"
  | "champ_week"
  | "selection_show"
  | "first_four"
  | "opening_weekend"
  | "sweet_16"
  | "elite_eight"
  | "final_four"
  | "national_championship"
  | "season_complete";

export const CBB_PHASE_ORDER: readonly CbbSeasonPhase[] = [
  "regular_season",
  "tournament_takeover",
  "champ_week",
  "selection_show",
  "first_four",
  "opening_weekend",
  "sweet_16",
  "elite_eight",
  "final_four",
  "national_championship",
  "season_complete",
];

export const CBB_REGULAR_CADENCE = {
  slateDay: "saturday",
  commissionerPublishDeadline: "Wednesday 8:00 PM ET",
  playerLockRule: "Entire card locks at the first selected Saturday tip",
  defaultGames: 5,
  commissionerMayAddGames: true,
  bestBetCount: 1,
  propName: "Student Section Prop",
  scoringWindowClose: "After the final selected Saturday game",
  gazetteWindow: "Saturday night or Sunday after scoring",
} as const;

export const CBB_TOURNAMENT_TAKEOVER = {
  optional: true,
  replacesRegularCard: true,
  selectionRule: "Commissioner selects one eligible early-season event",
  gameRule: "Pick every game in the selected championship bracket",
  consolationGames: "Commissioner optional",
  lockRule: "Each game locks at its own tip",
  championPickRequired: true,
  doubleDownsPerEvent: 1,
  separateMiniStandings: true,
  profileReward: "Temporary event pennant",
} as const;

export const CBB_CHAMP_WEEK = {
  championBallot: true,
  includeFavoriteTeamConference: true,
  rotatingMidMajors: true,
  featuredCards: "Bubble games, rivalries, semifinals, title games, bid stealers",
  lockRule: "Each game locks at its own tip",
  finalAction: "Freeze regular standings and publish the Fieldhouse Selection Show",
} as const;

export const CBB_NATIONAL_TOURNAMENT_ROUNDS = [
  { phase: "first_four", label: "First Four", games: 4 },
  { phase: "opening_weekend", label: "Round of 64", games: 32 },
  { phase: "opening_weekend", label: "Round of 32", games: 16 },
  { phase: "sweet_16", label: "Sweet 16", games: 8 },
  { phase: "elite_eight", label: "Elite Eight", games: 4 },
  { phase: "final_four", label: "Final Four", games: 2 },
  { phase: "national_championship", label: "National Championship", games: 1 },
] as const;

export const CBB_NATIONAL_TOURNAMENT_TOTAL_GAMES = 67;

export const CBB_MARCH_CARD_RULES = {
  everyGameRequired: true,
  traditionalConfidenceDisabled: true,
  pointsPerCorrectPick: 1,
  doubleDownsPerRound: 1,
  correctDoubleDownTotalPoints: 2,
  roundPropPoints: 2,
  numericTiebreakerRequired: true,
  tieOrder: ["numeric_tiebreaker", "regular_season_seed"] as const,
  consensusRevealAfterLock: true,
  eliminatedPlayersKeepPicking: true,
  eliminationBegins: "sweet_16" as const,
} as const;

export type CbbFieldSplit = {
  totalPlayers: number;
  championshipPlayers: number;
  toiletBowlPlayers: number;
  championshipBracketSize: number;
  toiletBowlBracketSize: number;
  championshipByes: number;
  toiletBowlByes: number;
};

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/**
 * The top half chases the title; the bottom half enters the Toilet Bowl.
 * Odd fields give the Championship side the extra player. Byes go to the
 * highest regular-season seeds inside that bracket. Valid for 8–32 players.
 */
export function splitCbbTournamentField(totalPlayers: number): CbbFieldSplit {
  if (!Number.isInteger(totalPlayers) || totalPlayers < 8 || totalPlayers > 32) {
    throw new RangeError("College Basketball tournament field must contain 8–32 players");
  }
  const championshipPlayers = Math.ceil(totalPlayers / 2);
  const toiletBowlPlayers = Math.floor(totalPlayers / 2);
  const championshipBracketSize = nextPowerOfTwo(championshipPlayers);
  const toiletBowlBracketSize = nextPowerOfTwo(toiletBowlPlayers);
  return {
    totalPlayers,
    championshipPlayers,
    toiletBowlPlayers,
    championshipBracketSize,
    toiletBowlBracketSize,
    championshipByes: championshipBracketSize - championshipPlayers,
    toiletBowlByes: toiletBowlBracketSize - toiletBowlPlayers,
  };
}

export const CBB_PROFILE_CONTRACT = {
  passportName: "The Fieldhouse Seal",
  passportUnlock: "Lock the first real College Basketball card",
  publicProfilesShowLockedCheevos: false,
  selfProfileShowsLockedByDefault: false,
  generalAndSportSpecificSeparated: true,
  onlyParticipatedSportsAppear: true,
  featuredCheevos: 3,
  stackRepeatedCheevos: true,
} as const;

