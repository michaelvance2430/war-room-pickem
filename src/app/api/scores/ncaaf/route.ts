import { NextRequest, NextResponse } from "next/server";
import { scheduleUsageFromRequest } from "@/lib/platform-odds-usage";
import { authenticateApiRequest } from "@/lib/server-api-auth";

/**
 * NCAAF final / live scores from The Odds API.
 * Uses the same ODDS_API_KEY as the odds pull.
 * Completed scores available for games up to ~3 days ago (API limit).
 * Optional leagueId is attributed only after server-side membership check.
 */
export async function GET(req: NextRequest) {
  const identity = await authenticateApiRequest(req);
  if (!identity.ok) {
    return NextResponse.json(
      { error: identity.error },
      { status: identity.status, headers: { "Cache-Control": "no-store" } }
    );
  }
  const startedAt = Date.now();
  const endpoint = "/api/scores/ncaaf";
  const apiKey = (process.env.ODDS_API_KEY || "").trim();

  const requestedDays = Number(req.nextUrl.searchParams.get("daysFrom") || 3);
  if (!Number.isFinite(requestedDays)) {
    return NextResponse.json({ error: "Invalid daysFrom" }, { status: 400 });
  }
  const daysFrom = Math.min(3, Math.max(1, Math.trunc(requestedDays)));

  if (!apiKey) {
    scheduleUsageFromRequest({
      req,
      action: "score_sync",
      sport: "cfb",
      endpoint,
      startedAt,
      remaining: null,
      used: null,
      last: null,
      success: false,
      httpStatus: 503,
      configMissing: true,
    });
    return NextResponse.json(
      {
        error:
          "Odds API key not configured. Set ODDS_API_KEY in Vercel, then Redeploy.",
      },
      { status: 503 }
    );
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/scores"
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(daysFrom));
  url.searchParams.set("dateFormat", "iso");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    const last = res.headers.get("x-requests-last");

    if (!res.ok) {
      const body = await res.text();
      scheduleUsageFromRequest({
        req,
        action: "score_sync",
        sport: "cfb",
        endpoint,
        startedAt,
        remaining,
        used,
        last,
        success: false,
        httpStatus: res.status,
        bodySnippet: body.slice(0, 200),
      });
      return NextResponse.json(
        {
          error: `Scores API error ${res.status}: ${body.slice(0, 200)}`,
          remaining,
          used,
          last,
        },
        { status: res.status }
      );
    }

    const events = await res.json();
    scheduleUsageFromRequest({
      req,
      action: "score_sync",
      sport: "cfb",
      endpoint,
      startedAt,
      remaining,
      used,
      last,
      success: true,
      httpStatus: res.status,
    });
    return NextResponse.json({
      events: Array.isArray(events) ? events : [],
      count: Array.isArray(events) ? events.length : 0,
      daysFrom,
      remaining,
      used,
      last,
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Failed to reach The Odds API scores";
    scheduleUsageFromRequest({
      req,
      action: "score_sync",
      sport: "cfb",
      endpoint,
      startedAt,
      remaining: null,
      used: null,
      last: null,
      success: false,
      httpStatus: 502,
      bodySnippet: msg,
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
