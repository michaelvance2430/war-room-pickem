import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Light = "green" | "yellow" | "red";

type Check = {
  id: string;
  label: string;
  status: Light;
  detail: string;
};

/**
 * Public, non-secret health snapshot for Founder Dashboard.
 * Never returns API keys or tokens.
 */
export async function GET() {
  const checks: Check[] = [];
  const started = Date.now();

  // Website — if this route runs, the deploy is alive
  checks.push({
    id: "website",
    label: "Website",
    status: "green",
    detail: "App route responding",
  });

  // Database
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    checks.push({
      id: "database",
      label: "Database",
      status: "red",
      detail: "Supabase env not configured",
    });
  } else {
    try {
      const sb = createClient(url, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await sb.from("leagues").select("id").limit(1);
      if (error) {
        checks.push({
          id: "database",
          label: "Database",
          status: "red",
          detail: error.message.slice(0, 120),
        });
      } else {
        checks.push({
          id: "database",
          label: "Database",
          status: "green",
          detail: "Supabase reachable",
        });
      }
    } catch (e) {
      checks.push({
        id: "database",
        label: "Database",
        status: "red",
        detail: e instanceof Error ? e.message.slice(0, 120) : "DB ping failed",
      });
    }
  }

  // Email (feedback path configured?)
  const emailReady = !!(
    process.env.RESEND_API_KEY ||
    process.env.WEB3FORMS_ACCESS_KEY ||
    process.env.FEEDBACK_TO_EMAIL
  );
  checks.push({
    id: "email",
    label: "Email",
    status: emailReady ? "green" : "yellow",
    detail: emailReady
      ? "Feedback path configured"
      : "No Resend / Web3Forms / FEEDBACK_TO_EMAIL — feedback may be mailto-only",
  });

  // AI — not a core path yet
  checks.push({
    id: "ai",
    label: "AI",
    status: "yellow",
    detail: "Not required for core play yet",
  });

  // Notifications — cron exists; push not fully productized
  checks.push({
    id: "notifications",
    label: "Notifications",
    status: "yellow",
    detail: "Email/cron nudges exist; push later",
  });

  // Storage
  checks.push({
    id: "storage",
    label: "Storage",
    status: url && anon ? "green" : "yellow",
    detail: url && anon ? "Supabase Storage available" : "No Supabase config",
  });

  // Odds API key present (does not burn a credit)
  const oddsKey = (
    process.env.ODDS_API_KEY ||
    process.env.NEXT_PUBLIC_ODDS_API_KEY ||
    ""
  ).trim();
  checks.push({
    id: "api",
    label: "API (Odds)",
    status: oddsKey.length >= 16 ? "green" : oddsKey ? "yellow" : "red",
    detail:
      oddsKey.length >= 16
        ? "ODDS_API_KEY set"
        : oddsKey
          ? "Key looks short — verify Vercel env"
          : "ODDS_API_KEY missing — card pulls will fail",
  });

  const ms = Date.now() - started;
  const worst = checks.some((c) => c.status === "red")
    ? "red"
    : checks.some((c) => c.status === "yellow")
      ? "yellow"
      : "green";

  return NextResponse.json(
    {
      ok: worst !== "red",
      overall: worst,
      responseMs: ms,
      checks,
      ts: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
