import type { SportId } from "@/lib/sports/types";
import { generateNcaaPicks, ncaaScore, simulateNcaaResultsThroughWindow, type NcaaPicks } from "@/lib/ncaa-bracket";

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
  madnessPoints: number;
  madnessWindowPoints: number;
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
  ncaaResults: NcaaPicks;
  ncaaBracketLocked: boolean;
  /** Frozen before Window 1; separate from the Selection Sunday bracket. */
  preseasonChampionPicks: Record<string, string>;
  postseasonFields: { championship: string[]; toilet: string[] } | null;
  /** Regular-season Tactical Nuclear Button: two irreversible uses per season. */
  tacticalNukeWeeks: number[];
  tacticalNukeActive: boolean;
  mapsEvent: {
    protocol: "hellfire";
    /** Gazette edition that owns the emergency front page. */
    authorizationWeek: number;
    originalPicks: NcaaPicks;
    targetIds: string[];
    changedCount: number;
    humanPickCount: number;
    reviewed: boolean;
  } | null;
};

export type FoundryPostseasonRounds = {
  field: string[];
  regionalWinners: string[];
  semifinalWinners: string[];
  champion: string | null;
};

export const FOUNDRY_WALKTHROUGH_KEY = "warroom-foundry-walkthrough-v1";
export const FOUNDRY_WALKTHROUGH_EVENT = "warroom-foundry-walkthrough";

/** Last playable preview window. The simulator may never advance beyond it. */
export function foundryFinalWeek(sport: PreviewSport): number {
  return sport === "cbb" ? 22 : sport === "nfl" ? 22 : 16;
}

/** First official postseason window; regular-season simulation stops here. */
export function foundryPostseasonStartWeek(sport: PreviewSport): number {
  return foundryFinalWeek(sport) - 3;
}

export function isFoundrySeasonFinal(state: Pick<FoundryWalkthrough, "sport" | "week">): boolean {
  return state.week >= foundryFinalWeek(state.sport);
}

function foundryNcaaWindowForWeek(week: number): number {
  // Window 19 opens the field. The three remaining Foundry advances mirror
  // opening weekend, regional weekend, and Final Four weekend.
  if (week >= 22) return 4;
  if (week >= 21) return 3;
  if (week >= 20) return 1;
  return 0;
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

function createPreseasonChampionPicks(players: PreviewPlayer[], sport: PreviewSport): Record<string, string> {
  if (sport !== "cbb") return {};
  const simulatedChampion = simulateNcaaResultsThroughWindow(4)["national:championship"] || "Duke";
  return Object.fromEntries(players.map((player, index) => [player.id, index === 2 || index === 9 ? simulatedChampion : generateNcaaPicks(index + 301)["national:championship"] || "Duke"]));
}

export function createFoundryWalkthrough(sport: PreviewSport, week = 1, role: PreviewRole = "player"): FoundryWalkthrough {
  const seed = week + (sport === "nfl" ? 31 : sport === "cbb" ? 67 : 11);
  const players = PEOPLE.map((name, index) => {
    const opening = week === 1;
    const weekPoints = opening ? 0 : 5 + (hash(seed, index) % 21);
    return { id: `preview-${index}`, name, weekPoints, points: opening ? 0 : week * 12 + weekPoints + (hash(seed, index, 4) % 42), correct: opening ? 0 : 2 + (hash(seed, index, 7) % 4), locked: opening ? false : index !== 10 || week % 2 === 0, streak: opening ? 0 : (hash(seed, index, 9) % 7) - 2, region: FIELDHOUSE_REGIONS[index % FIELDHOUSE_REGIONS.length], madnessPoints: 0, madnessWindowPoints: 0 };
  }).sort((a, b) => b.points - a.points).map((player) => ({ ...player }));
  const games = MATCHUPS[sport].map(([away, home], index) => {
    const homeLine = ((hash(seed, index) % 13) - 7) / 2;
    const awayScore = 17 + (hash(seed, index, 2) % (sport === "cbb" ? 55 : 25));
    const homeScore = 17 + (hash(seed, index, 3) % (sport === "cbb" ? 55 : 25));
    const final = week > 1 && index < 3;
    return { id: `${sport}-${week}-${index}`, away, home, spread: `${home} ${homeLine > 0 ? "+" : ""}${homeLine}`, status: final ? "final" as const : "upcoming" as const, result: final ? `${away} ${awayScore} · ${home} ${homeScore}` : undefined, pick: week === 1 ? undefined : index % 2 ? away : home, confidence: 5 - index };
  });
  const preseasonChampionPicks = createPreseasonChampionPicks(players, sport);
  return { version: 1, sport, role, week, seasonLabel: "2026 Foundry Season", generatedAt: Date.now(), players, games, unreadGazette: false, gazetteWeeks: [], ncaaPicks: {}, ncaaResults: {}, ncaaBracketLocked: false, preseasonChampionPicks, postseasonFields: null, tacticalNukeWeeks: [], tacticalNukeActive: false, mapsEvent: null };
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
        madnessPoints: Number(player.madnessPoints) || 0,
        madnessWindowPoints: Number(player.madnessWindowPoints) || 0,
      })),
      gazetteWeeks: Array.isArray(parsed.gazetteWeeks) ? parsed.gazetteWeeks : [],
      ncaaPicks: parsed.ncaaPicks && typeof parsed.ncaaPicks === "object" ? parsed.ncaaPicks : {},
      ncaaResults: parsed.ncaaResults && typeof parsed.ncaaResults === "object" ? parsed.ncaaResults : {},
      ncaaBracketLocked: !!parsed.ncaaBracketLocked,
      preseasonChampionPicks: parsed.preseasonChampionPicks && typeof parsed.preseasonChampionPicks === "object" && Object.keys(parsed.preseasonChampionPicks).length ? parsed.preseasonChampionPicks : createPreseasonChampionPicks(parsed.players, parsed.sport),
      postseasonFields: parsed.postseasonFields && Array.isArray(parsed.postseasonFields.championship) && Array.isArray(parsed.postseasonFields.toilet) ? parsed.postseasonFields : null,
      tacticalNukeWeeks: Array.isArray(parsed.tacticalNukeWeeks)
        ? parsed.tacticalNukeWeeks.filter((week) => Number.isInteger(week) && week > 0).slice(0, 2)
        : [],
      tacticalNukeActive: !!parsed.tacticalNukeActive,
      mapsEvent: parsed.mapsEvent?.protocol === "hellfire" && Number.isInteger(parsed.mapsEvent.authorizationWeek) ? parsed.mapsEvent : null,
    } : null;
  } catch { return null; }
}

export function simulateNextFoundryWeek(state: FoundryWalkthrough): FoundryWalkthrough {
  const nextWeek = Math.min(state.week + 1, foundryFinalWeek(state.sport));
  // A completed season is immutable. Preserve its archive instead of creating
  // a fictional Window 23 / Week 19 when Sim Week is pressed again.
  if (nextWeek === state.week) return state;
  const next = createFoundryWalkthrough(state.sport, nextWeek, state.role);
  const postseasonWindow = state.sport === "cbb" ? foundryNcaaWindowForWeek(nextWeek) : 0;
  const ncaaResults = state.sport === "cbb" ? simulateNcaaResultsThroughWindow(postseasonWindow) : {};
  const players = next.players.map((player, index) => {
    const bracket = player.name === "Mike V" ? state.ncaaPicks || {} : generateNcaaPicks(index + 91);
    const madnessPoints = ncaaScore(bracket, ncaaResults);
    const priorMadnessPoints = ncaaScore(bracket, state.ncaaResults || {});
    return { ...player, madnessPoints, madnessWindowPoints: madnessPoints - priorMadnessPoints, points: player.points + madnessPoints };
  }).sort((a, b) => b.points - a.points);
  return { ...next, players, gazetteWeeks: Array.from(new Set([...(state.gazetteWeeks || []), state.week])).sort((a, b) => a - b), ncaaPicks: state.ncaaPicks || {}, ncaaResults, ncaaBracketLocked: state.ncaaBracketLocked, preseasonChampionPicks: state.preseasonChampionPicks || {}, postseasonFields: state.postseasonFields, tacticalNukeWeeks: state.tacticalNukeWeeks || [], tacticalNukeActive: false, mapsEvent: state.mapsEvent || null, unreadGazette: true };
}

export function simulateFoundrySeason(state: FoundryWalkthrough): FoundryWalkthrough {
  const finalWeek = foundryFinalWeek(state.sport);
  const next = createFoundryWalkthrough(state.sport, finalWeek, state.role);
  const ncaaResults = state.sport === "cbb" ? simulateNcaaResultsThroughWindow(4) : {};
  const players = next.players.map((player, index) => {
    const bracket = player.name === "Mike V" ? state.ncaaPicks || {} : generateNcaaPicks(index + 91);
    const madnessPoints = ncaaScore(bracket, ncaaResults);
    return { ...player, madnessPoints, madnessWindowPoints: madnessPoints, points: player.points + madnessPoints };
  }).sort((a, b) => b.points - a.points);
  return { ...next, players, gazetteWeeks: Array.from({ length: finalWeek }, (_, index) => index + 1), ncaaPicks: state.ncaaPicks || {}, ncaaResults, ncaaBracketLocked: state.ncaaBracketLocked, preseasonChampionPicks: state.preseasonChampionPicks || {}, postseasonFields: state.postseasonFields, tacticalNukeWeeks: state.tacticalNukeWeeks || [], tacticalNukeActive: false, mapsEvent: state.mapsEvent || null, unreadGazette: true };
}

export function simulateFoundryRegularSeason(state: FoundryWalkthrough): FoundryWalkthrough {
  const postseasonWeek = foundryPostseasonStartWeek(state.sport);
  const next = createFoundryWalkthrough(state.sport, postseasonWeek, state.role);
  const fields = FIELDHOUSE_REGIONS.map((region) => {
    const ranked = next.players.filter((player) => player.region === region).sort((a, b) => b.points - a.points);
    const cut = Math.ceil(ranked.length / 2);
    return { championship: ranked.slice(0, cut).map((player) => player.id), toilet: ranked.slice(cut).map((player) => player.id) };
  });
  return {
    ...next,
    gazetteWeeks: Array.from({ length: postseasonWeek }, (_, index) => index + 1),
    ncaaPicks: {},
    ncaaResults: {},
    ncaaBracketLocked: false,
    preseasonChampionPicks: state.preseasonChampionPicks || next.preseasonChampionPicks,
    postseasonFields: {
      championship: fields.flatMap((field) => field.championship),
      toilet: fields.flatMap((field) => field.toilet),
    },
    tacticalNukeWeeks: state.tacticalNukeWeeks || [],
    tacticalNukeActive: false,
    mapsEvent: null,
    unreadGazette: true,
  };
}

export const FOUNDRY_TACTICAL_NUKE_LIMIT = 2;

export function foundryTacticalNukesRemaining(
  state: Pick<FoundryWalkthrough, "tacticalNukeWeeks">
): number {
  return Math.max(0, FOUNDRY_TACTICAL_NUKE_LIMIT - new Set(state.tacticalNukeWeeks || []).size);
}

/**
 * Foundry-only proof of the real regular-season behavior: the targeting
 * computer fills a legal five-card confidence ladder and permanently spends
 * one of two season uses. No cloud writes and no production side effects.
 */
export function armFoundryTacticalNuke(state: FoundryWalkthrough): FoundryWalkthrough {
  if (state.tacticalNukeActive || foundryTacticalNukesRemaining(state) <= 0) return state;
  if (state.week >= foundryPostseasonStartWeek(state.sport)) return state;
  const confidences = [2, 5, 1, 4, 3];
  const games = state.games.map((game, index) => ({
    ...game,
    pick: (hash(state.week + 809, index, 13) % 2 === 0 ? game.away : game.home),
    confidence: confidences[index] || index + 1,
  }));
  return {
    ...state,
    games,
    tacticalNukeWeeks: [...new Set([...(state.tacticalNukeWeeks || []), state.week])].slice(0, FOUNDRY_TACTICAL_NUKE_LIMIT),
    tacticalNukeActive: true,
  };
}

/** Fieldhouse M.A.P.'s proof: preserve any human picks, then replace them with
 * a deterministic complete computer bracket and retain the four primary
 * opening-round strikes for the mandatory reveal. Downstream changes are
 * reported as collateral damage, never hidden. */
export function launchFoundryHellfire(state: FoundryWalkthrough): FoundryWalkthrough {
  if (state.sport !== "cbb" || state.ncaaBracketLocked || state.mapsEvent) return state;
  const originalPicks = { ...state.ncaaPicks };
  const computerPicks = generateNcaaPicks(state.week * 991 + 1776);
  const changed = Object.keys(computerPicks).filter((id) => originalPicks[id] !== computerPicks[id]);
  const openingTargets = changed.filter((id) => id.includes(":r1:")).slice(0, 4);
  const targetIds = [...openingTargets, ...changed.filter((id) => !openingTargets.includes(id))].slice(0, 4);
  return {
    ...state,
    ncaaPicks: computerPicks,
    ncaaBracketLocked: true,
    mapsEvent: { protocol: "hellfire", authorizationWeek: state.week, originalPicks, targetIds, changedCount: changed.length, humanPickCount: Object.keys(originalPicks).length, reviewed: false },
  };
}

/**
 * Resolve the frozen Fieldhouse bracket without ever reseeding. Each matchup
 * uses only the NCAA points earned in that tournament window. A tie advances
 * the player with the better frozen regular-season seed.
 */
export function foundryPostseasonRounds(state: FoundryWalkthrough, competition: "championship" | "toilet"): FoundryPostseasonRounds {
  const field = [...(state.postseasonFields?.[competition] || [])];
  if (state.sport !== "cbb" || field.length < 2) return { field, regionalWinners: [], semifinalWinners: [], champion: null };
  const byId = new Map(state.players.map((player) => [player.id, player]));
  const bracketFor = (id: string) => {
    const player = byId.get(id);
    const playerIndex = Number(id.replace("preview-", ""));
    return player?.name === "Mike V" ? state.ncaaPicks || {} : generateNcaaPicks((Number.isFinite(playerIndex) ? playerIndex : 0) + 91);
  };
  const scoreWindow = (id: string, through: number, prior: number) => {
    const bracket = bracketFor(id);
    return ncaaScore(bracket, simulateNcaaResultsThroughWindow(through)) - ncaaScore(bracket, simulateNcaaResultsThroughWindow(prior));
  };
  const seededWinner = (a: string | undefined, b: string | undefined, through: number, prior: number) => {
    if (!a) return b;
    if (!b) return a;
    const aScore = scoreWindow(a, through, prior);
    const bScore = scoreWindow(b, through, prior);
    return bScore > aScore ? b : a;
  };
  const window = foundryNcaaWindowForWeek(state.week);
  const regionalWinners = window >= 1
    ? Array.from({ length: Math.ceil(field.length / 2) }, (_, index) => seededWinner(field[index * 2], field[index * 2 + 1], 1, 0)).filter((id): id is string => !!id)
    : [];
  const semifinalWinners = window >= 3
    ? [seededWinner(regionalWinners[0], regionalWinners[1], 3, 1), seededWinner(regionalWinners[2], regionalWinners[3], 3, 1)].filter((id): id is string => !!id)
    : [];
  const champion = window >= 4 ? seededWinner(semifinalWinners[0], semifinalWinners[1], 4, 3) || null : null;
  return { field, regionalWinners, semifinalWinners, champion };
}

/** Monday start for each sport's 2026 season window. */
export function foundryWeekStartDate(sport: PreviewSport, week: number): Date {
  const start = sport === "cfb" ? Date.UTC(2026, 7, 24, 16) : sport === "nfl" ? Date.UTC(2026, 8, 7, 16) : Date.UTC(2026, 10, 2, 16);
  return new Date(start + Math.max(0, week - 1) * 7 * 24 * 60 * 60 * 1000);
}

export function setFoundryWalkthroughRole(state: FoundryWalkthrough, role: PreviewRole): FoundryWalkthrough {
  return { ...state, role };
}
