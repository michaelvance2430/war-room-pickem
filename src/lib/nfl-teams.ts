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

function normNfl(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nicknames / short forms for odds API strings → division lookup */
const NFL_ALIASES: { keys: string[]; division: string }[] = Object.entries(
  NFL_CONFERENCES
).map(([name, division]) => {
  const n = normNfl(name);
  const parts = n.split(" ");
  // Full name + city-ish first word(s) + mascot last word
  const keys = new Set<string>([n]);
  if (parts.length >= 2) {
    keys.add(parts[parts.length - 1]!); // e.g. steelers, falcons
    // multi-word city: "los angeles rams" → also "rams", "la rams"
    if (parts.length >= 3) {
      keys.add(parts.slice(0, -1).join(" "));
      keys.add(parts.slice(-2).join(" "));
    }
  }
  // Common short forms
  if (n.includes("san francisco")) keys.add("49ers").add("niners");
  if (n.includes("new england")) keys.add("patriots").add("pats");
  if (n.includes("green bay")) keys.add("packers");
  if (n.includes("tampa bay")) keys.add("buccaneers").add("bucs");
  if (n.includes("kansas city")) keys.add("chiefs");
  if (n.includes("las vegas")) keys.add("raiders");
  if (n.includes("new orleans")) keys.add("saints");
  if (n.includes("new york giants")) keys.add("giants");
  if (n.includes("new york jets")) keys.add("jets");
  if (n.includes("los angeles rams")) keys.add("rams");
  if (n.includes("los angeles chargers")) keys.add("chargers");
  if (n.includes("washington")) keys.add("commanders");
  return { keys: [...keys], division };
});

/**
 * NFL division for a team name from odds / slate (e.g. "AFC North").
 * Never uses NCAA conference matching.
 */
export function getNflDivision(teamName: string): string | null {
  const exact = NFL_CONFERENCES[teamName as keyof typeof NFL_CONFERENCES];
  if (exact) return exact;
  const n = normNfl(teamName);
  if (!n) return null;
  // Prefer longest key match so "new york jets" beats "jets" ambiguity carefully
  let best: { division: string; len: number } | null = null;
  for (const row of NFL_ALIASES) {
    for (const k of row.keys) {
      if (!k) continue;
      if (n === k || n.includes(k) || k.includes(n)) {
        const len = k.length;
        if (!best || len > best.len) best = { division: row.division, len };
      }
    }
  }
  return best?.division ?? null;
}

/**
 * Short division labels for NFL slate UI, e.g. "NFC South · AFC North".
 * Same-division: "AFC North" once.
 */
export function formatMatchupNflDivisions(away: string, home: string): string {
  const ad = getNflDivision(away);
  const hd = getNflDivision(home);
  if (!ad && !hd) return "";
  if (ad && hd) return ad === hd ? ad : `${ad} · ${hd}`;
  return ad || hd || "";
}
