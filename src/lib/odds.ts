import { Game, OddsApiGame } from "./types";
import { filterGamesForWeek, weekDateRangeLabel } from "./season-calendar";

/**
 * Convert The Odds API response into our Game shape.
 * Uses the first US bookmaker that has a spreads market (usually DraftKings/FanDuel).
 */
export function mapOddsApiToGames(apiGames: OddsApiGame[]): Game[] {
  return apiGames.map((g) => {
    let spread = 0;
    let favorite: "home" | "away" = "home";
    let bookmaker = "";
    let lastUpdate = "";

    for (const book of g.bookmakers) {
      const spreads = book.markets.find((m) => m.key === "spreads");
      if (!spreads) continue;

      const homeOutcome = spreads.outcomes.find((o) => o.name === g.home_team);
      const awayOutcome = spreads.outcomes.find((o) => o.name === g.away_team);

      if (homeOutcome?.point !== undefined) {
        spread = homeOutcome.point; // negative = home favored
        favorite = spread < 0 ? "home" : "away";
        bookmaker = book.title;
        lastUpdate = book.last_update;
        break;
      }
      if (awayOutcome?.point !== undefined) {
        // away point is the opposite sign of home
        spread = -(awayOutcome.point);
        favorite = spread < 0 ? "home" : "away";
        bookmaker = book.title;
        lastUpdate = book.last_update;
        break;
      }
    }

    const start = new Date(g.commence_time);
    const startTime = start.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "America/New_York",
    });

    return {
      id: g.id,
      oddsEventId: g.id,
      awayTeam: g.away_team,
      homeTeam: g.home_team,
      spread,
      favorite,
      startTime,
      commenceTime: g.commence_time,
      bookmaker,
      lastUpdate,
    };
  });
}

export type FootballOddsSport = "cfb" | "nfl";

/**
 * Fetch live football spreads via our server route (keeps API key off the client).
 * `cfb` → NCAAF FBS · `nfl` → NFL
 * Pass pick'em week so results are filtered to that week's date window.
 * Pass dryRun: true to skip date filter and return all open games.
 */
export async function fetchFootballOdds(
  sport: FootballOddsSport,
  weekNumber?: number,
  opts?: { dryRun?: boolean }
): Promise<{
  games: Game[];
  remaining?: string | null;
  used?: string | null;
  last?: string | null;
  rankLabel?: string;
  weekFilter?: string | null;
  unfilteredCount?: number;
  dryRun?: boolean;
  sport: FootballOddsSport;
}> {
  const dryRun = !!opts?.dryRun;
  const params = new URLSearchParams();
  if (!dryRun && weekNumber != null && Number.isFinite(weekNumber)) {
    params.set("week", String(weekNumber));
  }
  if (dryRun) params.set("dryRun", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  const path = sport === "nfl" ? "/api/odds/nfl" : "/api/odds/ncaaf";
  const res = await fetch(`${path}${q}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const rem = (body as { remaining?: string | null }).remaining;
    const err =
      (body as { error?: string }).error || `Odds API error: ${res.status}`;
    const e = new Error(err) as Error & {
      remaining?: string | null;
      used?: string | null;
    };
    e.remaining = rem;
    e.used = (body as { used?: string | null }).used;
    throw e;
  }

  let games = ((body as { games?: Game[] }).games || []) as Game[];
  const unfilteredCount =
    (body as { unfilteredCount?: number }).unfilteredCount ?? games.length;

  // Client-side belt-and-suspenders if API omitted filter (never in dry run)
  if (
    !dryRun &&
    weekNumber != null &&
    Number.isFinite(weekNumber)
  ) {
    games = filterGamesForWeek(games, weekNumber, sport);
  }

  return {
    sport,
    games,
    remaining: (body as { remaining?: string | null }).remaining,
    used: (body as { used?: string | null }).used,
    last: (body as { last?: string | null }).last,
    rankLabel: (body as { rankLabel?: string }).rankLabel,
    weekFilter:
      (body as { weekLabel?: string | null }).weekLabel ||
      (weekNumber != null && !dryRun
        ? weekDateRangeLabel(weekNumber, sport)
        : null),
    unfilteredCount,
    dryRun,
  };
}

/** @deprecated prefer fetchFootballOdds("cfb", …) */
export async function fetchNcaafOdds(
  weekNumber?: number,
  opts?: { dryRun?: boolean }
): Promise<{
  games: Game[];
  remaining?: string | null;
  used?: string | null;
  last?: string | null;
  rankLabel?: string;
  weekFilter?: string | null;
  unfilteredCount?: number;
  dryRun?: boolean;
}> {
  const r = await fetchFootballOdds("cfb", weekNumber, opts);
  return {
    games: r.games,
    remaining: r.remaining,
    used: r.used,
    last: r.last,
    rankLabel: r.rankLabel,
    weekFilter: r.weekFilter,
    unfilteredCount: r.unfilteredCount,
    dryRun: r.dryRun,
  };
}

/** NFL spreads */
export async function fetchNflOdds(
  weekNumber?: number,
  opts?: { dryRun?: boolean }
) {
  return fetchFootballOdds("nfl", weekNumber, opts);
}
