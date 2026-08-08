import { listCfbCatalog, type CanonicalTeam } from "./cfb-catalog";

// Start with the shared college catalog, then add basketball powers that do not
// sponsor FBS football. IDs stay stable because allegiances are stored by id.
const BASKETBALL_ONLY: CanonicalTeam[] = [
  { sportId: "march_madness", id: "gonzaga", name: "Gonzaga Bulldogs", conference: "WCC", aliases: ["zags", "gonzaga"], colors: { primary: "#002967", secondary: "#c8102e" } },
  { sportId: "march_madness", id: "villanova", name: "Villanova Wildcats", conference: "Big East", aliases: ["nova", "villanova"], colors: { primary: "#003da5", secondary: "#13b5ea" } },
  { sportId: "march_madness", id: "creighton", name: "Creighton Bluejays", conference: "Big East", aliases: ["jays", "creighton"], colors: { primary: "#005ca9", secondary: "#ffffff" } },
  { sportId: "march_madness", id: "marquette", name: "Marquette Golden Eagles", conference: "Big East", aliases: ["marquette"], colors: { primary: "#003366", secondary: "#ffcc00" } },
  { sportId: "march_madness", id: "st-johns", name: "St. John's Red Storm", conference: "Big East", aliases: ["st johns", "red storm"], colors: { primary: "#ba0c2f", secondary: "#ffffff" } },
  { sportId: "march_madness", id: "georgetown", name: "Georgetown Hoyas", conference: "Big East", aliases: ["hoyas", "georgetown"], colors: { primary: "#041e42", secondary: "#8d817b" } },
  { sportId: "march_madness", id: "uconn", name: "UConn Huskies", conference: "Big East", aliases: ["connecticut", "uconn"], colors: { primary: "#000e2f", secondary: "#ffffff" } },
  { sportId: "march_madness", id: "xavier", name: "Xavier Musketeers", conference: "Big East", aliases: ["xavier"], colors: { primary: "#0c2340", secondary: "#9ea2a2" } },
  { sportId: "march_madness", id: "butler", name: "Butler Bulldogs", conference: "Big East", aliases: ["butler"], colors: { primary: "#13294b", secondary: "#ffffff" } },
  { sportId: "march_madness", id: "depaul", name: "DePaul Blue Demons", conference: "Big East", aliases: ["depaul"], colors: { primary: "#005eb8", secondary: "#e4002b" } },
  { sportId: "march_madness", id: "seton-hall", name: "Seton Hall Pirates", conference: "Big East", aliases: ["seton hall"], colors: { primary: "#004488", secondary: "#ffffff" } },
  { sportId: "march_madness", id: "providence", name: "Providence Friars", conference: "Big East", aliases: ["friars", "providence"], colors: { primary: "#000000", secondary: "#8a8d8f" } },
  { sportId: "march_madness", id: "dayton", name: "Dayton Flyers", conference: "Atlantic 10", aliases: ["flyers", "dayton"], colors: { primary: "#ce1141", secondary: "#004b8d" } },
  { sportId: "march_madness", id: "saint-marys", name: "Saint Mary's Gaels", conference: "WCC", aliases: ["st marys", "saint marys", "gaels"], colors: { primary: "#06315b", secondary: "#d80024" } },
  { sportId: "march_madness", id: "vcu", name: "VCU Rams", conference: "Atlantic 10", aliases: ["virginia commonwealth", "vcu"], colors: { primary: "#000000", secondary: "#ffb300" } },
];

const CATALOG = [
  ...listCfbCatalog().map((team) => ({ ...team, sportId: "march_madness" as const })),
  ...BASKETBALL_ONLY,
].filter(
  (team, index, all) => all.findIndex((candidate) => candidate.id === team.id) === index
);

export function listCbbCatalog(): CanonicalTeam[] {
  return CATALOG;
}

export function getCbbTeamById(id: string): CanonicalTeam | null {
  return CATALOG.find((team) => team.id === id) || null;
}

export function isValidCbbTeamId(id: string): boolean {
  return !!getCbbTeamById(id);
}
