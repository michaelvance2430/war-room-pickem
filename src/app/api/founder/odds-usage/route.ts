import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFoundryOwnerUserId } from "@/lib/foundry-owner.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UsageRow = {
  id: string;
  created_at: string;
  league_id: string | null;
  user_id: string | null;
  sport: string | null;
  action: string;
  endpoint: string;
  provider_remaining: number | null;
  provider_used: number | null;
  provider_last_cost: number | null;
  estimated_credit_cost: number;
  success: boolean;
  http_status: number | null;
  error_code: string | null;
  duration_ms: number | null;
  dry_run: boolean;
  week_number: number | null;
};

function serviceClientOrNull() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireCreator(req: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) {
    return { ok: false, status: 401, error: "Missing authorization" };
  }
  const token = m[1].trim();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    return { ok: false, status: 503, error: "Auth not configured" };
  }
  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, error: "Invalid session" };
  }
  if (!isFoundryOwnerUserId(data.user.id)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, userId: data.user.id };
}

function dayKey(iso: string, tz = "America/New_York"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Empty stats — Foundry must not hard-error when telemetry is unconfigured. */
function emptyUsagePayload(opts?: {
  reason?: string;
  migrationRequired?: boolean;
  serviceRoleMissing?: boolean;
}) {
  return {
    ok: true,
    migrationRequired: !!opts?.migrationRequired,
    serviceRoleMissing: !!opts?.serviceRoleMissing,
    telemetryNote:
      opts?.reason ||
      "Platform API usage telemetry is not available yet (empty stats).",
    trackingSince: null,
    timezone: "America/New_York",
    summary: {
      credits_remaining: null,
      credits_used: null,
      last_request_cost: null,
      total_requests: 0,
      pull_odds_requests: 0,
      score_sync_requests: 0,
      failed_requests: 0,
      last_success_at: null,
      last_failure_at: null,
      usage_today_est: 0,
      usage_week_est: 0,
      usage_month_est: 0,
      estimated_credits_window: 0,
    },
    byDay: [] as { date: string; requests: number; estimated: number; failed: number }[],
    byAction: [] as {
      action: string;
      requests: number;
      failed: number;
      estimated: number;
    }[],
    bySport: [] as {
      sport: string;
      requests: number;
      failed: number;
      estimated: number;
    }[],
    leagues: [] as unknown[],
    recentFailures: [] as unknown[],
  };
}

/**
 * Foundry-only platform Odds API usage aggregates.
 * Requires Bearer token for an app creator. Service role reads usage table.
 * Missing service role / table → 200 empty stats (never 503 for telemetry).
 */
export async function GET(req: Request) {
  const gate = await requireCreator(req);
  if (!gate.ok) {
    // Real auth failures only (401/403) — not telemetry init
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const sb = serviceClientOrNull();
    if (!sb) {
      // Production may not set SUPABASE_SERVICE_ROLE_KEY yet
      return NextResponse.json(
        emptyUsagePayload({
          serviceRoleMissing: true,
          reason:
            "Service role not configured on this deployment — empty usage stats. Add SUPABASE_SERVICE_ROLE_KEY in Vercel to enable live aggregates.",
        })
      );
    }

    // Pull recent window for trends (90 days) — full table still small at ops scale
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);

    const { data: rowsRaw, error } = await sb
      .from("platform_odds_api_usage")
      .select(
        "id, created_at, league_id, user_id, sport, action, endpoint, provider_remaining, provider_used, provider_last_cost, estimated_credit_cost, success, http_status, error_code, duration_ms, dry_run, week_number"
      )
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return NextResponse.json(
        emptyUsagePayload({
          migrationRequired: true,
          reason:
            error.message ||
            "platform_odds_api_usage not readable — empty stats until table is available.",
        })
      );
    }

    const rows = (rowsRaw || []) as UsageRow[];

  // Earliest row overall (for honest "Tracking since")
  let trackingSince: string | null = null;
  try {
    const { data: first } = await sb
      .from("platform_odds_api_usage")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    trackingSince = (first as { created_at?: string } | null)?.created_at || null;
  } catch {
    trackingSince = rows.length ? rows[rows.length - 1].created_at : null;
  }

  const now = Date.now();
  const startOfTodayKey = dayKey(new Date().toISOString());
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  let pullOdds = 0;
  let scoreSync = 0;
  let failed = 0;
  let totalEst = 0;
  let usageToday = 0;
  let usageWeek = 0;
  let usageMonth = 0;
  let lastSuccess: string | null = null;
  let lastFailure: string | null = null;
  let latestRemaining: number | null = null;
  let latestUsed: number | null = null;
  let latestLastCost: number | null = null;

  const byDayMap = new Map<string, { requests: number; estimated: number; failed: number }>();
  const byActionMap = new Map<string, { requests: number; failed: number; estimated: number }>();
  const bySportMap = new Map<string, { requests: number; failed: number; estimated: number }>();
  const byLeagueMap = new Map<
    string,
    {
      league_id: string | null;
      pull_odds: number;
      score_sync: number;
      failed: number;
      estimated: number;
      last_use: string | null;
      sport: string | null;
    }
  >();

  for (const r of rows) {
    const est = r.estimated_credit_cost || r.provider_last_cost || 1;
    const t = new Date(r.created_at).getTime();
    const dk = dayKey(r.created_at);
    totalEst += est;
    if (r.action === "pull_odds") pullOdds += 1;
    else if (r.action === "score_sync") scoreSync += 1;
    if (!r.success) failed += 1;
    if (dk === startOfTodayKey) usageToday += est;
    if (t >= weekAgo) usageWeek += est;
    if (t >= monthAgo) usageMonth += est;
    if (r.success && !lastSuccess) lastSuccess = r.created_at;
    if (!r.success && !lastFailure) lastFailure = r.created_at;
    if (latestRemaining == null && r.provider_remaining != null) {
      latestRemaining = r.provider_remaining;
      latestUsed = r.provider_used;
      latestLastCost = r.provider_last_cost;
    }

    const day = byDayMap.get(dk) || { requests: 0, estimated: 0, failed: 0 };
    day.requests += 1;
    day.estimated += est;
    if (!r.success) day.failed += 1;
    byDayMap.set(dk, day);

    const act = byActionMap.get(r.action) || {
      requests: 0,
      failed: 0,
      estimated: 0,
    };
    act.requests += 1;
    act.estimated += est;
    if (!r.success) act.failed += 1;
    byActionMap.set(r.action, act);

    const sportKey = r.sport || "unknown";
    const sp = bySportMap.get(sportKey) || {
      requests: 0,
      failed: 0,
      estimated: 0,
    };
    sp.requests += 1;
    sp.estimated += est;
    if (!r.success) sp.failed += 1;
    bySportMap.set(sportKey, sp);

    const lid = r.league_id || "__unattributed__";
    const lg = byLeagueMap.get(lid) || {
      league_id: r.league_id,
      pull_odds: 0,
      score_sync: 0,
      failed: 0,
      estimated: 0,
      last_use: null,
      sport: r.sport,
    };
    if (r.action === "pull_odds") lg.pull_odds += 1;
    if (r.action === "score_sync") lg.score_sync += 1;
    if (!r.success) lg.failed += 1;
    lg.estimated += est;
    if (!lg.last_use || r.created_at > lg.last_use) lg.last_use = r.created_at;
    if (!lg.sport && r.sport) lg.sport = r.sport;
    byLeagueMap.set(lid, lg);
  }

  // League names
  const leagueIds = [...byLeagueMap.values()]
    .map((x) => x.league_id)
    .filter((id): id is string => !!id);
  const nameById = new Map<string, { name: string; sport_id: string | null }>();
  if (leagueIds.length) {
    const { data: leagues } = await sb
      .from("leagues")
      .select("id, name, sport_id")
      .in("id", leagueIds);
    for (const L of leagues || []) {
      const row = L as { id: string; name: string; sport_id?: string | null };
      nameById.set(row.id, {
        name: row.name,
        sport_id: row.sport_id ?? null,
      });
    }
  }

  const leagues = [...byLeagueMap.values()]
    .map((lg) => {
      const meta = lg.league_id ? nameById.get(lg.league_id) : null;
      return {
        league_id: lg.league_id,
        league_name: meta?.name || (lg.league_id ? lg.league_id.slice(0, 8) : "Unattributed"),
        sport: meta?.sport_id || lg.sport || null,
        pull_odds: lg.pull_odds,
        score_sync: lg.score_sync,
        failed: lg.failed,
        estimated_credits: lg.estimated,
        last_api_use: lg.last_use,
      };
    })
    .sort((a, b) => b.estimated_credits - a.estimated_credits);

  const byDay = [...byDayMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byAction = [...byActionMap.entries()].map(([action, v]) => ({
    action,
    ...v,
  }));
  const bySport = [...bySportMap.entries()].map(([sport, v]) => ({
    sport,
    ...v,
  }));

  const recentFailures = rows
    .filter((r) => !r.success)
    .slice(0, 15)
    .map((r) => ({
      created_at: r.created_at,
      league_id: r.league_id,
      league_name: r.league_id
        ? nameById.get(r.league_id)?.name || r.league_id.slice(0, 8)
        : "Unattributed",
      action: r.action,
      sport: r.sport,
      error_code: r.error_code,
      http_status: r.http_status,
      endpoint: r.endpoint,
    }));

    return NextResponse.json({
      ok: true,
      migrationRequired: false,
      serviceRoleMissing: false,
      trackingSince,
      timezone: "America/New_York",
      summary: {
        credits_remaining: latestRemaining,
        credits_used: latestUsed,
        last_request_cost: latestLastCost,
        total_requests: rows.length,
        pull_odds_requests: pullOdds,
        score_sync_requests: scoreSync,
        failed_requests: failed,
        last_success_at: lastSuccess,
        last_failure_at: lastFailure,
        usage_today_est: usageToday,
        usage_week_est: usageWeek,
        usage_month_est: usageMonth,
        estimated_credits_window: totalEst,
      },
      byDay,
      byAction,
      bySport,
      leagues,
      recentFailures,
    });
  } catch (e) {
    // Never 503 Foundry over telemetry crashes
    return NextResponse.json(
      emptyUsagePayload({
        reason:
          e instanceof Error
            ? e.message
            : "Usage aggregate failed — empty stats.",
      })
    );
  }
}
