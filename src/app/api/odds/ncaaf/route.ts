import { NextResponse } from "next/server";
import { mapOddsApiToGames } from "@/lib/odds";
import { filterToFbsGames } from "@/lib/fbs-teams";
import { applyApRanks, fetchApRankMap } from "@/lib/rankings";
import type { OddsApiGame } from "@/lib/types";

/**
 * Server-side odds fetch so the API key is never exposed in the browser.
 * Set ODDS_API_KEY in Vercel (Production + Preview) and restart/redeploy.
 */
export async function GET() {
  // Trim — Vercel paste often includes trailing spaces/newlines → INVALID_KEY
  const apiKey = (
    process.env.ODDS_API_KEY ||
    process.env.NEXT_PUBLIC_ODDS_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Odds API key not configured. Add ODDS_API_KEY in Vercel → Settings → Environment Variables, then Redeploy.",
      },
      { status: 503 }
    );
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds"
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        {
          error: `Odds API error ${res.status}: ${body.slice(0, 200)}`,
          remaining,
          used,
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as OddsApiGame[];
    const rawCount = Array.isArray(data) ? data.length : 0;

    // Keep games with a real spread market
    let games = mapOddsApiToGames(data).filter(
      (g) => g.bookmaker && Number.isFinite(g.spread)
    );
    const withLines = games.length;

    // NCAA FBS only (Power 4 + G5 + independents) — drop FCS/D2/D3/noise
    games = filterToFbsGames(games);
    const fbsCount = games.length;

    // Merge AP Top 25 ranks (best-effort)
    try {
      const rankMap = await fetchApRankMap();
      games = applyApRanks(games, rankMap);
    } catch {
      // ignore ranking failures
    }

    return NextResponse.json({
      games,
      count: games.length,
      rawCount,
      withLines,
      fbsCount,
      remaining,
      used,
      filter:
        "NCAA FBS only (SEC, Big Ten, ACC, Big 12, Independents, Group of 5)",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to reach The Odds API",
      },
      { status: 502 }
    );
  }
}
