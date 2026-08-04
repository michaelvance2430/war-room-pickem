import fs from "fs";

const src = fs.readFileSync("src/lib/fbs-teams.ts", "utf8");
const re =
  /\{\s*name:\s*"([^"]+)",\s*conference:\s*"([^"]+)",\s*keys:\s*\[([^\]]+)\]\s*\}/g;
const teams = [];
let m;
while ((m = re.exec(src))) {
  const name = m[1];
  const conference = m[2];
  const aliases = [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  let id = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(oh\)/gi, "oh")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const specials = {
    "texas-aandm": "texas-am",
    "miami-oh": "miami-oh",
  };
  if (specials[id]) id = specials[id];
  teams.push({ id, name, conference, aliases });
}

// Curated primary colors (hex) — restrained, not full brand kits
const COLORS = {
  alabama: { primary: "#9E1B32", secondary: "#FFFFFF" },
  auburn: { primary: "#0C2340", secondary: "#E87722" },
  florida: { primary: "#0021A5", secondary: "#FA4616" },
  georgia: { primary: "#BA0C2F", secondary: "#000000" },
  lsu: { primary: "#461D7C", secondary: "#FDD023" },
  oklahoma: { primary: "#841617", secondary: "#FDF9D8" },
  "ole-miss": { primary: "#CE1126", secondary: "#14213D" },
  tennessee: { primary: "#FF8200", secondary: "#FFFFFF" },
  texas: { primary: "#BF5700", secondary: "#FFFFFF" },
  "texas-am": { primary: "#500000", secondary: "#FFFFFF" },
  michigan: { primary: "#00274C", secondary: "#FFCB05" },
  "ohio-state": { primary: "#BB0000", secondary: "#666666" },
  "penn-state": { primary: "#041E42", secondary: "#FFFFFF" },
  oregon: { primary: "#154733", secondary: "#FEE123" },
  "notre-dame": { primary: "#0C2340", secondary: "#C99700" },
  clemson: { primary: "#F56600", secondary: "#522D80" },
  "florida-state": { primary: "#782F40", secondary: "#CEB888" },
  miami: { primary: "#F47321", secondary: "#005030" },
  "usc": { primary: "#990000", secondary: "#FFC72C" },
  ucla: { primary: "#2D68C4", secondary: "#F2A900" },
  washington: { primary: "#4B2E83", secondary: "#B7A57A" },
  wisconsin: { primary: "#C5050C", secondary: "#FFFFFF" },
  "iowa": { primary: "#FFCD00", secondary: "#000000" },
  nebraska: { primary: "#E41C38", secondary: "#FFFFFF" },
  "michigan-state": { primary: "#18453B", secondary: "#FFFFFF" },
  "north-carolina": { primary: "#7BAFD4", secondary: "#13294B" },
  duke: { primary: "#003087", secondary: "#FFFFFF" },
  "virginia-tech": { primary: "#630031", secondary: "#CF4420" },
  baylor: { primary: "#154734", secondary: "#FFB81C" },
  "kansas-state": { primary: "#512888", secondary: "#FFFFFF" },
  "oklahoma-state": { primary: "#FF7300", secondary: "#000000" },
  "texas-tech": { primary: "#CC0000", secondary: "#000000" },
  utah: { primary: "#CC0000", secondary: "#FFFFFF" },
  "boise-state": { primary: "#0033A0", secondary: "#D64309" },
  "cincinnati": { primary: "#E00122", secondary: "#000000" },
  "louisville": { primary: "#AD0000", secondary: "#000000" },
  "pittsburgh": { primary: "#003594", secondary: "#FFB81C" },
  "west-virginia": { primary: "#002855", secondary: "#EAAA00" },
  arkansas: { primary: "#9D2235", secondary: "#FFFFFF" },
  missouri: { primary: "#F1B82D", secondary: "#000000" },
  kentucky: { primary: "#0033A0", secondary: "#FFFFFF" },
  "south-carolina": { primary: "#73000A", secondary: "#000000" },
  vanderbilt: { primary: "#866D4B", secondary: "#000000" },
  "mississippi-state": { primary: "#660000", secondary: "#FFFFFF" },
  illinois: { primary: "#E84A27", secondary: "#13294B" },
  indiana: { primary: "#990000", secondary: "#FFFFFF" },
  maryland: { primary: "#E03A3E", secondary: "#FFD520" },
  minnesota: { primary: "#7A0019", secondary: "#FFCC33" },
  northwestern: { primary: "#4E2A84", secondary: "#FFFFFF" },
  purdue: { primary: "#CEB888", secondary: "#000000" },
  rutgers: { primary: "#CC0033", secondary: "#FFFFFF" },
  "boston-college": { primary: "#98002E", secondary: "#BC9B6A" },
  california: { primary: "#003262", secondary: "#FDB515" },
  "georgia-tech": { primary: "#B3A369", secondary: "#003057" },
  "nc-state": { primary: "#CC0000", secondary: "#FFFFFF" },
  smu: { primary: "#C8102E", secondary: "#0033A0" },
  stanford: { primary: "#8C1515", secondary: "#FFFFFF" },
  syracuse: { primary: "#F76900", secondary: "#000E54" },
  virginia: { primary: "#232D4B", secondary: "#F84C1E" },
  "wake-forest": { primary: "#9E7E38", secondary: "#000000" },
  arizona: { primary: "#CC0033", secondary: "#003366" },
  "arizona-state": { primary: "#8C1D40", secondary: "#FFC627" },
  byu: { primary: "#002E5D", secondary: "#FFFFFF" },
  colorado: { primary: "#CFB87C", secondary: "#000000" },
  houston: { primary: "#C8102E", secondary: "#FFFFFF" },
  "iowa-state": { primary: "#C8102E", secondary: "#F1BE48" },
  kansas: { primary: "#0051BA", secondary: "#E8000D" },
  tcu: { primary: "#4D1979", secondary: "#A3A9AC" },
  ucf: { primary: "#BA9B37", secondary: "#000000" },
  uconn: { primary: "#000E2F", secondary: "#FFFFFF" },
  army: { primary: "#D4BF91", secondary: "#000000" },
  navy: { primary: "#00205B", secondary: "#C5B783" },
  memphis: { primary: "#003087", secondary: "#898D8D" },
  tulane: { primary: "#006747", secondary: "#418FDE" },
  "air-force": { primary: "#0033A0", secondary: "#8A8D8F" },
  "fresno-state": { primary: "#DB0032", secondary: "#002E6D" },
  "san-diego-state": { primary: "#A89968", secondary: "#000000" },
  unlv: { primary: "#CF0A2C", secondary: "#B3B5B8" },
  appalachian: { primary: "#000000", secondary: "#FFCC00" }, // wrong id
};

// fix app state id
COLORS["appalachian-state"] = { primary: "#000000", secondary: "#FFCC00" };

const NEUTRAL = { primary: "#22c55e", secondary: "#0a0a0a" };

const lines = [];
lines.push(`/**
 * Canonical CFB team catalog — stable IDs for favorite-team allegiance.
 * IDs are durable; display names/colors resolve through this module.
 * Generated from FBS roster; IDs are fixed explicit fields (not runtime renames).
 */
`);
lines.push(`import type { SportId } from "@/lib/sports/types";`);
lines.push(``);
lines.push(`export type TeamColors = { primary: string; secondary?: string };`);
lines.push(``);
lines.push(`export type CanonicalTeam = {
  id: string;
  sportId: SportId;
  name: string;
  conference: string;
  /** Odds / card name match fragments */
  aliases: string[];
  colors: TeamColors;
};`);
lines.push(``);
lines.push(`const NEUTRAL: TeamColors = { primary: "#22c55e", secondary: "#0a0a0a" };`);
lines.push(``);
lines.push(`/** Explicit CFB catalog — store only \`id\` in the database. */`);
lines.push(`export const CFB_TEAM_CATALOG: readonly CanonicalTeam[] = [`);

for (const t of teams) {
  const c = COLORS[t.id] || NEUTRAL;
  const colorLit =
    c === NEUTRAL
      ? "NEUTRAL"
      : `{ primary: "${c.primary}", secondary: "${c.secondary}" }`;
  const aliasLit = t.aliases.map((a) => JSON.stringify(a)).join(", ");
  lines.push(`  {
    id: ${JSON.stringify(t.id)},
    sportId: "cfb",
    name: ${JSON.stringify(t.name)},
    conference: ${JSON.stringify(t.conference)},
    aliases: [${aliasLit}],
    colors: ${colorLit},
  },`);
}
lines.push(`] as const;`);
lines.push(``);
lines.push(`const BY_ID = new Map(CFB_TEAM_CATALOG.map((t) => [t.id, t]));`);
lines.push(``);
lines.push(`export function listCfbCatalog(): CanonicalTeam[] {
  return [...CFB_TEAM_CATALOG].sort((a, b) => a.name.localeCompare(b.name));
}`);
lines.push(``);
lines.push(`export function getCfbTeamById(id: string | null | undefined): CanonicalTeam | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}`);
lines.push(``);
lines.push(`export function isValidCfbTeamId(id: string): boolean {
  return BY_ID.has(id);
}`);
lines.push(``);
lines.push(`/**
 * Confident match of a card/odds team name to catalog.
 * Requires a solid alias or name hit — partial uncertain matches return null.
 */
export function matchCfbTeamConfident(rawName: string): CanonicalTeam | null {
  const n = normalize(rawName);
  if (!n || n.length < 3) return null;
  let best: { team: CanonicalTeam; score: number } | null = null;
  for (const t of CFB_TEAM_CATALOG) {
    const candidates = [t.name, ...t.aliases];
    for (const c of candidates) {
      const k = normalize(c);
      if (!k) continue;
      if (n === k) {
        const score = 1000 + k.length;
        if (!best || score > best.score) best = { team: t, score };
        continue;
      }
      // whole-word / full-phrase containment only for longer keys
      if (k.length >= 5 && (n.includes(k) || k.includes(n))) {
        // reject weak short containment like "miami" alone vs miami-oh
        if (k.length < 6 && n !== k) continue;
        const score = 100 + k.length;
        if (!best || score > best.score) best = { team: t, score };
      }
    }
  }
  // Require high confidence
  if (!best || best.score < 105) return null;
  return best.team;
}`);
lines.push(``);
lines.push(`function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\./g, "")
    .replace(/&/g, "and")
    .replace(/\\(oh\\)/g, "ohio")
    .replace(/[^a-z0-9\\s]/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}`);
lines.push(``);

fs.mkdirSync("src/lib/teams", { recursive: true });
fs.writeFileSync("src/lib/teams/cfb-catalog.ts", lines.join("\n"));
console.log("wrote", teams.length, "teams");
