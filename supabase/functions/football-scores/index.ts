import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const numericHeader = (value: string | null) => value == null || value === "" ? null : Number(value);
const defaultKey = (jsonName: string, legacyName: string) => {
  try { const value = JSON.parse(Deno.env.get(jsonName) || "{}").default; if (value) return String(value); } catch { /* fallback */ }
  return Deno.env.get(legacyName) || "";
};
type CachedScoreEvent = { id:string; commenceTime:string|null; completed:boolean; homeTeam:string; awayTeam:string; scores:{name:string;score:string}[]; lastUpdate:string|null };
const normalizeScoreEvent = (event: any): CachedScoreEvent => ({
  id: String(event?.id || ""),
  commenceTime: event?.commenceTime || event?.commence_time || null,
  completed: event?.completed === true,
  homeTeam: String(event?.homeTeam || event?.home_team || ""),
  awayTeam: String(event?.awayTeam || event?.away_team || ""),
  scores: Array.isArray(event?.scores) ? event.scores.map((score: any) => ({ name: String(score?.name || ""), score: String(score?.score ?? "") })) : [],
  lastUpdate: event?.lastUpdate || event?.last_update || null,
});
const mergeWeeklyEvents = (cached: any[], fresh: CachedScoreEvent[]) => {
  const cutoff = Date.now() - 10 * 86_400_000;
  const retained = cached.map(normalizeScoreEvent).filter((event) => {
    if (!event.id || !event.completed) return false;
    const timestamp = Date.parse(event.commenceTime || event.lastUpdate || "");
    return !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
  const merged = new Map(retained.map((event) => [event.id, event]));
  fresh.forEach((event) => { if (event.id) merged.set(event.id, event); });
  return [...merged.values()];
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
  const { leagueId, sport: requestedSport, daysFrom: requestedDays } = await req.json().catch(() => ({}));
  const sport = requestedSport === "nfl" ? "nfl" : "cfb";
  const daysFrom = Math.min(3, Math.max(1, Number(requestedDays) || 3));
  if (!leagueId) return reply({ error: "League required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishable = defaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = defaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return reply({ error: "Server database secret is unavailable" }, 503);
  const callerHeaders = { apikey: publishable, Authorization: authorization };
  const [membershipResponse, authResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/memberships?select=role&league_id=eq.${encodeURIComponent(leagueId)}&limit=1`, { headers: callerHeaders }),
    fetch(`${supabaseUrl}/auth/v1/user`, { headers: callerHeaders }),
  ]);
  if (!membershipResponse.ok || !authResponse.ok) return reply({ error: "Could not verify league membership" }, 403);
  const membership = (await membershipResponse.json())?.[0];
  const user = await authResponse.json();
  if (!membership || !user?.id) return reply({ error: "League membership required" }, 403);

  const serviceHeaders = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  const claimResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_live_football_score_refresh`, {
    method: "POST", headers: serviceHeaders, body: JSON.stringify({ p_sport: sport, p_min_age_seconds: 25 }),
  });
  if (!claimResponse.ok) return reply({ error: "Live score cache is not ready" }, 503);
  const claimed = (await claimResponse.json()) === true;
  const cacheUrl = `${supabaseUrl}/rest/v1/live_football_score_cache?sport=eq.${sport}&select=*`;
  if (!claimed) {
    const cacheResponse = await fetch(cacheUrl, { headers: serviceHeaders });
    const cache = cacheResponse.ok ? (await cacheResponse.json())?.[0] : null;
    if (cache?.events) return reply({ events: cache.events, remaining: cache.provider_remaining?.toString() ?? null, used: cache.provider_used?.toString() ?? null, last: cache.provider_last_cost?.toString() ?? null, cachedAt: cache.fetched_at, cacheHit: true, sport });
  }

  const apiKey = (Deno.env.get("ODDS_API_KEY") || "").trim();
  if (!apiKey) return reply({ error: "Odds API secret is not configured in Supabase" }, 503);
  const sportKey = sport === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const providerUrl = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/scores`);
  providerUrl.searchParams.set("apiKey", apiKey); providerUrl.searchParams.set("daysFrom", String(daysFrom)); providerUrl.searchParams.set("dateFormat", "iso");
  const started = Date.now();
  let providerStatus = 502, remaining: number | null = null, used: number | null = null, last: number | null = null, errorMessage: string | null = null;
  try {
    const provider = await fetch(providerUrl);
    providerStatus = provider.status;
    remaining = numericHeader(provider.headers.get("x-requests-remaining")); used = numericHeader(provider.headers.get("x-requests-used")); last = numericHeader(provider.headers.get("x-requests-last"));
    if (!provider.ok) throw new Error(`Scores provider error ${provider.status}`);
    const raw = await provider.json();
    const freshEvents = (Array.isArray(raw) ? raw : []).map(normalizeScoreEvent);
    const cacheResponse = await fetch(cacheUrl, { headers: serviceHeaders });
    const cache = cacheResponse.ok ? (await cacheResponse.json())?.[0] : null;
    // The provider exposes at most three prior score days. Preserve completed
    // Thursday games until a Monday final so one NFL card can settle atomically.
    const events = mergeWeeklyEvents(Array.isArray(cache?.events) ? cache.events : [], freshEvents);
    const fetchedAt = new Date().toISOString();
    await fetch(cacheUrl, { method: "PATCH", headers: { ...serviceHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ events, fetched_at: fetchedAt, provider_remaining: remaining, provider_used: used, provider_last_cost: last, last_http_status: providerStatus, last_error: null }) });
    await logUsage(true);
    return reply({ events, remaining: remaining?.toString() ?? null, used: used?.toString() ?? null, last: last?.toString() ?? null, cachedAt: fetchedAt, cacheHit: false, sport });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to reach scores provider";
    await fetch(cacheUrl, { method: "PATCH", headers: serviceHeaders, body: JSON.stringify({ last_http_status: providerStatus, last_error: errorMessage }) });
    await logUsage(false);
    const cacheResponse = await fetch(cacheUrl, { headers: serviceHeaders });
    const cache = cacheResponse.ok ? (await cacheResponse.json())?.[0] : null;
    if (cache?.events?.length) return reply({ events: cache.events, cachedAt: cache.fetched_at, cacheHit: true, stale: true, sport });
    return reply({ error: errorMessage }, 502);
  }

  async function logUsage(success: boolean) {
    await fetch(`${supabaseUrl}/rest/v1/platform_odds_api_usage`, { method: "POST", headers: { ...serviceHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ league_id: leagueId, user_id: user.id, sport, action: "score_sync", endpoint: "/scores", provider_remaining: remaining, provider_used: used, provider_last_cost: last, estimated_credit_cost: last ?? 1, success, http_status: providerStatus, error_code: errorMessage, duration_ms: Date.now() - started, dry_run: false }) });
  }
});
