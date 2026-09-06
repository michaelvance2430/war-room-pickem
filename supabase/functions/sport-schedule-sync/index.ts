import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  earliestEligibleEvent,
  eligibleEventsForWindow,
  providerSportKey,
  type ScheduleEvent,
} from "../_shared/sport-schedule.ts";

type CardWindow = {
  sport_id: "cfb" | "nfl" | "ncaam" | "ncaaw";
  season_key: number;
  week_number: number;
  window_starts_at: string;
  window_ends_at: string;
  first_game_at: string;
  timing_status: "estimated" | "official";
};

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const numericHeader = (value: string | null) => value == null || value === "" ? null : Number(value);

function serviceHeaders(secret: string, prefer?: string) {
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function authorizeWorker(baseURL: string, secret: string, workerSecret: string) {
  const response = await fetch(`${baseURL}/rest/v1/rpc/authorize_sport_schedule_worker`, {
    method: "POST",
    headers: serviceHeaders(secret),
    body: JSON.stringify({ p_secret: workerSecret }),
  });
  if (!response.ok) throw new Error(`Schedule worker authorization RPC returned ${response.status}`);
  const authorized = await response.json();
  return authorized === true;
}

async function loadCandidateWindows(baseURL: string, secret: string): Promise<CardWindow[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 120 * 86_400_000);
  const query = new URLSearchParams({
    select: "sport_id,season_key,week_number,window_starts_at,window_ends_at,first_game_at,timing_status",
    order: "sport_id.asc,window_starts_at.asc",
  });
  // Never rewrite a product week after its boundary begins. Completed games
  // leave the provider's pre-match feed and could otherwise make a later
  // game look like the week's first game.
  query.append("window_starts_at", `gt.${now.toISOString()}`);
  query.append("window_starts_at", `lte.${horizon.toISOString()}`);
  const response = await fetch(`${baseURL}/rest/v1/sport_card_windows?${query}`, {
    headers: serviceHeaders(secret),
  });
  if (!response.ok) throw new Error(`Card-window query returned ${response.status}`);
  return await response.json();
}

async function recordScheduleScan(
  baseURL: string,
  secret: string,
  sport: string,
  provider: Response,
  startedAt: number,
) {
  const auditResponse = await fetch(`${baseURL}/rest/v1/platform_odds_api_usage`, {
    method: "POST",
    headers: serviceHeaders(secret, "return=minimal"),
    body: JSON.stringify({
      league_id: null,
      user_id: null,
      sport,
      action: "schedule_sync",
      endpoint: `/events/${providerSportKey(sport)}`,
      provider_remaining: numericHeader(provider.headers.get("x-requests-remaining")),
      provider_used: numericHeader(provider.headers.get("x-requests-used")),
      provider_last_cost: numericHeader(provider.headers.get("x-requests-last")),
      estimated_credit_cost: 0,
      success: provider.ok,
      http_status: provider.status,
      error_code: provider.ok ? null : `Events provider ${sport} returned ${provider.status}`,
      duration_ms: Date.now() - startedAt,
      dry_run: false,
    }),
  });
  if (!auditResponse.ok) throw new Error(`Schedule usage audit returned ${auditResponse.status}`);
}

async function updateWindow(
  baseURL: string,
  secret: string,
  window: CardWindow,
  events: ScheduleEvent[],
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    last_ingested_at: now,
    provider_event_count: events.length,
    updated_at: now,
  };
  if (events.length) {
    const first = earliestEligibleEvent(
      window.sport_id,
      events,
      window.window_starts_at,
      window.window_ends_at,
    );
    if (!first) throw new Error(`${window.sport_id} Week ${window.week_number} has no eligible event`);
    patch.first_game_at = first.commence_time;
    patch.timing_status = "official";
    patch.source_note = `The Odds API /events · ${providerSportKey(window.sport_id)} · earliest event ${first.id}`;
  }
  const query = new URLSearchParams({
    sport_id: `eq.${window.sport_id}`,
    season_key: `eq.${window.season_key}`,
    week_number: `eq.${window.week_number}`,
  });
  const response = await fetch(`${baseURL}/rest/v1/sport_card_windows?${query}`, {
    method: "PATCH",
    headers: serviceHeaders(secret, "return=minimal"),
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`${window.sport_id} Week ${window.week_number} update returned ${response.status}`);
  return events.length > 0;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "POST required" }, { status: 405 });
  }
  try {
    const baseURL = required("SUPABASE_URL");
    const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
    const workerSecret = request.headers.get("x-war-room-cron-secret")?.trim() || "";
    if (!await authorizeWorker(baseURL, serviceRole, workerSecret)) {
      return Response.json({ ok: false, error: "Worker authorization required" }, { status: 403 });
    }

    const windows = await loadCandidateWindows(baseURL, serviceRole);
    const bySport = new Map<string, CardWindow[]>();
    for (const window of windows) {
      bySport.set(window.sport_id, [...(bySport.get(window.sport_id) || []), window]);
    }

    let verifiedWindows = 0;
    const scannedSports: string[] = [];
    const waiting: string[] = [];
    for (const [sport, sportWindows] of bySport) {
      const startedAt = Date.now();
      const url = new URL(`https://api.the-odds-api.com/v4/sports/${providerSportKey(sport)}/events`);
      url.searchParams.set("apiKey", required("ODDS_API_KEY"));
      url.searchParams.set("dateFormat", "iso");
      const provider = await fetch(url);
      await recordScheduleScan(baseURL, serviceRole, sport, provider, startedAt);
      scannedSports.push(sport);
      if (!provider.ok) {
        waiting.push(`${sport}:provider-${provider.status}`);
        continue;
      }

      const raw = await provider.json();
      const events = (Array.isArray(raw) ? raw : []).filter((row: unknown): row is ScheduleEvent => {
        const event = row as Partial<ScheduleEvent>;
        return typeof event.id === "string" && typeof event.commence_time === "string" &&
          Number.isFinite(Date.parse(event.commence_time)) && typeof event.away_team === "string" &&
          typeof event.home_team === "string";
      });

      for (const window of sportWindows) {
        const matching = eligibleEventsForWindow(
          sport,
          events,
          window.window_starts_at,
          window.window_ends_at,
        );
        if (await updateWindow(baseURL, serviceRole, window, matching)) verifiedWindows += 1;
      }
    }

    return Response.json({
      ok: waiting.length === 0,
      endpointCostCredits: 0,
      candidateWindows: windows.length,
      verifiedWindows,
      scannedSports,
      waiting,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(message);
    return Response.json({ ok: false, error: message || "Schedule sync failed" }, { status: 500 });
  }
});
