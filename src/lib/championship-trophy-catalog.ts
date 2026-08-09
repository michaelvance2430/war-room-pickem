export type ChampionshipTrophySport = "cfb" | "nfl" | "cbb";

export const DEFAULT_CHAMPIONSHIP_TROPHY_BY_SPORT: Record<ChampionshipTrophySport, ChampionshipTrophyId> = {
  cfb: "command_cup",
  nfl: "nfl_sunday_crown",
  cbb: "cbb_busted_bracket",
};
export const DEFAULT_CHAMPIONSHIP_TROPHY_ID = DEFAULT_CHAMPIONSHIP_TROPHY_BY_SPORT.cfb;

export type ChampionshipTrophyId =
  | "command_cup" | "golden_gut" | "the_receipt" | "insufferable_crown" | "brass_football" | "last_one_standing"
  | "nfl_sunday_crown" | "nfl_fourth_and_regret" | "nfl_red_zone_throne" | "nfl_monday_expert" | "nfl_clipboard_destiny" | "nfl_very_legal_football"
  | "cbb_busted_bracket" | "cbb_chalk_goblet" | "cbb_glass_slipper" | "cbb_net_results" | "cbb_full_court_oracle" | "cbb_last_bracket_breathing";

export type ChampionshipTrophyDesign = {
  id: ChampionshipTrophyId;
  sport: ChampionshipTrophySport;
  name: string;
  short: string;
  inscription: string;
  colors: [string, string, string];
};

export const CHAMPIONSHIP_TROPHIES: ChampionshipTrophyDesign[] = [
  { id: "command_cup", sport: "cfb", name: "The Command Cup", short: "Prestige with authority.", inscription: "Unfortunately, they were right more often than everyone else.", colors: ["#fff4bd", "#e2a91f", "#6f4305"] },
  { id: "golden_gut", sport: "cfb", name: "The Golden Gut", short: "Instinct over evidence.", inscription: "No research. No fear. Several deeply concerning guesses.", colors: ["#fff0a8", "#f59e0b", "#7c2d12"] },
  { id: "the_receipt", sport: "cfb", name: "The Receipt", short: "Trash talk, notarized.", inscription: "Every boast has been reviewed and, regrettably, verified.", colors: ["#f8fafc", "#94a3b8", "#334155"] },
  { id: "insufferable_crown", sport: "cfb", name: "The Crown of Insufferability", short: "One full offseason of unbearable behavior.", inscription: "Undisputed. Insufferable. Unfortunately permanent.", colors: ["#fef08a", "#eab308", "#713f12"] },
  { id: "brass_football", sport: "cfb", name: "The Big Brass Football", short: "Heavy, excessive, compensating.", inscription: "Subtlety was eliminated in the first round.", colors: ["#fed7aa", "#b45309", "#431407"] },
  { id: "last_one_standing", sport: "cfb", name: "The Last One Standing", short: "Built from broken brackets.", inscription: "Everyone had a plan. This person remained after the plans died.", colors: ["#fca5a5", "#991b1b", "#1c1917"] },

  { id: "nfl_sunday_crown", sport: "nfl", name: "The Sunday Crown", short: "King until next September.", inscription: "Ruled Sunday, survived Monday, mentioned it every other day.", colors: ["#f8fafc", "#94a3b8", "#172554"] },
  { id: "nfl_fourth_and_regret", sport: "nfl", name: "Fourth & Regret", short: "Bad decisions. Excellent outcome.", inscription: "They went for it. Nobody agreed. Somehow, here we are.", colors: ["#fecaca", "#ef4444", "#450a0a"] },
  { id: "nfl_red_zone_throne", sport: "nfl", name: "The Red Zone Throne", short: "No field goals. No humility.", inscription: "Every visit ended in points and an unsolicited speech.", colors: ["#fee2e2", "#dc2626", "#1f2937"] },
  { id: "nfl_monday_expert", sport: "nfl", name: "The Monday Morning Expert", short: "Perfect analysis, delivered afterward.", inscription: "Knew it all along. Documentation remains suspiciously unavailable.", colors: ["#e0f2fe", "#38bdf8", "#0c4a6e"] },
  { id: "nfl_clipboard_destiny", sport: "nfl", name: "The Clipboard of Destiny", short: "Laminated superiority.", inscription: "The game plan was mostly arrows, circles, and unreasonable confidence.", colors: ["#fef3c7", "#d97706", "#292524"] },
  { id: "nfl_very_legal_football", sport: "nfl", name: "The Very Legal Football", short: "Distinctly shaped. Completely original.", inscription: "Counsel has reviewed this football and asks that you stop staring.", colors: ["#e5e7eb", "#9ca3af", "#111827"] },

  { id: "cbb_busted_bracket", sport: "cbb", name: "The Busted Bracket", short: "Destroyed beautifully.", inscription: "The bracket died Thursday. The champion somehow did not.", colors: ["#ddd6fe", "#8b5cf6", "#2e1065"] },
  { id: "cbb_chalk_goblet", sport: "cbb", name: "The Chalk Goblet", short: "Favorites only. Shame optional.", inscription: "Picked the obvious teams with uncommon and deeply annoying precision.", colors: ["#f8fafc", "#cbd5e1", "#334155"] },
  { id: "cbb_glass_slipper", sport: "cbb", name: "The Glass Slipper", short: "The upset fit.", inscription: "Midnight came. The nonsense kept winning.", colors: ["#cffafe", "#67e8f9", "#155e75"] },
  { id: "cbb_net_results", sport: "cbb", name: "Net Results", short: "Cut it down. Wear the evidence.", inscription: "The picks were messy. The net is not.", colors: ["#dcfce7", "#22c55e", "#14532d"] },
  { id: "cbb_full_court_oracle", sport: "cbb", name: "The Full-Court Oracle", short: "Saw the chaos coming.", inscription: "Predicted forty feet of panic and every deeply avoidable turnover.", colors: ["#fef3c7", "#f97316", "#7c2d12"] },
  { id: "cbb_last_bracket_breathing", sport: "cbb", name: "The Last Bracket Breathing", short: "Technically still alive.", inscription: "Sixty-seven brackets entered. This one still had a pulse.", colors: ["#fce7f3", "#ec4899", "#500724"] },
];

export function championshipTrophiesForSport(sportId?: string | null) {
  const sport: ChampionshipTrophySport = sportId === "nfl" ? "nfl" : sportId === "cbb" ? "cbb" : "cfb";
  return CHAMPIONSHIP_TROPHIES.filter((design) => design.sport === sport);
}

export function getChampionshipTrophyDesign(id?: string | null, sportId?: string | null) {
  const exact = CHAMPIONSHIP_TROPHIES.find((design) => design.id === id);
  if (exact) return exact;
  return championshipTrophiesForSport(sportId)[0];
}
