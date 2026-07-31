import { NextRequest, NextResponse } from "next/server";

/**
 * NFL scores from The Odds API (americanfootball_nfl).
 * Same ODDS_API_KEY as odds pull.
 */
export async function GET(req: NextRequest) {
  const apiKey = (
    process.env.ODDS_API_KEY ||
    process.env.NEXT_PUBLIC_ODDS_API_KEY ||
    ""
  ).trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Odds API key not configured. Set ODDS_API_KEY in Vercel, then Redeploy.",
      },
      { status: 503 }
    );
  }

  const daysFrom = Math.min(
    3,
    Math.max(1, Number(req.nextUrl.searchParams.get("daysFrom") || 3))
  );

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/scores"
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(daysFrom));
  url.searchParams.set("dateFormat", "iso");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    const last = res.headers.get("x-requests-last");

    if (!res.ok) {
      const body = await res.text();
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
    return NextResponse.json({
      events: Array.isArray(events) ? events : [],
      count: Array.isArray(events) ? events.length : 0,
      daysFrom,
      remaining,
      used,
      last,
      sport: "nfl",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to reach The Odds API scores",
      },
      { status: 502 }
    );
  }
}
