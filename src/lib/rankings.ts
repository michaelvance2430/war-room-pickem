import type { Game } from "./types";

type EspnRankEntry = {
  current: number;
  team?: {
    location?: string;
    name?: string;
    nickname?: string;
    abbreviation?: string;
    displayName?: string;
  };
};

/**
 * Fetch current AP Top 25 from ESPN's public rankings endpoint (no API key).
 * Falls back to empty map if the request fails.
 */
export async function fetchApRankMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return map;

    const data = await res.json();
    const rankings = (data?.rankings || []) as {
      type?: string;
      name?: string;
      ranks?: EspnRankEntry[];
    }[];

    // Prefer AP Top 25
    const ap =
      rankings.find(
        (r) =>
          r.type === "ap" ||
          (r.name || "").toLowerCase().includes("ap top")
      ) || rankings[0];

    for (const row of ap?.ranks || []) {
      const rank = row.current;
      if (!rank || !row.team) continue;
      const t = row.team;
      const keys = [
        t.location,
        t.nickname,
        t.name,
        t.abbreviation,
        t.displayName,
        t.location && t.name ? `${t.location} ${t.name}` : null,
        t.location && t.nickname ? `${t.location} ${t.nickname}` : null,
      ];
      for (const k of keys) {
        if (!k) continue;
        map.set(normalizeTeamKey(k), rank);
      }
      // Extra aliases for common Odds API naming
      if (t.location === "Miami") {
        map.set(normalizeTeamKey("Miami Florida"), rank);
        map.set(normalizeTeamKey("Miami FL"), rank);
        map.set(normalizeTeamKey("Miami (FL)"), rank);
      }
      if (t.location === "Ole Miss") {
        map.set(normalizeTeamKey("Mississippi"), rank);
        map.set(normalizeTeamKey("Mississippi Rebels"), rank);
      }
      if (t.location === "Southern California" || t.nickname === "USC") {
        map.set(normalizeTeamKey("USC"), rank);
        map.set(normalizeTeamKey("Southern Cal"), rank);
      }
      if (t.location === "Louisiana State" || t.abbreviation === "LSU") {
        map.set(normalizeTeamKey("LSU"), rank);
        map.set(normalizeTeamKey("Louisiana State"), rank);
      }
    }
  } catch {
    // Rankings are optional — odds still work without them
  }
  return map;
}

function normalizeTeamKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(university|univ|college|the|football|team)\b/g,
      " "
    )
    .replace(
      /\b(bulldogs|tigers|bears|eagles|wildcats|crimson tide|buckeyes|wolverines|sooners|longhorns|ducks|huskies|trojans|fighting irish|gators|volunteers|aggies|rebels|hurricanes|cougars|utes|cavaliers|commodores|hoosiers|spartans|hawkeyes|nittany lions|seminoles|gamecocks|razorbacks|jayhawks|cyclones|red raiders|cowboys|mountaineers|cardinal|cardinals|blue devils|tar heels|wolfpack|orange|boilermakers|badgers|golden gophers|cornhuskers|buffaloes|beavers|cougars)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Look up AP rank for an odds-api team name. */
export function lookupApRank(
  teamName: string,
  rankMap: Map<string, number>
): number | null {
  if (!teamName || rankMap.size === 0) return null;

  const key = normalizeTeamKey(teamName);
  if (rankMap.has(key)) return rankMap.get(key)!;

  // Partial contains match (e.g. "Ohio State Buckeyes" vs "ohio state")
  for (const [k, rank] of rankMap) {
    if (!k) continue;
    if (key.includes(k) || k.includes(key)) return rank;
  }
  return null;
}

/** Attach AP ranks onto games after odds mapping. */
export function applyApRanks(
  games: Game[],
  rankMap: Map<string, number>
): Game[] {
  return games.map((g) => ({
    ...g,
    awayRank: lookupApRank(g.awayTeam, rankMap),
    homeRank: lookupApRank(g.homeTeam, rankMap),
  }));
}

/** Display helper: "#5 Ohio State" or "Ohio State" if unranked. */
export function formatRankedTeam(
  name: string,
  rank?: number | null
): string {
  if (rank && rank >= 1 && rank <= 25) return `#${rank} ${name}`;
  return name;
}
