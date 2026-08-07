export const DEFAULT_CHAMPIONSHIP_TROPHY_ID = "command_cup";

export type ChampionshipTrophyId =
  | "command_cup"
  | "golden_gut"
  | "the_receipt"
  | "insufferable_crown"
  | "brass_football"
  | "last_one_standing";

export type ChampionshipTrophyDesign = {
  id: ChampionshipTrophyId;
  name: string;
  short: string;
  inscription: string;
  colors: [string, string, string];
};

export const CHAMPIONSHIP_TROPHIES: ChampionshipTrophyDesign[] = [
  { id: "command_cup", name: "The Command Cup", short: "Prestige with authority.", inscription: "Unfortunately, they were right more often than everyone else.", colors: ["#fff4bd", "#e2a91f", "#6f4305"] },
  { id: "golden_gut", name: "The Golden Gut", short: "Instinct over evidence.", inscription: "No research. No fear. Several deeply concerning guesses.", colors: ["#fff0a8", "#f59e0b", "#7c2d12"] },
  { id: "the_receipt", name: "The Receipt", short: "Trash talk, notarized.", inscription: "Every boast has been reviewed and, regrettably, verified.", colors: ["#f8fafc", "#94a3b8", "#334155"] },
  { id: "insufferable_crown", name: "The Crown of Insufferability", short: "One full offseason of unbearable behavior.", inscription: "Undisputed. Insufferable. Unfortunately permanent.", colors: ["#fef08a", "#eab308", "#713f12"] },
  { id: "brass_football", name: "The Big Brass Football", short: "Heavy, excessive, compensating.", inscription: "Subtlety was eliminated in the first round.", colors: ["#fed7aa", "#b45309", "#431407"] },
  { id: "last_one_standing", name: "The Last One Standing", short: "Built from broken brackets.", inscription: "Everyone had a plan. This person remained after the plans died.", colors: ["#fca5a5", "#991b1b", "#1c1917"] },
];

export function getChampionshipTrophyDesign(id?: string | null) {
  return CHAMPIONSHIP_TROPHIES.find((design) => design.id === id) || CHAMPIONSHIP_TROPHIES[0];
}
