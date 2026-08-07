import { NextRequest, NextResponse } from "next/server";
import { runFridayPickNudge } from "@/lib/nudge-picks";

/**
 * Friday NOON Eastern only — who still needs picks.
 *
 * Vercel Cron is UTC:
 *   Fri 16:00 UTC = 12:00 PM Eastern Daylight (EDT, summer)
 *   Fri 17:00 UTC = 12:00 PM Eastern Standard (EST, winter)
 * Handler only posts when America/New_York hour === 12 on Friday
 * (so a wrong-time fire at e.g. 9pm ET will no-op).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Manual test: send Authorization: Bearer <CRON_SECRET> with ?force=1.
 */
function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return bearer === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const outcome = await runFridayPickNudge({ force });
    return NextResponse.json({
      ok: true,
      target: "Friday 12:00–12:59 America/New_York (noon Eastern)",
      ...outcome,
      at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Nudge failed",
      },
      { status: 500 }
    );
  }
}

// Vercel Cron sends GET; POST also allowed for manual tools
export async function POST(req: NextRequest) {
  return GET(req);
}
