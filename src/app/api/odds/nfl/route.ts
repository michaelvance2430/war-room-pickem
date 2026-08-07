import { NextResponse } from "next/server";
import { mapOddsApiToGames } from "@/lib/odds";
import {
  filterGamesForWeek,
  weekDateRangeLabel,
  weekDateWindow,
} from "@/lib/season-calendar";
import type { OddsApiGame } from "@/lib/types";
import { scheduleUsageFromRequest } from "@/lib/platform-odds-usage";
import { authenticateApiRequest } from "@/lib/server-api-auth";
import { isAppCreator } from "@/lib/creator";

/**
 * NFL spreads via The Odds API (americanfootball_nfl).
 * Same ODDS_API_KEY as NCAAF. No FBS filter / AP ranks.
 * Optional leagueId is attributed only after server-side membership check.
 */
export async function GET(req: Request) {
  const identity = await authenticateApiRequest(req);
  if (!identity.ok) {
    return NextResponse.json(
      { error: identity.error },
      { status: identity.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  const startedAt = Date.now();
  const endpoint = "/api/odds/nfl";
  const apiKey = (process.env.ODDS_API_KEY || "").trim();

  const { searchParams } = new URL(req.url);
  const dryRun =
    searchParams.get("dryRun") === "1" ||
    searchParams.get("dryRun") === "true";
  const weekRaw = searchParams.get("week");
  const weekNumber =
    weekRaw != null && weekRaw !== ""
      ? parseInt(weekRaw, 10)
      : Number.NaN;
  const filterByWeek = !dryRun && !Number.isNaN(weekNumber);
  const weekForLog = filterByWeek ? weekNumber : null;

  if (dryRun && !isAppCreator(identity.userId)) {
    return NextResponse.json({ error: "Creator only" }, { status: 403 });
  }
  if (filterByWeek && (weekNumber < 1 || weekNumber > 22)) {
    return NextResponse.json({ error: "Invalid NFL week" }, { status: 400 });
  }

  if (!apiKey) {
    scheduleUsageFromRequest({
      req,
      action: "pull_odds",
      sport: "nfl",
      endpoint,
      startedAt,
      remaining: null,
      used: null,
      last: null,
      success: false,
      httpStatus: 503,
      configMissing: true,
      dryRun,
      weekNumber: weekForLog,
    });
    return NextResponse.json(
      {
        error:
          "Odds API key not configured. Add ODDS_API_KEY in Vercel → Settings → Environment Variables, then Redeploy.",
      },
      { status: 503 }
    );
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    const last = res.headers.get("x-requests-last");

    if (!res.ok) {
      const body = await res.text();
      scheduleUsageFromRequest({
        req,
        action: "pull_odds",
        sport: "nfl",
        endpoint,
        startedAt,
        remaining,
        used,
        last,
        success: false,
        httpStatus: res.status,
        bodySnippet: body.slice(0, 200),
        dryRun,
        weekNumber: weekForLog,
      });
      const quota =
        /quota|credit|usage/i.test(body) || remaining === "0"
          ? " Odds API credits may be exhausted for this month — check the-odds-api.com account or upgrade the plan (swap ODDS_API_KEY on Vercel)."
          : "";
      return NextResponse.json(
        {
          error: `Odds API error ${res.status}: ${body.slice(0, 200)}${quota}`,
          remaining,
          used,
          last,
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as OddsApiGame[];
    const rawCount = Array.isArray(data) ? data.length : 0;

    let games = mapOddsApiToGames(data).filter(
      (g) => g.bookmaker && Number.isFinite(g.spread)
    );
    const withLines = games.length;
    const unfilteredCount = games.length;
    let weekLabel: string | null = null;
    let window: { startDate: string; endDate: string } | null = null;
    if (filterByWeek) {
      games = filterGamesForWeek(games, weekNumber, "nfl");
      weekLabel = weekDateRangeLabel(weekNumber, "nfl");
      const w = weekDateWindow(weekNumber, "nfl");
      if (w) window = { startDate: w.startDate, endDate: w.endDate };
    }

    scheduleUsageFromRequest({
      req,
      action: "pull_odds",
      sport: "nfl",
      endpoint,
      startedAt,
      remaining,
      used,
      last,
      success: true,
      httpStatus: res.status,
      dryRun,
      weekNumber: weekForLog,
    });

    return NextResponse.json({
      games,
      count: games.length,
      rawCount,
      withLines,
      unfilteredCount,
      remaining,
      used,
      last,
      rankLabel: "NFL — no AP ranks",
      week: filterByWeek ? weekNumber : null,
      weekLabel,
      window,
      dryRun,
      sport: "nfl",
      filter:
        "NFL (americanfootball_nfl)" +
        (dryRun
          ? " · DRY RUN (all open games, no week date filter)"
          : filterByWeek && weekLabel
            ? ` · kickoffs in ${weekLabel}`
            : ""),
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Failed to reach The Odds API";
    scheduleUsageFromRequest({
      req,
      action: "pull_odds",
      sport: "nfl",
      endpoint,
      startedAt,
      remaining: null,
      used: null,
      last: null,
      success: false,
      httpStatus: 502,
      bodySnippet: msg,
      dryRun,
      weekNumber: weekForLog,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
