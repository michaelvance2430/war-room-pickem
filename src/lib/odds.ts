import { Game, OddsApiGame } from "./types";

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
 * Configure ODDS_API_KEY on Vercel (or .env.local for local dev).
 * Free key: https://the-odds-api.com
 */
export async function fetchNcaafOdds(): Promise<{
  games: Game[];
  remaining?: string | null;
  used?: string | null;
  rankLabel?: string;
}> {
  const res = await fetch("/api/odds/ncaaf", { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        `Odds API error: ${res.status}`
    );
  }

  return {
    games: ((body as { games?: Game[] }).games || []) as Game[],
    remaining: (body as { remaining?: string | null }).remaining,
    used: (body as { used?: string | null }).used,
    rankLabel: (body as { rankLabel?: string }).rankLabel,
  };
}
