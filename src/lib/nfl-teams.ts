/**
 * NFL team display names for demo slates.
 * Generic full names only — no logos or trademarks beyond common team names used in scores.
 */

export const NFL_TEAM_NAMES = [
  "Arizona Cardinals",
  "Atlanta Falcons",
  "Baltimore Ravens",
  "Buffalo Bills",
  "Carolina Panthers",
  "Chicago Bears",
  "Cincinnati Bengals",
  "Cleveland Browns",
  "Dallas Cowboys",
  "Denver Broncos",
  "Detroit Lions",
  "Green Bay Packers",
  "Houston Texans",
  "Indianapolis Colts",
  "Jacksonville Jaguars",
  "Kansas City Chiefs",
  "Las Vegas Raiders",
  "Los Angeles Chargers",
  "Los Angeles Rams",
  "Miami Dolphins",
  "Minnesota Vikings",
  "New England Patriots",
  "New Orleans Saints",
  "New York Giants",
  "New York Jets",
  "Philadelphia Eagles",
  "Pittsburgh Steelers",
  "San Francisco 49ers",
  "Seattle Seahawks",
  "Tampa Bay Buccaneers",
  "Tennessee Titans",
  "Washington Commanders",
] as const;

export function listNflTeamNames(): string[] {
  return [...NFL_TEAM_NAMES];
}

/** Pride-pick / Crystal Ball list — same shape as FBS (name + conference). */
export type NflPrideTeam = {
  name: string;
  conference: string;
};

const NFL_CONFERENCES: Record<string, string> = {
  "Arizona Cardinals": "NFC West",
  "Atlanta Falcons": "NFC South",
  "Baltimore Ravens": "AFC North",
  "Buffalo Bills": "AFC East",
  "Carolina Panthers": "NFC South",
  "Chicago Bears": "NFC North",
  "Cincinnati Bengals": "AFC North",
  "Cleveland Browns": "AFC North",
  "Dallas Cowboys": "NFC East",
  "Denver Broncos": "AFC West",
  "Detroit Lions": "NFC North",
  "Green Bay Packers": "NFC North",
  "Houston Texans": "AFC South",
  "Indianapolis Colts": "AFC South",
  "Jacksonville Jaguars": "AFC South",
  "Kansas City Chiefs": "AFC West",
  "Las Vegas Raiders": "AFC West",
  "Los Angeles Chargers": "AFC West",
  "Los Angeles Rams": "NFC West",
  "Miami Dolphins": "AFC East",
  "Minnesota Vikings": "NFC North",
  "New England Patriots": "AFC East",
  "New Orleans Saints": "NFC South",
  "New York Giants": "NFC East",
  "New York Jets": "AFC East",
  "Philadelphia Eagles": "NFC East",
  "Pittsburgh Steelers": "AFC North",
  "San Francisco 49ers": "NFC West",
  "Seattle Seahawks": "NFC West",
  "Tampa Bay Buccaneers": "NFC South",
  "Tennessee Titans": "AFC South",
  "Washington Commanders": "NFC East",
};

export function listNflPrideTeams(): NflPrideTeam[] {
  return NFL_TEAM_NAMES.map((name) => ({
    name,
    conference: NFL_CONFERENCES[name] || "NFL",
  }));
}
