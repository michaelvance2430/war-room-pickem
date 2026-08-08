import type { SportId } from "@/lib/sports/types";
import type { NcaaPicks } from "@/lib/ncaa-bracket";

export type PreviewSport = Extract<SportId, "cfb" | "nfl" | "cbb">;
export type PreviewRole = "player" | "commissioner";
export type FieldhouseRegion = "East" | "West" | "South" | "Midwest";
export const FIELDHOUSE_REGIONS: readonly FieldhouseRegion[] = ["East", "West", "South", "Midwest"];
export type PreviewPlayer = {
  id: string;
  name: string;
  points: number;
  weekPoints: number;
  correct: number;
  locked: boolean;
  streak: number;
  region: FieldhouseRegion;
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
  /** Scored weekly editions retained for the walkable Gazette archive. */
  gazetteWeeks: number[];
  ncaaPicks: NcaaPicks;
};

export const FOUNDRY_WALKTHROUGH_KEY = "warroom-foundry-walkthrough-v1";
export const FOUNDRY_WALKTHROUGH_EVENT = "warroom-foundry-walkthrough";

/** Last playable preview window. The simulator may never advance beyond it. */
export function foundryFinalWeek(sport: PreviewSport): number {
  return sport === "cbb" ? 22 : sport === "nfl" ? 18 : 16;
}

/** First official postseason window; regular-season simulation stops here. */
export function foundryPostseasonStartWeek(sport: PreviewSport): number {
  return foundryFinalWeek(sport) - 3;
}

export function isFoundrySeasonFinal(state: Pick<FoundryWalkthrough, "sport" | "week">): boolean {
  return state.week >= foundryFinalWeek(state.sport);
}

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
    return { id: `preview-${index}`, name, weekPoints, points: week * 12 + weekPoints + (hash(seed, index, 4) % 42), correct: 2 + (hash(seed, index, 7) % 4), locked: index !== 10 || week % 2 === 0, streak: (hash(seed, index, 9) % 7) - 2, region: FIELDHOUSE_REGIONS[index % FIELDHOUSE_REGIONS.length] };
  }).sort((a, b) => b.points - a.points).map((player) => ({ ...player }));
  const games = MATCHUPS[sport].map(([away, home], index) => {
    const homeLine = ((hash(seed, index) % 13) - 7) / 2;
    const awayScore = 17 + (hash(seed, index, 2) % (sport === "cbb" ? 55 : 25));
    const homeScore = 17 + (hash(seed, index, 3) % (sport === "cbb" ? 55 : 25));
    const final = index < 3;
    return { id: `${sport}-${week}-${index}`, away, home, spread: `${home} ${homeLine > 0 ? "+" : ""}${homeLine}`, status: final ? "final" as const : "upcoming" as const, result: final ? `${away} ${awayScore} · ${home} ${homeScore}` : undefined, pick: index % 2 ? away : home, confidence: 5 - index };
  });
  return { version: 1, sport, role, week, seasonLabel: "2026 Foundry Season", generatedAt: Date.now(), players, games, unreadGazette: false, gazetteWeeks: [], ncaaPicks: {} };
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
    return parsed?.version === 1 ? {
      ...parsed,
      players: parsed.players.map((player, index) => ({
        ...player,
        region: FIELDHOUSE_REGIONS.includes(player.region as FieldhouseRegion)
          ? player.region
          : FIELDHOUSE_REGIONS[index % FIELDHOUSE_REGIONS.length],
      })),
      gazetteWeeks: Array.isArray(parsed.gazetteWeeks) ? parsed.gazetteWeeks : [],
      ncaaPicks: parsed.ncaaPicks && typeof parsed.ncaaPicks === "object" ? parsed.ncaaPicks : {},
    } : null;
  } catch { return null; }
}

export function simulateNextFoundryWeek(state: FoundryWalkthrough): FoundryWalkthrough {
  const nextWeek = Math.min(state.week + 1, foundryFinalWeek(state.sport));
  // A completed season is immutable. Preserve its archive instead of creating
  // a fictional Window 23 / Week 19 when Sim Week is pressed again.
  if (nextWeek === state.week) return state;
  const next = createFoundryWalkthrough(state.sport, nextWeek, state.role);
  return { ...next, gazetteWeeks: Array.from(new Set([...(state.gazetteWeeks || []), state.week])).sort((a, b) => a - b), ncaaPicks: state.ncaaPicks || {}, unreadGazette: true };
}

export function simulateFoundrySeason(state: FoundryWalkthrough): FoundryWalkthrough {
  const finalWeek = foundryFinalWeek(state.sport);
  const next = createFoundryWalkthrough(state.sport, finalWeek, state.role);
  return { ...next, gazetteWeeks: Array.from({ length: finalWeek }, (_, index) => index + 1), ncaaPicks: state.ncaaPicks || {}, unreadGazette: true };
}

export function simulateFoundryRegularSeason(state: FoundryWalkthrough): FoundryWalkthrough {
  const postseasonWeek = foundryPostseasonStartWeek(state.sport);
  const next = createFoundryWalkthrough(state.sport, postseasonWeek, state.role);
  return {
    ...next,
    gazetteWeeks: Array.from({ length: postseasonWeek }, (_, index) => index + 1),
    ncaaPicks: state.ncaaPicks || {},
    unreadGazette: true,
  };
}

/** Monday start for each sport's 2026 season window. */
export function foundryWeekStartDate(sport: PreviewSport, week: number): Date {
  const start = sport === "cfb" ? Date.UTC(2026, 7, 24, 16) : sport === "nfl" ? Date.UTC(2026, 8, 7, 16) : Date.UTC(2026, 10, 2, 16);
  return new Date(start + Math.max(0, week - 1) * 7 * 24 * 60 * 60 * 1000);
}

export function setFoundryWalkthroughRole(state: FoundryWalkthrough, role: PreviewRole): FoundryWalkthrough {
  return { ...state, role };
}
