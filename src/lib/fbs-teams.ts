/**
 * NCAA FBS (Division I Football Bowl Subdivision) schools only.
 * Used to filter The Odds API so D-II / D-III / FCS / noise never appear.
 *
 * Matching is on normalized name fragments (location + common nicknames).
 */

import type { Game } from "./types";

/** Power conferences + Notre Dame (shown first / labeled). */
export const POWER_CONFERENCES = [
  "SEC",
  "Big Ten",
  "ACC",
  "Big 12",
  "Independent",
] as const;

type PowerConf = (typeof POWER_CONFERENCES)[number] | "Group of 5" | "FBS";

type FbsEntry = {
  /** Canonical short display if we ever need it */
  name: string;
  conference: PowerConf;
  /** Strings that identify this team in odds/ESPN names */
  keys: string[];
};

/**
 * Full FBS roster (2024–2026 alignment-ish). Keys are normalized later.
 * "etc." G5 conferences included so the card isn't only Power 4.
 */
const FBS_TEAMS: FbsEntry[] = [
  // SEC
  { name: "Alabama", conference: "SEC", keys: ["alabama", "crimson tide"] },
  { name: "Arkansas", conference: "SEC", keys: ["arkansas", "razorbacks"] },
  { name: "Auburn", conference: "SEC", keys: ["auburn", "tigers auburn"] },
  { name: "Florida", conference: "SEC", keys: ["florida gators", "florida"] },
  { name: "Georgia", conference: "SEC", keys: ["georgia bulldogs", "georgia"] },
  { name: "Kentucky", conference: "SEC", keys: ["kentucky", "wildcats kentucky"] },
  { name: "LSU", conference: "SEC", keys: ["lsu", "louisiana state"] },
  { name: "Mississippi State", conference: "SEC", keys: ["mississippi state", "miss state"] },
  { name: "Missouri", conference: "SEC", keys: ["missouri", "mizzou"] },
  { name: "Oklahoma", conference: "SEC", keys: ["oklahoma", "sooners"] },
  { name: "Ole Miss", conference: "SEC", keys: ["ole miss", "mississippi rebels"] },
  { name: "South Carolina", conference: "SEC", keys: ["south carolina", "gamecocks"] },
  { name: "Tennessee", conference: "SEC", keys: ["tennessee", "volunteers", "vols"] },
  { name: "Texas", conference: "SEC", keys: ["texas longhorns", "texas"] },
  { name: "Texas A&M", conference: "SEC", keys: ["texas a and m", "texas am", "aggies"] },
  { name: "Vanderbilt", conference: "SEC", keys: ["vanderbilt", "commodores"] },

  // Big Ten
  { name: "Illinois", conference: "Big Ten", keys: ["illinois", "fighting illini"] },
  { name: "Indiana", conference: "Big Ten", keys: ["indiana", "hoosiers"] },
  { name: "Iowa", conference: "Big Ten", keys: ["iowa hawkeyes", "iowa"] },
  { name: "Maryland", conference: "Big Ten", keys: ["maryland", "terrapins"] },
  { name: "Michigan", conference: "Big Ten", keys: ["michigan wolverines", "michigan"] },
  { name: "Michigan State", conference: "Big Ten", keys: ["michigan state", "spartans"] },
  { name: "Minnesota", conference: "Big Ten", keys: ["minnesota", "golden gophers", "gophers"] },
  { name: "Nebraska", conference: "Big Ten", keys: ["nebraska", "cornhuskers", "huskers"] },
  { name: "Northwestern", conference: "Big Ten", keys: ["northwestern", "wildcats northwestern"] },
  { name: "Ohio State", conference: "Big Ten", keys: ["ohio state", "buckeyes"] },
  { name: "Oregon", conference: "Big Ten", keys: ["oregon ducks", "oregon"] },
  { name: "Penn State", conference: "Big Ten", keys: ["penn state", "nittany lions"] },
  { name: "Purdue", conference: "Big Ten", keys: ["purdue", "boilermakers"] },
  { name: "Rutgers", conference: "Big Ten", keys: ["rutgers", "scarlet knights"] },
  { name: "UCLA", conference: "Big Ten", keys: ["ucla", "bruins"] },
  { name: "USC", conference: "Big Ten", keys: ["usc", "southern california", "southern cal", "trojans"] },
  { name: "Washington", conference: "Big Ten", keys: ["washington huskies", "washington"] },
  { name: "Wisconsin", conference: "Big Ten", keys: ["wisconsin", "badgers"] },

  // ACC
  { name: "Boston College", conference: "ACC", keys: ["boston college", "eagles boston"] },
  { name: "California", conference: "ACC", keys: ["california", "cal bears", "golden bears"] },
  { name: "Clemson", conference: "ACC", keys: ["clemson"] },
  { name: "Duke", conference: "ACC", keys: ["duke", "blue devils"] },
  { name: "Florida State", conference: "ACC", keys: ["florida state", "seminoles", "fsu"] },
  { name: "Georgia Tech", conference: "ACC", keys: ["georgia tech", "yellow jackets"] },
  { name: "Louisville", conference: "ACC", keys: ["louisville", "cardinals louisville"] },
  { name: "Miami", conference: "ACC", keys: ["miami florida", "miami fl", "miami hurricanes", "miami"] },
  { name: "NC State", conference: "ACC", keys: ["nc state", "north carolina state", "wolfpack"] },
  { name: "North Carolina", conference: "ACC", keys: ["north carolina", "tar heels", "unc"] },
  { name: "Pittsburgh", conference: "ACC", keys: ["pittsburgh", "pitt", "panthers pitt"] },
  { name: "SMU", conference: "ACC", keys: ["smu", "southern methodist"] },
  { name: "Stanford", conference: "ACC", keys: ["stanford", "cardinal"] },
  { name: "Syracuse", conference: "ACC", keys: ["syracuse", "orange"] },
  { name: "Virginia", conference: "ACC", keys: ["virginia cavaliers", "virginia"] },
  { name: "Virginia Tech", conference: "ACC", keys: ["virginia tech", "hokies"] },
  { name: "Wake Forest", conference: "ACC", keys: ["wake forest", "demon deacons"] },

  // Big 12
  { name: "Arizona", conference: "Big 12", keys: ["arizona wildcats", "arizona"] },
  { name: "Arizona State", conference: "Big 12", keys: ["arizona state", "sun devils"] },
  { name: "Baylor", conference: "Big 12", keys: ["baylor", "bears baylor"] },
  { name: "BYU", conference: "Big 12", keys: ["byu", "brigham young"] },
  { name: "Cincinnati", conference: "Big 12", keys: ["cincinnati", "bearcats"] },
  { name: "Colorado", conference: "Big 12", keys: ["colorado buffaloes", "colorado"] },
  { name: "Houston", conference: "Big 12", keys: ["houston", "cougars houston"] },
  { name: "Iowa State", conference: "Big 12", keys: ["iowa state", "cyclones"] },
  { name: "Kansas", conference: "Big 12", keys: ["kansas jayhawks", "kansas"] },
  { name: "Kansas State", conference: "Big 12", keys: ["kansas state", "wildcats kansas"] },
  { name: "Oklahoma State", conference: "Big 12", keys: ["oklahoma state", "cowboys"] },
  { name: "TCU", conference: "Big 12", keys: ["tcu", "texas christian", "horned frogs"] },
  { name: "Texas Tech", conference: "Big 12", keys: ["texas tech", "red raiders"] },
  { name: "UCF", conference: "Big 12", keys: ["ucf", "central florida", "knights"] },
  { name: "Utah", conference: "Big 12", keys: ["utah utes", "utah"] },
  { name: "West Virginia", conference: "Big 12", keys: ["west virginia", "mountaineers"] },

  // Independents (FBS)
  { name: "Notre Dame", conference: "Independent", keys: ["notre dame", "fighting irish"] },
  { name: "UConn", conference: "Independent", keys: ["uconn", "connecticut", "huskies connecticut"] },
  { name: "UMass", conference: "Independent", keys: ["umass", "massachusetts"] },

  // American (AAC) — Group of 5
  { name: "Army", conference: "Group of 5", keys: ["army", "black knights"] },
  { name: "East Carolina", conference: "Group of 5", keys: ["east carolina", "pirates"] },
  { name: "Florida Atlantic", conference: "Group of 5", keys: ["florida atlantic", "fau", "owls fau"] },
  { name: "Memphis", conference: "Group of 5", keys: ["memphis", "tigers memphis"] },
  { name: "Navy", conference: "Group of 5", keys: ["navy", "midshipmen"] },
  { name: "North Texas", conference: "Group of 5", keys: ["north texas", "mean green"] },
  { name: "Rice", conference: "Group of 5", keys: ["rice", "owls rice"] },
  { name: "South Florida", conference: "Group of 5", keys: ["south florida", "usf", "bulls usf"] },
  { name: "Temple", conference: "Group of 5", keys: ["temple", "owls temple"] },
  { name: "Tulane", conference: "Group of 5", keys: ["tulane", "green wave"] },
  { name: "Tulsa", conference: "Group of 5", keys: ["tulsa", "golden hurricane"] },
  { name: "UTSA", conference: "Group of 5", keys: ["utsa", "texas san antonio", "roadrunners"] },
  { name: "Charlotte", conference: "Group of 5", keys: ["charlotte", "49ers"] },

  // Mountain West
  { name: "Air Force", conference: "Group of 5", keys: ["air force", "falcons air"] },
  { name: "Boise State", conference: "Group of 5", keys: ["boise state", "broncos"] },
  { name: "Colorado State", conference: "Group of 5", keys: ["colorado state", "rams colorado"] },
  { name: "Fresno State", conference: "Group of 5", keys: ["fresno state", "bulldogs fresno"] },
  { name: "Hawaii", conference: "Group of 5", keys: ["hawaii", "rainbow warriors"] },
  { name: "Nevada", conference: "Group of 5", keys: ["nevada", "wolf pack nevada"] },
  { name: "New Mexico", conference: "Group of 5", keys: ["new mexico", "lobos"] },
  { name: "San Diego State", conference: "Group of 5", keys: ["san diego state", "aztecs"] },
  { name: "San Jose State", conference: "Group of 5", keys: ["san jose state", "sjsu", "spartans san jose"] },
  { name: "UNLV", conference: "Group of 5", keys: ["unlv", "rebels unlv"] },
  { name: "Utah State", conference: "Group of 5", keys: ["utah state", "aggies utah"] },
  { name: "Wyoming", conference: "Group of 5", keys: ["wyoming", "cowboys wyoming"] },

  // MAC
  { name: "Akron", conference: "Group of 5", keys: ["akron", "zips"] },
  { name: "Ball State", conference: "Group of 5", keys: ["ball state", "cardinals ball"] },
  { name: "Bowling Green", conference: "Group of 5", keys: ["bowling green", "falcons bowling"] },
  { name: "Buffalo", conference: "Group of 5", keys: ["buffalo", "bulls buffalo"] },
  { name: "Central Michigan", conference: "Group of 5", keys: ["central michigan", "chippewas"] },
  { name: "Eastern Michigan", conference: "Group of 5", keys: ["eastern michigan", "eagles eastern"] },
  { name: "Kent State", conference: "Group of 5", keys: ["kent state", "golden flashes"] },
  { name: "Miami (OH)", conference: "Group of 5", keys: ["miami ohio", "miami oh", "redhawks"] },
  { name: "Northern Illinois", conference: "Group of 5", keys: ["northern illinois", "hiu", "huskies northern"] },
  { name: "Ohio", conference: "Group of 5", keys: ["ohio bobcats", "ohio university"] },
  { name: "Toledo", conference: "Group of 5", keys: ["toledo", "rockets"] },
  { name: "Western Michigan", conference: "Group of 5", keys: ["western michigan", "broncos western"] },

  // Sun Belt
  { name: "Appalachian State", conference: "Group of 5", keys: ["appalachian state", "app state", "mountaineers app"] },
  { name: "Arkansas State", conference: "Group of 5", keys: ["arkansas state", "red wolves"] },
  { name: "Coastal Carolina", conference: "Group of 5", keys: ["coastal carolina", "chanticleers"] },
  { name: "Georgia Southern", conference: "Group of 5", keys: ["georgia southern", "eagles georgia southern"] },
  { name: "Georgia State", conference: "Group of 5", keys: ["georgia state", "panthers georgia state"] },
  { name: "James Madison", conference: "Group of 5", keys: ["james madison", "jmu", "dukes"] },
  { name: "Louisiana", conference: "Group of 5", keys: ["louisiana ragin", "louisiana lafayette", "ul lafayette", "ragin cajuns"] },
  { name: "Marshall", conference: "Group of 5", keys: ["marshall", "thundering herd"] },
  { name: "Old Dominion", conference: "Group of 5", keys: ["old dominion", "monarchs"] },
  { name: "South Alabama", conference: "Group of 5", keys: ["south alabama", "jaguars south"] },
  { name: "Southern Miss", conference: "Group of 5", keys: ["southern miss", "southern mississippi", "golden eagles"] },
  { name: "Texas State", conference: "Group of 5", keys: ["texas state", "bobcats texas"] },
  { name: "Troy", conference: "Group of 5", keys: ["troy", "trojans troy"] },
  { name: "UL Monroe", conference: "Group of 5", keys: ["ul monroe", "louisiana monroe", "warhawks"] },

  // Conference USA
  { name: "FIU", conference: "Group of 5", keys: ["fiu", "florida international"] },
  { name: "Jacksonville State", conference: "Group of 5", keys: ["jacksonville state", "gamecocks jax"] },
  { name: "Kennesaw State", conference: "Group of 5", keys: ["kennesaw state", "owls kennesaw"] },
  { name: "Liberty", conference: "Group of 5", keys: ["liberty", "flames"] },
  { name: "Louisiana Tech", conference: "Group of 5", keys: ["louisiana tech", "bulldogs la tech"] },
  { name: "Middle Tennessee", conference: "Group of 5", keys: ["middle tennessee", "mtsu", "blue raiders"] },
  { name: "New Mexico State", conference: "Group of 5", keys: ["new mexico state", "aggies nmsu"] },
  { name: "Sam Houston", conference: "Group of 5", keys: ["sam houston", "bearkats"] },
  { name: "UTEP", conference: "Group of 5", keys: ["utep", "texas el paso", "miners"] },
  { name: "Western Kentucky", conference: "Group of 5", keys: ["western kentucky", "wku", "hilltoppers"] },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/\(oh\)/g, "ohio")
    .replace(/\(fl\)/g, "florida")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that mean "this is a different school" if they appear after a short key. */
const SCHOOL_MODIFIERS = new Set([
  "state",
  "tech",
  "technological",
  "pine",
  "bluff",
  "central",
  "eastern",
  "western",
  "northern",
  "southern",
  "international",
  "christian",
]);

type Match = { entry: FbsEntry; score: number; key: string };

/**
 * Strict match: key must appear as consecutive whole words at the START of the
 * odds team name. "indiana" matches "Indiana Hoosiers" but NOT "Indiana State".
 * Longer keys always beat shorter ones ("ohio state" > "ohio").
 */
function matchTeam(teamName: string): Match | null {
  const n = normalize(teamName);
  if (!n) return null;
  const nWords = n.split(" ").filter(Boolean);
  if (!nWords.length) return null;

  let best: Match | null = null;

  for (const entry of FBS_TEAMS) {
    for (const rawKey of entry.keys) {
      const key = normalize(rawKey);
      if (!key) continue;
      const kWords = key.split(" ").filter(Boolean);
      if (!kWords.length || kWords.length > nWords.length) continue;

      // Key must be a prefix of the team name as whole words
      let prefixOk = true;
      for (let i = 0; i < kWords.length; i++) {
        if (nWords[i] !== kWords[i]) {
          prefixOk = false;
          break;
        }
      }
      if (!prefixOk) continue;

      // If the school key does not already end with a modifier, reject
      // "Indiana State", "Arkansas Pine Bluff", "Georgia Southern", etc.
      const keyEndsWithModifier = SCHOOL_MODIFIERS.has(kWords[kWords.length - 1]);
      const next = nWords[kWords.length];
      if (next && !keyEndsWithModifier && SCHOOL_MODIFIERS.has(next)) {
        continue;
      }

      // Score: longer, more specific keys win
      const score = 100 + kWords.length * 30 + key.length;
      if (!best || score > best.score) {
        best = { entry, score, key };
      }
    }
  }

  return best;
}

/** Canonical FBS short name for ranking lookup, or null if not FBS. */
export function getFbsCanonicalName(teamName: string): string | null {
  return matchTeam(teamName)?.entry.name ?? null;
}

export function isFbsTeam(teamName: string): boolean {
  return matchTeam(teamName) !== null;
}

export function getTeamConference(teamName: string): PowerConf | null {
  return matchTeam(teamName)?.entry.conference ?? null;
}

const POWER = new Set<string>(["SEC", "Big Ten", "ACC", "Big 12", "Independent"]);

/**
 * Keep only games where BOTH teams are FBS.
 * Sort: Power conference games first, then by kickoff.
 */
export function filterToFbsGames(games: Game[]): Game[] {
  const filtered = games.filter(
    (g) => isFbsTeam(g.awayTeam) && isFbsTeam(g.homeTeam)
  );

  return filtered.sort((a, b) => {
    const aPower =
      (POWER.has(getTeamConference(a.awayTeam) || "") ? 1 : 0) +
      (POWER.has(getTeamConference(a.homeTeam) || "") ? 1 : 0);
    const bPower =
      (POWER.has(getTeamConference(b.awayTeam) || "") ? 1 : 0) +
      (POWER.has(getTeamConference(b.homeTeam) || "") ? 1 : 0);
    if (bPower !== aPower) return bPower - aPower;

    const aRank = (a.awayRank ? 1 : 0) + (a.homeRank ? 1 : 0);
    const bRank = (b.awayRank ? 1 : 0) + (b.homeRank ? 1 : 0);
    if (bRank !== aRank) return bRank - aRank;

    return (a.startTime || "").localeCompare(b.startTime || "");
  });
}

/** Short conf labels for UI, e.g. "SEC @ Big Ten" */
export function formatMatchupConferences(away: string, home: string): string {
  const ac = getTeamConference(away);
  const hc = getTeamConference(home);
  if (!ac && !hc) return "";
  if (ac && hc) return `${ac} · ${hc}`;
  return ac || hc || "";
}
