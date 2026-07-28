import { NextRequest, NextResponse } from "next/server";
import { runFridayPickNudge } from "@/lib/nudge-picks";

/**
 * Friday noon ET: post "who still needs picks" announcements for leagues
 * that have a published week card in the current CFB window.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *
 * Test: GET /api/cron/nudge-picks?force=1  (with Bearer secret)
 * Vercel Cron: see vercel.json (Fri 16:00 & 17:00 UTC → covers ET noon year-round)
 */
function authorized(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const query = req.nextUrl.searchParams.get("secret") || "";
  return bearer === secret || query === secret;
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
