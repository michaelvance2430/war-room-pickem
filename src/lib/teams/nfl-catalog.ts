/**
 * Canonical NFL team catalog — stable IDs for favorite-team allegiance.
 * Separate from CFB rows (profile_favorite_teams.sport_id = 'nfl').
 * IDs are durable; display names resolve through this module.
 */

import type { SportId } from "@/lib/sports/types";
import type { CanonicalTeam, TeamColors } from "@/lib/teams/cfb-catalog";

const NEUTRAL: TeamColors = { primary: "#22c55e", secondary: "#0a0a0a" };

type Row = {
  id: string;
  name: string;
  conference: string;
  aliases?: string[];
  primary: string;
  secondary?: string;
};

/** 32 NFL clubs — allegiance catalog only (no logos required). */
const ROWS: Row[] = [
  { id: "nfl-ari", name: "Arizona Cardinals", conference: "NFC West", primary: "#97233F", secondary: "#000000" },
  { id: "nfl-atl", name: "Atlanta Falcons", conference: "NFC South", primary: "#A71930", secondary: "#000000" },
  { id: "nfl-bal", name: "Baltimore Ravens", conference: "AFC North", primary: "#241773", secondary: "#000000" },
  { id: "nfl-buf", name: "Buffalo Bills", conference: "AFC East", primary: "#00338D", secondary: "#C60C30" },
  { id: "nfl-car", name: "Carolina Panthers", conference: "NFC South", primary: "#0085CA", secondary: "#101820" },
  { id: "nfl-chi", name: "Chicago Bears", conference: "NFC North", primary: "#0B162A", secondary: "#C83803" },
  { id: "nfl-cin", name: "Cincinnati Bengals", conference: "AFC North", primary: "#FB4F14", secondary: "#000000" },
  { id: "nfl-cle", name: "Cleveland Browns", conference: "AFC North", primary: "#311D00", secondary: "#FF3C00" },
  { id: "nfl-dal", name: "Dallas Cowboys", conference: "NFC East", primary: "#003594", secondary: "#869397" },
  { id: "nfl-den", name: "Denver Broncos", conference: "AFC West", primary: "#FB4F14", secondary: "#002244" },
  { id: "nfl-det", name: "Detroit Lions", conference: "NFC North", primary: "#0076B6", secondary: "#B0B7BC" },
  { id: "nfl-gb", name: "Green Bay Packers", conference: "NFC North", primary: "#203731", secondary: "#FFB612" },
  { id: "nfl-hou", name: "Houston Texans", conference: "AFC South", primary: "#03202F", secondary: "#A71930" },
  { id: "nfl-ind", name: "Indianapolis Colts", conference: "AFC South", primary: "#002C5F", secondary: "#A2AAAD" },
  { id: "nfl-jax", name: "Jacksonville Jaguars", conference: "AFC South", primary: "#006778", secondary: "#9F792C" },
  { id: "nfl-kc", name: "Kansas City Chiefs", conference: "AFC West", primary: "#E31837", secondary: "#FFB81C" },
  { id: "nfl-lv", name: "Las Vegas Raiders", conference: "AFC West", primary: "#000000", secondary: "#A5ACAF" },
  { id: "nfl-lac", name: "Los Angeles Chargers", conference: "AFC West", primary: "#0080C6", secondary: "#FFC20E" },
  { id: "nfl-lar", name: "Los Angeles Rams", conference: "NFC West", primary: "#003594", secondary: "#FFA300" },
  { id: "nfl-mia", name: "Miami Dolphins", conference: "AFC East", primary: "#008E97", secondary: "#FC4C02" },
  { id: "nfl-min", name: "Minnesota Vikings", conference: "NFC North", primary: "#4F2683", secondary: "#FFC62F" },
  { id: "nfl-ne", name: "New England Patriots", conference: "AFC East", primary: "#002244", secondary: "#C60C30" },
  { id: "nfl-no", name: "New Orleans Saints", conference: "NFC South", primary: "#D3BC8D", secondary: "#101820" },
  { id: "nfl-nyg", name: "New York Giants", conference: "NFC East", primary: "#0B2265", secondary: "#A71930" },
  { id: "nfl-nyj", name: "New York Jets", conference: "AFC East", primary: "#125740", secondary: "#000000" },
  { id: "nfl-phi", name: "Philadelphia Eagles", conference: "NFC East", primary: "#004C54", secondary: "#A5ACAF" },
  { id: "nfl-pit", name: "Pittsburgh Steelers", conference: "AFC North", primary: "#FFB612", secondary: "#101820" },
  { id: "nfl-sf", name: "San Francisco 49ers", conference: "NFC West", primary: "#AA0000", secondary: "#B3995D" },
  { id: "nfl-sea", name: "Seattle Seahawks", conference: "NFC West", primary: "#002244", secondary: "#69BE28" },
  { id: "nfl-tb", name: "Tampa Bay Buccaneers", conference: "NFC South", primary: "#D50A0A", secondary: "#FF7900" },
  { id: "nfl-ten", name: "Tennessee Titans", conference: "AFC South", primary: "#0C2340", secondary: "#4B92DB" },
  { id: "nfl-was", name: "Washington Commanders", conference: "NFC East", primary: "#5A1414", secondary: "#FFB612" },
];

export const NFL_TEAM_CATALOG: readonly CanonicalTeam[] = ROWS.map((r) => ({
  id: r.id,
  sportId: "nfl" as SportId,
  name: r.name,
  conference: r.conference,
  aliases: r.aliases || [
    r.name.toLowerCase(),
    r.name.split(" ").slice(-1)[0]?.toLowerCase() || "",
  ].filter(Boolean),
  colors: {
    primary: r.primary || NEUTRAL.primary,
    secondary: r.secondary,
  },
}));

const byId = new Map(NFL_TEAM_CATALOG.map((t) => [t.id, t]));

export function listNflCatalog(): CanonicalTeam[] {
  return [...NFL_TEAM_CATALOG];
}

export function getNflTeamById(id: string): CanonicalTeam | null {
  return byId.get(id) || null;
}

export function isValidNflTeamId(id: string): boolean {
  return byId.has(id);
}
