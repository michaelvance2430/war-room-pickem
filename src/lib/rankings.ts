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

export type ApRankSource = {
  map: Map<string, number>;
  /** e.g. "AP Top 25" */
  name: string;
  /** e.g. "2025 Final Rankings" */
  label: string;
};

/**
 * Fetch current AP Top 25 from ESPN (no API key).
 * Map is keyed by our FBS canonical names (e.g. "Ohio State", "Indiana").
 */
export async function fetchApRankSource(): Promise<ApRankSource> {
  const empty: ApRankSource = {
    map: new Map(),
    name: "AP Top 25",
    label: "unavailable",
  };

  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return empty;

    const data = await res.json();
    const rankings = (data?.rankings || []) as {
      type?: string;
      name?: string;
      shortHeadline?: string;
      headline?: string;
      ranks?: EspnRankEntry[];
    }[];

    // FBS AP only — never FCS / D2 / D3 polls
    const ap =
      rankings.find(
        (r) =>
          r.type === "ap" ||
          (r.name || "").toLowerCase().includes("ap top")
      ) || null;

    if (!ap) return empty;

    const map = new Map<string, number>();

    for (const row of ap.ranks || []) {
      const rank = row.current;
      if (!rank || !row.team) continue;
      const t = row.team;

      // Resolve through the same strict FBS matcher so "Indiana" ≠ "Indiana State"
      const candidates = [
        t.displayName,
        t.location && t.name ? `${t.location} ${t.name}` : null,
        t.location,
        t.nickname,
        t.abbreviation === "LSU" ? "LSU" : null,
        t.abbreviation === "LSU" ? "Louisiana State" : null,
      ].filter(Boolean) as string[];

      let canonical: string | null = null;
      for (const c of candidates) {
        canonical = getFbsCanonicalName(c);
        if (canonical) break;
      }
      if (!canonical && t.location) {
        canonical = getFbsCanonicalName(t.location);
      }
      if (!canonical && t.location) {
        canonical = t.location;
      }

      if (canonical) {
        map.set(canonical.toLowerCase(), rank);
      }
    }

    const label =
      ap.shortHeadline ||
      ap.headline ||
      ap.name ||
      "AP Top 25";

    return { map, name: ap.name || "AP Top 25", label };
  } catch {
    return empty;
  }
}

/** @deprecated use fetchApRankSource — kept for any callers */
export async function fetchApRankMap(): Promise<Map<string, number>> {
  return (await fetchApRankSource()).map;
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
