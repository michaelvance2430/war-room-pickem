import { splitCbbTournamentField, type CbbSeasonPhase } from "./cbb-contract";

export type CbbTakeoverId = "charleston" | "players_era" | "maui" | "atlantis";

export type CbbTakeover = {
  id: CbbTakeoverId;
  name: string;
  windowKey: string;
  regularWeek: number;
  bracketGames: number;
};

export const CBB_TAKEOVER_CATALOG: readonly CbbTakeover[] = [
  { id: "charleston", name: "Charleston Classic", windowKey: "nov-early", regularWeek: 2, bracketGames: 6 },
  { id: "players_era", name: "Players Era bracket", windowKey: "thanksgiving", regularWeek: 3, bracketGames: 12 },
  { id: "maui", name: "Maui Invitational", windowKey: "thanksgiving", regularWeek: 3, bracketGames: 12 },
  { id: "atlantis", name: "Battle 4 Atlantis", windowKey: "thanksgiving", regularWeek: 3, bracketGames: 12 },
] as const;

export type CbbSimConfig = {
  playerCount: number;
  regularWeeks: number;
  conferenceChampionPicks: number;
  takeoverIds: CbbTakeoverId[];
};

export type CbbSimStep = {
  id: string;
  phase: CbbSeasonPhase;
  label: string;
  games: number;
  maxPoints: number;
  lockRule: "card" | "per_game" | "ceremony";
  elimination: boolean;
};

export type CbbSimState = {
  config: CbbSimConfig;
  steps: CbbSimStep[];
  cursor: number;
  completed: string[];
};

export function validateCbbSimConfig(config: CbbSimConfig): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(config.playerCount) || config.playerCount < 8 || config.playerCount > 32) {
    errors.push("Player count must be 8–32.");
  }
  if (!Number.isInteger(config.regularWeeks) || config.regularWeeks < 8 || config.regularWeeks > 18) {
    errors.push("Regular season must be 8–18 pick windows.");
  }
  if (config.takeoverIds.length > 3) errors.push("Choose no more than three Tournament Takeovers.");
  const selected = config.takeoverIds.map((id) => CBB_TAKEOVER_CATALOG.find((event) => event.id === id)).filter(Boolean) as CbbTakeover[];
  const windows = selected.map((event) => event.windowKey);
  if (new Set(windows).size !== windows.length) {
    errors.push("Selected tournaments overlap. Choose only one event from each calendar window.");
  }
  return errors;
}

export function buildCbbSimulationPlan(config: CbbSimConfig): CbbSimStep[] {
  const errors = validateCbbSimConfig(config);
  if (errors.length) throw new Error(errors.join(" "));
  const takeovers = new Map(
    config.takeoverIds
      .map((id) => CBB_TAKEOVER_CATALOG.find((event) => event.id === id))
      .filter(Boolean)
      .map((event) => [event!.regularWeek, event!] as const)
  );
  const steps: CbbSimStep[] = [];
  for (let week = 1; week <= config.regularWeeks; week += 1) {
    const event = takeovers.get(week);
    if (event) {
      steps.push({
        id: `takeover-${event.id}`,
        phase: "tournament_takeover",
        label: event.name,
        games: event.bracketGames,
        maxPoints: event.bracketGames + 1 + 3 + 2,
        lockRule: "per_game",
        elimination: false,
      });
    } else {
      steps.push({
        id: `regular-${week}`,
        phase: "regular_season",
        label: `Saturday Slate ${week}`,
        games: 5,
        maxPoints: 17,
        lockRule: "card",
        elimination: false,
      });
    }
  }
  steps.push({
    id: "champ-week",
    phase: "champ_week",
    label: `Champ Week · ${config.conferenceChampionPicks} champion picks`,
    games: config.conferenceChampionPicks,
    maxPoints: config.conferenceChampionPicks * 2 + 2,
    lockRule: "per_game",
    elimination: false,
  });
  steps.push({ id: "selection-show", phase: "selection_show", label: "The Fieldhouse Selection Show", games: 0, maxPoints: 0, lockRule: "ceremony", elimination: false });
  const march: Array<[string, CbbSeasonPhase, string, number, boolean]> = [
    ["first-four", "first_four", "First Four", 4, false],
    ["round-64", "opening_weekend", "Round of 64", 32, false],
    ["round-32", "opening_weekend", "Round of 32 · standings freeze", 16, false],
    ["sweet-16", "sweet_16", "Sweet 16 · War Room brackets begin", 8, true],
    ["elite-eight", "elite_eight", "Elite Eight", 4, true],
    ["final-four", "final_four", "Final Four", 2, true],
    ["national-title", "national_championship", "National Championship", 1, true],
  ];
  for (const [id, phase, label, games, elimination] of march) {
    steps.push({ id, phase, label, games, maxPoints: games + 3, lockRule: "per_game", elimination });
  }
  steps.push({ id: "complete", phase: "season_complete", label: "Hardware and dog tags awarded", games: 0, maxPoints: 0, lockRule: "ceremony", elimination: false });
  return steps;
}

export function createCbbSimState(config: CbbSimConfig): CbbSimState {
  return { config, steps: buildCbbSimulationPlan(config), cursor: 0, completed: [] };
}

export function advanceCbbSim(state: CbbSimState): CbbSimState {
  const current = state.steps[state.cursor];
  if (!current || state.cursor >= state.steps.length - 1) return state;
  return { ...state, cursor: state.cursor + 1, completed: [...state.completed, current.id] };
}

export function cbbSimSnapshot(state: CbbSimState) {
  const step = state.steps[state.cursor]!;
  const split = splitCbbTournamentField(state.config.playerCount);
  return {
    step,
    split,
    progress: `${state.cursor + 1}/${state.steps.length}`,
    remaining: state.steps.length - state.cursor - 1,
    standingsFrozen: state.completed.includes("round-32") || state.cursor > state.steps.findIndex((item) => item.id === "round-32"),
  };
}

