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
  /** e.g. "2026 Preseason (ESPN FPI)" */
  label: string;
};

function emptySource(): ApRankSource {
  return { map: new Map(), name: "Rankings", label: "unavailable" };
}

function resolveCanonical(t: {
  location?: string;
  name?: string;
  nickname?: string;
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
}): string | null {
  const candidates = [
    t.displayName,
    t.shortDisplayName,
    t.location && t.name ? `${t.location} ${t.name}` : null,
    t.location,
    t.nickname,
    t.abbreviation === "LSU" ? "LSU" : null,
    t.abbreviation === "LSU" ? "Louisiana State" : null,
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    const canonical = getFbsCanonicalName(c);
    if (canonical) return canonical;
  }
  if (t.location) {
    return getFbsCanonicalName(t.location) || t.location;
  }
  return null;
}

function isStaleFinalPoll(ap: {
  shortHeadline?: string;
  headline?: string;
  season?: { year?: number; type?: { name?: string; type?: number } };
}): boolean {
  const text = `${ap.shortHeadline || ""} ${ap.headline || ""}`.toLowerCase();
  if (text.includes("final")) return true;
  const seasonType = (ap.season?.type?.name || "").toLowerCase();
  if (seasonType.includes("post")) return true;
  // If season year is behind the upcoming CFB year (simple: before August use next year)
  const now = new Date();
  const upcomingYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear(); // season year is fall year
  // CFB season year = year of fall. In July 2026, upcoming is 2026; final 2025 is stale.
  const fallSeasonYear =
    now.getMonth() >= 0 && now.getMonth() <= 6
      ? now.getFullYear()
      : now.getFullYear();
  // Actually: Jan-Jul = still "next fall" prep for that year; Aug-Dec = that year.
  // On July 28 2026, we want 2026 preseason, not 2025 final.
  const targetSeason =
    now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear();
  // Wait: July is month 6 (0-indexed). getMonth() >= 7 means Aug+.
  // For Jan-July of 2026, target season is 2026 (fall).
  // For Aug-Dec 2026, target is 2026.
  // So targetSeason is always current calendar year for CFB... until Jan after bowl season.
  // After final rankings in Jan, still want next season (year) preseason.
  // Rule: if AP season year < current calendar year → stale.
  // If AP is postseason of calendar year - 1 when we're in that calendar year → stale.
  const apYear = ap.season?.year;
  if (apYear != null && apYear < now.getFullYear()) return true;
  // In 2026, AP year 2025 final is stale. In Jan 2027, AP year 2026 final becomes stale for 2027 season.
  if (apYear != null && apYear === now.getFullYear() && text.includes("final"))
    return true;
  void upcomingYear;
  void fallSeasonYear;
  void targetSeason;
  return false;
}

/**
 * Live AP Top 25 when available and current.
 * During offseason (when ESPN only has last year's Final Rankings), use ESPN FPI
 * as preseason-style ranks (LSU, etc. appear correctly).
 */
export async function fetchApRankSource(): Promise<ApRankSource> {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = await res.json();
      const rankings = (data?.rankings || []) as {
        type?: string;
        name?: string;
        shortHeadline?: string;
        headline?: string;
        season?: { year?: number; type?: { name?: string; type?: number } };
        ranks?: EspnRankEntry[];
      }[];

      const ap =
        rankings.find(
          (r) =>
            r.type === "ap" ||
            (r.name || "").toLowerCase().includes("ap top")
        ) || null;

      if (ap?.ranks?.length && !isStaleFinalPoll(ap)) {
        const map = new Map<string, number>();
        for (const row of ap.ranks) {
          const rank = row.current;
          if (!rank || !row.team) continue;
          const canonical = resolveCanonical(row.team);
          if (canonical) map.set(canonical.toLowerCase(), rank);
        }
        if (map.size > 0) {
          return {
            map,
            name: ap.name || "AP Top 25",
            label:
              ap.shortHeadline || ap.headline || ap.name || "AP Top 25",
          };
        }
      }
    }
  } catch {
    // fall through to FPI
  }

  // Offseason / stale final → ESPN FPI preseason order
  return fetchFpiRankSource();
}

/**
 * ESPN Football Power Index (FPI) — good preseason proxy until AP preseason drops.
 * Ordered by FPI strength; top 25 get ranks 1–25.
 */
export async function fetchFpiRankSource(): Promise<ApRankSource> {
  try {
    const res = await fetch(
      "https://site.web.api.espn.com/apis/fitt/v3/sports/football/college-football/powerindex?region=us&lang=en&contentorigin=espn&limit=25",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return emptySource();

    const data = await res.json();
    const teams = (data?.teams || []) as {
      team?: {
        location?: string;
        name?: string;
        nickname?: string;
        abbreviation?: string;
        displayName?: string;
        shortDisplayName?: string;
      };
    }[];

    const map = new Map<string, number>();
    let rank = 1;
    for (const row of teams) {
      if (rank > 25) break;
      if (!row.team) continue;
      const canonical = resolveCanonical(row.team);
      if (!canonical) continue;
      // First occurrence only (FPI list should be unique)
      if (!map.has(canonical.toLowerCase())) {
        map.set(canonical.toLowerCase(), rank);
        rank += 1;
      }
    }

    const year = new Date().getFullYear();
    return {
      map,
      name: "ESPN FPI",
      label: `${year} Preseason (ESPN FPI)`,
    };
  } catch {
    return emptySource();
  }
}

/** @deprecated use fetchApRankSource */
export async function fetchApRankMap(): Promise<Map<string, number>> {
  return (await fetchApRankSource()).map;
}

/** Look up rank only for a confirmed FBS school (strict). */
export function lookupApRank(
  teamName: string,
  rankMap: Map<string, number>
): number | null {
  if (!teamName || rankMap.size === 0) return null;

  const canonical = getFbsCanonicalName(teamName);
  if (!canonical) return null;

  return rankMap.get(canonical.toLowerCase()) ?? null;
}

/** Attach ranks onto games after odds mapping. */
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

/**
 * Both teams ranked → visual heat for card builder + picks.
 * - legendary: both top 10 (gold)
 * - top25: both top 25, but not both top 10 (violet)
 */
export type RankedMatchupTier = "legendary" | "top25";

export function getRankedMatchupTier(
  awayRank?: number | null,
  homeRank?: number | null
): RankedMatchupTier | null {
  const a =
    typeof awayRank === "number" && awayRank >= 1 && awayRank <= 25
      ? awayRank
      : null;
  const b =
    typeof homeRank === "number" && homeRank >= 1 && homeRank <= 25
      ? homeRank
      : null;
  if (a == null || b == null) return null;
  if (a <= 10 && b <= 10) return "legendary";
  return "top25";
}

/** Card / row shell classes for ranked-vs-ranked games. */
export function rankedMatchupShellClass(
  tier: RankedMatchupTier | null,
  opts?: { selected?: boolean; bestBet?: boolean }
): string {
  if (!tier) {
    if (opts?.bestBet) return "border-primary/60 ring-1 ring-primary/30";
    if (opts?.selected) return "border-primary bg-primary/10";
    return "border-border";
  }
  if (tier === "legendary") {
    // Gold / legendary badge energy
    const base =
      "border-amber-400/70 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-yellow-600/5 ring-1 ring-amber-400/45 shadow-[0_0_28px_rgba(234,179,8,0.18)]";
    if (opts?.selected || opts?.bestBet) {
      return `${base} ring-2 ring-amber-300/70`;
    }
    return base;
  }
  // Both top 25 (11–25 band / mixed top-10 + 11–25)
  const base =
    "border-violet-400/55 bg-gradient-to-br from-violet-500/15 via-violet-500/8 to-fuchsia-500/5 ring-1 ring-violet-400/30";
  if (opts?.selected || opts?.bestBet) {
    return `${base} ring-2 ring-violet-300/50`;
  }
  return base;
}

export function rankedMatchupBadge(tier: RankedMatchupTier | null): {
  label: string;
  className: string;
} | null {
  if (tier === "legendary") {
    return {
      label: "TOP 10",
      className:
        "text-[9px] font-extrabold uppercase tracking-wider text-amber-200 bg-amber-400/20 border border-amber-400/50 px-1.5 py-0.5 rounded",
    };
  }
  if (tier === "top25") {
    return {
      label: "TOP 25",
      className:
        "text-[9px] font-extrabold uppercase tracking-wider text-violet-200 bg-violet-500/20 border border-violet-400/45 px-1.5 py-0.5 rounded",
    };
  }
  return null;
}
