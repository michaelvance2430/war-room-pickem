import { NextResponse } from "next/server";
import { mapOddsApiToGames } from "@/lib/odds";
import { filterToFbsGames } from "@/lib/fbs-teams";
import { applyApRanks, fetchApRankSource } from "@/lib/rankings";
import {
  filterGamesForWeek,
  weekDateRangeLabel,
  weekDateWindow,
} from "@/lib/season-calendar";
import type { OddsApiGame } from "@/lib/types";

/**
 * Server-side odds fetch so the API key is never exposed in the browser.
 * Optional ?week=N filters kickoffs to that pick'em week’s date window
 * (Week 0 = Aug 29 2026; Week 1 = Sep 3–7; …).
 */
export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const weekRaw = searchParams.get("week");
  const weekNumber =
    weekRaw != null && weekRaw !== ""
      ? parseInt(weekRaw, 10)
      : Number.NaN;
  const filterByWeek = !Number.isNaN(weekNumber);

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
    let rankLabel = "AP ranks unavailable";
    try {
      const source = await fetchApRankSource();
      games = applyApRanks(games, source.map);
      rankLabel = source.label;
    } catch {
      // ignore ranking failures
    }

    const unfilteredCount = games.length;
    let weekLabel: string | null = null;
    let window: { startDate: string; endDate: string } | null = null;
    if (filterByWeek) {
      games = filterGamesForWeek(games, weekNumber);
      weekLabel = weekDateRangeLabel(weekNumber);
      const w = weekDateWindow(weekNumber);
      if (w) window = { startDate: w.startDate, endDate: w.endDate };
    }

    return NextResponse.json({
      games,
      count: games.length,
      rawCount,
      withLines,
      fbsCount,
      unfilteredCount,
      remaining,
      used,
      rankLabel,
      week: filterByWeek ? weekNumber : null,
      weekLabel,
      window,
      filter:
        "NCAA FBS only (SEC, Big Ten, ACC, Big 12, Independents, Group of 5)" +
        (filterByWeek && weekLabel
          ? ` · kickoffs in ${weekLabel}`
          : ""),
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
