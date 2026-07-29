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

/**
 * Fetch live NCAAF spreads via our server route (keeps API key off the client).
 * Pass pick'em week so results are filtered to that week's date window
 * (Week 0 = Aug 29 2026 only; Week 1 = Sep 3–7; etc.).
 * Pass dryRun: true to skip date filter and return all open FBS games.
 */
export async function fetchNcaafOdds(
  weekNumber?: number,
  opts?: { dryRun?: boolean }
): Promise<{
  games: Game[];
  remaining?: string | null;
  used?: string | null;
  rankLabel?: string;
  weekFilter?: string | null;
  unfilteredCount?: number;
  dryRun?: boolean;
}> {
  const dryRun = !!opts?.dryRun;
  const params = new URLSearchParams();
  if (!dryRun && weekNumber != null && Number.isFinite(weekNumber)) {
    params.set("week", String(weekNumber));
  }
  if (dryRun) params.set("dryRun", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/odds/ncaaf${q}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        `Odds API error: ${res.status}`
    );
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
    games = filterGamesForWeek(games, weekNumber);
  }

  return {
    games,
    remaining: (body as { remaining?: string | null }).remaining,
    used: (body as { used?: string | null }).used,
    rankLabel: (body as { rankLabel?: string }).rankLabel,
    weekFilter: dryRun
      ? "DRY RUN — all open FBS"
      : weekNumber != null
        ? weekDateRangeLabel(weekNumber) || `week ${weekNumber}`
        : null,
    unfilteredCount,
    dryRun,
  };
}
