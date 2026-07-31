/**
 * Sport pack registry — picker order + pack metadata.
 * CFB is the gold-standard live pack; others are shells until implemented.
 */

import {
  DEFAULT_SPORT_ID,
  type SportId,
  type SportPack,
  type SportPickerOption,
} from "./types";

const PACKS: SportPack[] = [
  {
    id: "cfb",
    label: "NCAA D1 FBS (College Football)",
    shortLabel: "CFB",
    emoji: "🏟️",
    blurb: "The gold standard. Saturdays, Toilet Bowl, living history.",
    sortOrder: 1,
    status: "live",
    defaultSeasonWeeks: 18,
    defaultGamesPerWeek: 5,
    pridePickLabel: "National champ (Crystal Ball)",
    rulesOneLiner: "ATS confidence card · Best Bet · prop · Crystal Ball",
  },
  {
    id: "soccer_wwc",
    label: "Women's World Cup",
    shortLabel: "WWC",
    emoji: "🏆",
    blurb: "Event pack — short calendar, big Gazette energy. Live shell on dev.",
    sortOrder: 2,
    status: "live",
    defaultSeasonWeeks: 5,
    defaultGamesPerWeek: 5,
    pridePickLabel: "World Cup winner",
    rulesOneLiner: "Event mode · matchday card · same War Room sass",
  },
  {
    id: "nfl",
    label: "NFL",
    shortLabel: "NFL",
    emoji: "🏈",
    blurb: "Sundays, confidence, Best Bet — same War Room energy.",
    sortOrder: 3,
    status: "coming_soon",
    defaultSeasonWeeks: 18,
    defaultGamesPerWeek: 5,
    pridePickLabel: "Super Bowl champ",
    rulesOneLiner: "ATS confidence card · Best Bet · prop",
  },
  {
    id: "nba",
    label: "NBA",
    shortLabel: "NBA",
    emoji: "🏀",
    blurb: "Nightly board energy. Coming after NFL pack.",
    sortOrder: 4,
    status: "coming_soon",
    defaultSeasonWeeks: 20,
    defaultGamesPerWeek: 5,
    pridePickLabel: "NBA Finals champ",
    rulesOneLiner: "ATS / ML card · Best Bet · prop",
  },
  {
    id: "march_madness",
    label: "March Madness",
    shortLabel: "Madness",
    emoji: "🌪️",
    blurb: "Short-season event mode. Bracket heat.",
    sortOrder: 5,
    status: "coming_soon",
    defaultSeasonWeeks: 6,
    defaultGamesPerWeek: 5,
    pridePickLabel: "National champ",
    rulesOneLiner: "Event pack · high intensity",
  },
  {
    id: "nascar",
    label: "NASCAR",
    shortLabel: "NASCAR",
    emoji: "🏁",
    blurb: "Race weekends. Different card shape — later pack.",
    sortOrder: 6,
    status: "coming_soon",
    defaultSeasonWeeks: 36,
    defaultGamesPerWeek: 1,
    pridePickLabel: "Cup Series champ",
    rulesOneLiner: "Race winner markets (future)",
  },
  {
    id: "mlb",
    label: "MLB Baseball",
    shortLabel: "MLB",
    emoji: "⚾",
    blurb: "Long season grind. Later pack.",
    sortOrder: 7,
    status: "coming_soon",
    defaultSeasonWeeks: 26,
    defaultGamesPerWeek: 5,
    pridePickLabel: "World Series champ",
    rulesOneLiner: "Run line / ML · Best Bet · prop",
  },
  {
    id: "soccer",
    label: "Soccer",
    shortLabel: "Soccer",
    emoji: "⚽",
    blurb: "1X2 + competition setting. Later pack.",
    sortOrder: 8,
    status: "coming_soon",
    defaultSeasonWeeks: 38,
    defaultGamesPerWeek: 5,
    pridePickLabel: "League / cup winner",
    rulesOneLiner: "1X2 markets · competition pick",
  },
];

export function listSportPacks(): SportPack[] {
  return [...PACKS].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Create-league picker: live + coming_soon (hide hidden). */
export function listSportPickerOptions(): SportPickerOption[] {
  return listSportPacks().filter((p) => p.status !== "hidden");
}

export function getSportPack(id: string | null | undefined): SportPack {
  const found = PACKS.find((p) => p.id === id);
  return found || PACKS.find((p) => p.id === DEFAULT_SPORT_ID)!;
}

export function isLiveSport(id: string | null | undefined): boolean {
  return getSportPack(id).status === "live";
}

export function normalizeSportId(raw: unknown): SportId {
  if (typeof raw === "string" && PACKS.some((p) => p.id === raw)) {
    return raw as SportId;
  }
  return DEFAULT_SPORT_ID;
}

export function sportLabel(id: string | null | undefined): string {
  return getSportPack(id).shortLabel;
}
