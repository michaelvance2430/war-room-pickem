import type { Game } from "./types";
import { getFbsCanonicalName } from "./fbs-teams";

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
 * Fetch current AP Top 25 from ESPN (no API key).
 * Map is keyed by our FBS canonical names (e.g. "Ohio State", "Indiana").
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

      // Resolve through the same strict FBS matcher so "Indiana" ≠ "Indiana State"
      const candidates = [
        t.displayName,
        t.location && t.name ? `${t.location} ${t.name}` : null,
        t.location,
        t.nickname,
      ].filter(Boolean) as string[];

      let canonical: string | null = null;
      for (const c of candidates) {
        canonical = getFbsCanonicalName(c);
        if (canonical) break;
      }
      // Fallback: location often is the school short name
      if (!canonical && t.location) {
        canonical = getFbsCanonicalName(t.location);
      }
      if (!canonical && t.location) {
        // Direct map for ESPN location strings that match our entry.name
        canonical = t.location;
      }

      if (canonical) {
        map.set(canonical.toLowerCase(), rank);
      }
    }
  } catch {
    // optional
  }
  return map;
}

/** Look up AP rank only for a confirmed FBS school (strict). */
export function lookupApRank(
  teamName: string,
  rankMap: Map<string, number>
): number | null {
  if (!teamName || rankMap.size === 0) return null;

  const canonical = getFbsCanonicalName(teamName);
  if (!canonical) return null;

  return rankMap.get(canonical.toLowerCase()) ?? null;
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
