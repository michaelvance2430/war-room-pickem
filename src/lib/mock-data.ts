import { WeeklyCard, Player } from "./types";

export const currentWeek: WeeklyCard = {
  week: 1,
  lockTime: "Saturday 12:00 PM ET",
  games: [
    { id: "g1", awayTeam: "Georgia", homeTeam: "Clemson", spread: -3.5, favorite: "home", startTime: "Sat 12:00 PM" },
    { id: "g2", awayTeam: "Ohio State", homeTeam: "Michigan", spread: 2.5, favorite: "away", startTime: "Sat 3:30 PM" },
    { id: "g3", awayTeam: "Texas", homeTeam: "Oklahoma", spread: 6.5, favorite: "away", startTime: "Sat 7:30 PM" },
    { id: "g4", awayTeam: "Alabama", homeTeam: "LSU", spread: -1.5, favorite: "home", startTime: "Sat 8:00 PM" },
    { id: "g5", awayTeam: "Oregon", homeTeam: "Washington", spread: 4.0, favorite: "away", startTime: "Sat 10:30 PM" },
  ],
  prop: {
    id: "p1",
    question: "Will the highest-scoring game go Over or Under 55.5 total points?",
    options: ["Over 55.5", "Under 55.5"],
    points: 3,
  },
};

function p(
  id: string,
  name: string,
  division: Player["division"],
  totalPoints: number,
  weeklyPoints: number[],
  atsCorrect: number,
  atsTotal: number,
  currentStreak: number
): Player {
  const bestWeek = weeklyPoints.length ? Math.max(...weeklyPoints) : 0;
  const worstWeek = weeklyPoints.length ? Math.min(...weeklyPoints) : 0;
  return {
    id,
    name,
    division,
    totalPoints,
    weeklyPoints,
    atsCorrect,
    atsTotal,
    currentStreak,
    bestWeek,
    worstWeek,
    perfectWeeks: weeklyPoints.filter((w) => w >= 18).length,
    bestBetHits: Math.floor(atsCorrect * 0.3),
    bestBetTotal: Math.max(1, Math.floor(atsTotal / 5)),
    propHits: Math.floor(weeklyPoints.length * 0.5),
    propTotal: weeklyPoints.length,
    weeksPlayed: weeklyPoints.length,
  };
}

export const mockPlayers: Player[] = [
  p("1", "Commissioner", "North", 48, [12, 9, 14, 13], 14, 20, 3),
  p("2", "BigDawg22", "North", 44, [11, 10, 8, 15], 13, 20, 2),
  p("3", "SpreadSlayer", "North", 39, [8, 12, 9, 10], 11, 20, -1),
  p("4", "NorthStar", "North", 31, [7, 6, 9, 9], 9, 20, 1),
  p("5", "ColdTakes", "North", 22, [5, 4, 7, 6], 7, 20, -3),
  p("6", "SpreadKiller", "South", 51, [13, 14, 11, 13], 15, 20, 4),
  p("7", "DixieDanger", "South", 42, [10, 9, 12, 11], 12, 20, 1),
  p("8", "BayouBandit", "South", 37, [9, 8, 10, 10], 11, 20, 0),
  p("9", "SECSavant", "South", 28, [6, 7, 8, 7], 8, 20, -2),
  p("10", "LostInTheSauce", "South", 19, [4, 5, 5, 5], 6, 20, -4),
  p("11", "ToiletKing", "East", 46, [12, 11, 10, 13], 13, 20, 2),
  p("12", "CoastalChaos", "East", 40, [9, 11, 9, 11], 12, 20, 1),
  p("13", "ACCAttack", "East", 35, [8, 9, 8, 10], 10, 20, 0),
  p("14", "Fader", "East", 27, [6, 5, 8, 8], 8, 20, -1),
  p("15", "BenchWarmer", "East", 18, [3, 4, 6, 5], 5, 20, -5),
  p("16", "ConfidenceQueen", "West", 49, [14, 12, 11, 12], 14, 20, 3),
  p("17", "PacRisk", "West", 41, [10, 10, 11, 10], 12, 20, 0),
  p("18", "MountainMan", "West", 36, [9, 8, 9, 10], 11, 20, 1),
  p("19", "UnderdogU", "West", 29, [7, 6, 8, 8], 9, 20, -1),
  p("20", "LastPlaceLarry", "West", 16, [2, 3, 5, 6], 5, 20, -2),
];
