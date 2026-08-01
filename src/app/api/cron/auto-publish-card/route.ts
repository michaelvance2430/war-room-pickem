import { NextRequest, NextResponse } from "next/server";
import { runAutoPublishCards } from "@/lib/auto-publish-card";

/**
 * Auto-publish week cards when commissioner is late.
 *
 * Rule: if no card by 48h before first kickoff → system posts 5 games + prop.
 * Two consecutive auto-posts → gavel to 1st-place human.
 *
 * Vercel cron: every 6 hours (see vercel.json).
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Test: ?force=1&secret=CRON_SECRET  (force skips the 48h wait)
 * Optional: ?leagueId=<uuid> to target one room
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
  const leagueId = req.nextUrl.searchParams.get("leagueId") || undefined;

  try {
    const outcome = await runAutoPublishCards({ force, leagueId });
    const published = outcome.results.filter((r) =>
      r.status.startsWith("published")
    ).length;
    const passed = outcome.results.filter(
      (r) => r.status === "published_and_passed_gavel"
    ).length;

    return NextResponse.json({
      ok: true,
      policy:
        "No card 48h before first kickoff → auto-post 5 games. Two weeks in a row → gavel to 1st place.",
      published,
      gavelPassed: passed,
      ...outcome,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Auto-publish failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
