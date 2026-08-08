import type { SportId } from "@/lib/sports/types";

export type PreviewSport = Extract<SportId, "cfb" | "nfl" | "cbb">;
export type PreviewRole = "player" | "commissioner";
export type PreviewPlayer = {
  id: string;
  name: string;
  points: number;
  weekPoints: number;
  correct: number;
  locked: boolean;
  streak: number;
};
export type PreviewGame = {
  id: string;
  away: string;
  home: string;
  spread: string;
  status: "final" | "upcoming";
  result?: string;
  pick?: string;
  confidence: number;
};
export type FoundryWalkthrough = {
  version: 1;
  sport: PreviewSport;
  role: PreviewRole;
  week: number;
  seasonLabel: string;
  generatedAt: number;
  players: PreviewPlayer[];
  games: PreviewGame[];
  unreadGazette: boolean;
};

export const FOUNDRY_WALKTHROUGH_KEY = "warroom-foundry-walkthrough-v1";
export const FOUNDRY_WALKTHROUGH_EVENT = "warroom-foundry-walkthrough";

export const PREVIEW_SPORTS: Record<PreviewSport, {
  room: string;
  sport: string;
  cadence: string;
  accent: string;
  weekLabel: (week: number) => string;
}> = {
  cfb: { room: "The War Room", sport: "College Football", cadence: "Saturday slate", accent: "amber", weekLabel: (w) => `Week ${w}` },
  nfl: { room: "The League Office", sport: "NFL", cadence: "Sunday slate", accent: "red", weekLabel: (w) => `Week ${w}` },
  cbb: { room: "The Fieldhouse", sport: "College Basketball", cadence: "Saturday card", accent: "orange", weekLabel: (w) => `Window ${w}` },
};

const PEOPLE = ["Mike V", "Maria", "Kahmann", "Big Balls Ben", "Jstray", "Prestige Worldwide", "Rob Harbison", "The Commissioner", "Fourth Down Fran", "Captain Spreadsheet", "Aunt Linda", "Two-Screen Tony", "Parlay Pete", "Overtime Olivia", "Wrong-Way Randy", "Tailgate Terry"];
const MATCHUPS: Record<PreviewSport, [string, string][]> = {
  cfb: [["Georgia", "Alabama"], ["Ohio State", "Michigan"], ["Texas", "Oklahoma"], ["Notre Dame", "USC"], ["Penn State", "Oregon"]],
  nfl: [["Chiefs", "Bills"], ["Eagles", "Cowboys"], ["Lions", "Packers"], ["Ravens", "Bengals"], ["49ers", "Rams"]],
  cbb: [["Duke", "North Carolina"], ["Kansas", "Baylor"], ["Kentucky", "Tennessee"], ["UConn", "Villanova"], ["Gonzaga", "Saint Mary's"]],
};

function hash(seed: number, a: number, b = 0) {
  return Math.abs(((seed + 17) * 9301 + a * 49297 + b * 233) % 233280);
}

export function createFoundryWalkthrough(sport: PreviewSport, week = 1, role: PreviewRole = "player"): FoundryWalkthrough {
  const seed = week + (sport === "nfl" ? 31 : sport === "cbb" ? 67 : 11);
  const players = PEOPLE.map((name, index) => {
    const weekPoints = 5 + (hash(seed, index) % 21);
    return { id: `preview-${index}`, name, weekPoints, points: week * 12 + weekPoints + (hash(seed, index, 4) % 42), correct: 2 + (hash(seed, index, 7) % 4), locked: index !== 10 || week % 2 === 0, streak: (hash(seed, index, 9) % 7) - 2 };
  }).sort((a, b) => b.points - a.points).map((player) => ({ ...player }));
  const games = MATCHUPS[sport].map(([away, home], index) => {
    const homeLine = ((hash(seed, index) % 13) - 7) / 2;
    const awayScore = 17 + (hash(seed, index, 2) % (sport === "cbb" ? 55 : 25));
    const homeScore = 17 + (hash(seed, index, 3) % (sport === "cbb" ? 55 : 25));
    const final = index < 3;
    return { id: `${sport}-${week}-${index}`, away, home, spread: `${home} ${homeLine > 0 ? "+" : ""}${homeLine}`, status: final ? "final" as const : "upcoming" as const, result: final ? `${away} ${awayScore} · ${home} ${homeScore}` : undefined, pick: index % 2 ? away : home, confidence: 5 - index };
  });
  return { version: 1, sport, role, week, seasonLabel: "2026 Foundry Season", generatedAt: Date.now(), players, games, unreadGazette: true };
}

export function saveFoundryWalkthrough(state: FoundryWalkthrough) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOUNDRY_WALKTHROUGH_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(FOUNDRY_WALKTHROUGH_EVENT));
}

export function loadFoundryWalkthrough(): FoundryWalkthrough | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(FOUNDRY_WALKTHROUGH_KEY) || "null") as FoundryWalkthrough | null;
    return parsed?.version === 1 ? parsed : null;
  } catch { return null; }
}

export function simulateNextFoundryWeek(state: FoundryWalkthrough): FoundryWalkthrough {
  return createFoundryWalkthrough(state.sport, state.week + 1, state.role);
}

export function setFoundryWalkthroughRole(state: FoundryWalkthrough, role: PreviewRole): FoundryWalkthrough {
  return { ...state, role };
}

