import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const numericHeader = (value: string | null) => value == null || value === "" ? null : Number(value);
const isHalfPointSpread = (value: number) => Math.abs((Math.abs(value) % 1) - 0.5) < 0.0001;
const defaultKey = (jsonName: string, legacyName: string) => {
  try {
    const value = JSON.parse(Deno.env.get(jsonName) || "{}").default;
    if (value) return String(value);
  } catch { /* legacy fallback */ }
  return Deno.env.get(legacyName) || "";
};
const FIELDHOUSE_OPENING_DATE = "2026-11-02";
function addCalendarDays(dateKey: string, days: number) {
  const value = new Date(`${dateKey}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function easternDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const field = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);

  const body = await req.json().catch(() => ({}));
  const leagueId = String(body.leagueId || "");
  const sport = String(body.sport || "").toLowerCase();
  const window = Number(body.window);
  const from = new Date(String(body.commenceTimeFrom || ""));
  const to = new Date(String(body.commenceTimeTo || ""));
  if (!leagueId || !["ncaam", "ncaaw"].includes(sport) || !Number.isInteger(window) || window < 1 ||
      !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
      to.getTime() <= from.getTime() || to.getTime() - from.getTime() > 8 * 86_400_000) {
    return reply({ error: "Valid Fieldhouse league, sport, week, and seven-day window required" }, 400);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishable = defaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = defaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishable || !secret) return reply({ error: "Server configuration is unavailable" }, 503);

  const callerHeaders = { apikey: publishable, Authorization: authorization };
  const membershipURL = `${supabaseUrl}/rest/v1/memberships?select=role,is_deputy,leagues!inner(commissioner_id,sport_id)&league_id=eq.${encodeURIComponent(leagueId)}&limit=1`;
  const [membershipResponse, authResponse] = await Promise.all([
    fetch(membershipURL, { headers: callerHeaders }),
    fetch(`${supabaseUrl}/auth/v1/user`, { headers: callerHeaders }),
  ]);
  if (!membershipResponse.ok || !authResponse.ok) return reply({ error: "Could not verify commissioner access" }, 403);
  const membership = (await membershipResponse.json())?.[0];
  const user = await authResponse.json();
  const league = Array.isArray(membership?.leagues) ? membership.leagues[0] : membership?.leagues;
  const canBuild = membership?.role === "commissioner" || membership?.is_deputy === true || league?.commissioner_id === user?.id;
  if (!canBuild || league?.sport_id !== sport) return reply({ error: "Commissioner or deputy access to this Fieldhouse league is required" }, 403);
  const windowStart = addCalendarDays(FIELDHOUSE_OPENING_DATE, (window - 1) * 7);
  const windowEnd = addCalendarDays(windowStart, 7);
  if (from.toISOString().slice(0, 10) !== windowStart || to.toISOString().slice(0, 10) !== windowEnd) {
    return reply({ error: "Requested odds dates do not match this Fieldhouse week's scheduled window" }, 400);
  }
  const opensOn = addCalendarDays(windowStart, -7);
  if (easternDateKey() < opensOn) {
    return reply({
      error: `PAGE OPENS ${opensOn} — seven days before Week ${window}'s first scheduled game day.`,
      opensOn,
    }, 423);
  }

  const apiKey = (Deno.env.get("ODDS_API_KEY") || "").trim();
  if (!apiKey) return reply({ error: "Odds API secret is not configured in Supabase" }, 503);
  const sportKey = sport === "ncaaw" ? "basketball_wncaab" : "basketball_ncaab";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  url.searchParams.set("commenceTimeFrom", from.toISOString());
  url.searchParams.set("commenceTimeTo", to.toISOString());

  const started = Date.now();
  const provider = await fetch(url);
  const remaining = numericHeader(provider.headers.get("x-requests-remaining"));
  const used = numericHeader(provider.headers.get("x-requests-used"));
  const last = numericHeader(provider.headers.get("x-requests-last"));
  const serviceHeaders = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  await fetch(`${supabaseUrl}/rest/v1/platform_odds_api_usage`, {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      league_id: leagueId, user_id: user.id, sport, action: "pull_odds",
      endpoint: `/odds/${sportKey}`, provider_remaining: remaining, provider_used: used,
      provider_last_cost: last, estimated_credit_cost: last ?? 1, success: provider.ok,
      http_status: provider.status, error_code: provider.ok ? null : `Odds provider ${provider.status}`,
      duration_ms: Date.now() - started, dry_run: false,
    }),
  });
  if (!provider.ok) return reply({ error: `Odds provider error ${provider.status}`, remaining, used }, provider.status);

  const raw = await provider.json();
  const games = (Array.isArray(raw) ? raw : []).flatMap((game: any) => {
    for (const book of game.bookmakers || []) {
      const market = book.markets?.find((item: any) => item.key === "spreads");
      const home = market?.outcomes?.find((item: any) => item.name === game.home_team);
      const away = market?.outcomes?.find((item: any) => item.name === game.away_team);
      if (home?.point == null && away?.point == null) continue;
      const homeSpread = Number(home?.point ?? -(away?.point ?? 0));
      // Fieldhouse has no push state. Only a real sportsbook half-point line
      // can enter a card; do not invent a hook or silently alter the market.
      if (!Number.isFinite(homeSpread) || !isHalfPointSpread(homeSpread)) continue;
      return [{
        id: String(game.id), awayTeam: String(game.away_team), homeTeam: String(game.home_team),
        spread: homeSpread, favorite: homeSpread < 0 ? "home" : "away",
        commenceTime: game.commence_time, bookmaker: book.title,
        awayRank: null, homeRank: null,
      }];
    }
    return [];
  });

  return reply({
    games, remaining: remaining?.toString() ?? null, used: used?.toString() ?? null,
    weekLabel: `Week ${window}`, rankLabel: sport === "ncaaw" ? "WNCAAB" : "NCAAB",
  });
});
