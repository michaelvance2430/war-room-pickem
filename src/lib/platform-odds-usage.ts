/**
 * Server-side Odds API usage logging for Foundry platform ops.
 * Never import secrets into client components.
 * Logging must never block or fail the odds/scores response.
 */

import { createClient } from "@supabase/supabase-js";

export type OddsUsageAction = "pull_odds" | "score_sync";
export type OddsUsageSport = "cfb" | "nfl";

export type OddsUsageLogInput = {
  league_id: string | null;
  user_id: string | null;
  sport: OddsUsageSport | null;
  action: OddsUsageAction;
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string | null | undefined): v is string {
  return !!v && UUID_RE.test(v);
}

export function parseProviderInt(
  v: string | null | undefined
): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function classifyOddsErrorCode(opts: {
  success: boolean;
  httpStatus: number | null;
  bodySnippet?: string;
  configMissing?: boolean;
}): string | null {
  if (opts.success) return null;
  if (opts.configMissing) return "config";
  const status = opts.httpStatus;
  const body = (opts.bodySnippet || "").toLowerCase();
  if (/quota|credit|usage/i.test(body) || body.includes("remaining")) {
    return "quota";
  }
  if (status != null && status >= 500) return "upstream_5xx";
  if (status != null && status >= 400) return "upstream_4xx";
  if (status === 0 || status == null) return "network";
  return "error";
}

export function estimatedCostForAction(action: OddsUsageAction): number {
  return action === "score_sync" ? 2 : 1;
}

function serviceClientOrNull() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Fire-and-forget insert. Never throws to caller.
 * Does not delay the provider response path when scheduled without await.
 */
export function scheduleOddsUsageLog(row: OddsUsageLogInput): void {
  void insertOddsUsageLog(row);
}

async function insertOddsUsageLog(row: OddsUsageLogInput): Promise<void> {
  try {
    const sb = serviceClientOrNull();
    if (!sb) return;
    const { error } = await sb.from("platform_odds_api_usage").insert({
      league_id: row.league_id,
      user_id: row.user_id,
      sport: row.sport,
      action: row.action,
      endpoint: row.endpoint,
      provider_remaining: row.provider_remaining,
      provider_used: row.provider_used,
      provider_last_cost: row.provider_last_cost,
      estimated_credit_cost: row.estimated_credit_cost,
      success: row.success,
      http_status: row.http_status,
      error_code: row.error_code,
      duration_ms: row.duration_ms,
      dry_run: row.dry_run,
      week_number: row.week_number,
    });
    if (error) {
      // Swallow — table may not exist until migration is applied
      return;
    }
  } catch {
    /* never fail the request */
  }
}

/**
 * Resolve user + league for logging from Authorization Bearer + claimed leagueId.
 * League id is only accepted after membership check via service role.
 * Never trusts a bare query param alone.
 */
export async function resolveAuthenticatedUsageContext(
  req: Request,
  claimedLeagueId: string | null
): Promise<{ userId: string | null; leagueId: string | null }> {
  try {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m?.[1]) {
      return { userId: null, leagueId: null };
    }
    const token = m[1].trim();
    if (!token) return { userId: null, leagueId: null };

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (!url || !anon) return { userId: null, leagueId: null };

    const userClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data?.user?.id) {
      return { userId: null, leagueId: null };
    }
    const userId = data.user.id;

    if (!isUuid(claimedLeagueId)) {
      return { userId, leagueId: null };
    }

    const sb = serviceClientOrNull();
    if (!sb) return { userId, leagueId: null };

    const { data: mem } = await sb
      .from("memberships")
      .select("league_id")
      .eq("league_id", claimedLeagueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (mem?.league_id) {
      return { userId, leagueId: claimedLeagueId };
    }
    return { userId, leagueId: null };
  } catch {
    return { userId: null, leagueId: null };
  }
}

export function sportFromOddsPath(pathname: string): OddsUsageSport {
  return pathname.includes("/nfl") ? "nfl" : "cfb";
}

export function actionFromOddsPath(pathname: string): OddsUsageAction {
  return pathname.includes("/scores/") ? "score_sync" : "pull_odds";
}

/**
 * Fire-and-forget: resolve auth context + insert usage row.
 * Call after provider response is ready; never await before returning JSON.
 */
export function scheduleUsageFromRequest(opts: {
  req: Request;
  action: OddsUsageAction;
  sport: OddsUsageSport;
  endpoint: string;
  startedAt: number;
  remaining: string | null;
  used: string | null;
  last: string | null;
  success: boolean;
  httpStatus: number | null;
  bodySnippet?: string;
  configMissing?: boolean;
  dryRun?: boolean;
  weekNumber?: number | null;
}): void {
  void (async () => {
    try {
      const claimed =
        new URL(opts.req.url).searchParams.get("leagueId") || null;
      const ctx = await resolveAuthenticatedUsageContext(opts.req, claimed);
      const providerLast = parseProviderInt(opts.last);
      const estimated =
        providerLast != null && providerLast > 0
          ? providerLast
          : estimatedCostForAction(opts.action);
      scheduleOddsUsageLog({
        league_id: ctx.leagueId,
        user_id: ctx.userId,
        sport: opts.sport,
        action: opts.action,
        endpoint: opts.endpoint,
        provider_remaining: parseProviderInt(opts.remaining),
        provider_used: parseProviderInt(opts.used),
        provider_last_cost: providerLast,
        estimated_credit_cost: estimated,
        success: opts.success,
        http_status: opts.httpStatus,
        error_code: classifyOddsErrorCode({
          success: opts.success,
          httpStatus: opts.httpStatus,
          bodySnippet: opts.bodySnippet,
          configMissing: opts.configMissing,
        }),
        duration_ms: Math.max(0, Date.now() - opts.startedAt),
        dry_run: !!opts.dryRun,
        week_number:
          opts.weekNumber != null && Number.isFinite(opts.weekNumber)
            ? opts.weekNumber
            : null,
      });
    } catch {
      /* never throw */
    }
  })();
}
