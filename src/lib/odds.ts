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
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    return {
      id: g.id,
      awayTeam: g.away_team,
      homeTeam: g.home_team,
      spread,
      favorite,
      startTime,
      bookmaker,
      lastUpdate,
    };
  });
}

/**
 * Mock NCAAF games with realistic spreads so the UI works without an API key.
 * Replace this with a real fetch when you add your The Odds API key.
 */
export function getMockOddsGames(): Game[] {
  return [
    { id: "mock1", awayTeam: "Georgia", homeTeam: "Clemson", spread: -3.5, favorite: "home", startTime: "Sat 12:00 PM ET", bookmaker: "DraftKings", lastUpdate: new Date().toISOString() },
    { id: "mock2", awayTeam: "Ohio State", homeTeam: "Michigan", spread: 2.5, favorite: "away", startTime: "Sat 3:30 PM ET", bookmaker: "FanDuel", lastUpdate: new Date().toISOString() },
    { id: "mock3", awayTeam: "Texas", homeTeam: "Oklahoma", spread: 6.5, favorite: "away", startTime: "Sat 7:30 PM ET", bookmaker: "DraftKings", lastUpdate: new Date().toISOString() },
    { id: "mock4", awayTeam: "Alabama", homeTeam: "LSU", spread: -1.5, favorite: "home", startTime: "Sat 8:00 PM ET", bookmaker: "BetMGM", lastUpdate: new Date().toISOString() },
    { id: "mock5", awayTeam: "Oregon", homeTeam: "Washington", spread: 4.0, favorite: "away", startTime: "Sat 10:30 PM ET", bookmaker: "FanDuel", lastUpdate: new Date().toISOString() },
    { id: "mock6", awayTeam: "Penn State", homeTeam: "USC", spread: -7.5, favorite: "home", startTime: "Sat 3:30 PM ET", bookmaker: "DraftKings", lastUpdate: new Date().toISOString() },
    { id: "mock7", awayTeam: "Florida", homeTeam: "Tennessee", spread: 3.0, favorite: "away", startTime: "Sat 7:00 PM ET", bookmaker: "Caesars", lastUpdate: new Date().toISOString() },
    { id: "mock8", awayTeam: "Notre Dame", homeTeam: "Miami", spread: -2.5, favorite: "home", startTime: "Sun 2:30 PM ET", bookmaker: "DraftKings", lastUpdate: new Date().toISOString() },
    { id: "mock9", awayTeam: "Utah", homeTeam: "Oregon State", spread: -10.5, favorite: "home", startTime: "Sat 6:00 PM ET", bookmaker: "FanDuel", lastUpdate: new Date().toISOString() },
    { id: "mock10", awayTeam: "Kansas State", homeTeam: "Iowa State", spread: 1.5, favorite: "away", startTime: "Sat 4:00 PM ET", bookmaker: "BetMGM", lastUpdate: new Date().toISOString() },
  ];
}

/**
 * Real fetch from The Odds API.
 * Get a free key at https://the-odds-api.com
 * Then set NEXT_PUBLIC_ODDS_API_KEY in .env.local
 */
export async function fetchNcaafOdds(apiKey: string): Promise<Game[]> {
  const url = new URL("https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Odds API error: ${res.status}`);
  }
  const data: OddsApiGame[] = await res.json();
  return mapOddsApiToGames(data);
}
