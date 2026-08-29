import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return reply({ error: "Authentication required" }, 401);
  }

  const { leagueId, sport: requestedSport, daysFrom: requestedDays } =
    await req.json().catch(() => ({}));
  const sport = requestedSport === "nfl" ? "nfl" : "cfb";
  const daysFrom = Math.min(3, Math.max(1, Number(requestedDays) || 3));
  if (!leagueId) return reply({ error: "League required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  let publishable = legacyAnon;
  try {
    publishable =
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default ||
      legacyAnon;
  } catch {
    // Legacy fallback remains available during the key migration.
  }

  const common = { apikey: publishable, Authorization: authorization };
  const membershipUrl =
    `${supabaseUrl}/rest/v1/memberships` +
    `?select=role,is_deputy,leagues!inner(commissioner_id)` +
    `&league_id=eq.${encodeURIComponent(leagueId)}&limit=1`;
  const [membershipResponse, authResponse] = await Promise.all([
    fetch(membershipUrl, { headers: common }),
    fetch(`${supabaseUrl}/auth/v1/user`, { headers: common }),
  ]);

  if (!membershipResponse.ok || !authResponse.ok) {
    return reply({ error: "Could not verify commissioner access" }, 403);
  }

  const membership = (await membershipResponse.json())?.[0];
  const user = await authResponse.json();
  const canScore =
    membership?.role === "commissioner" ||
    membership?.is_deputy === true ||
    membership?.leagues?.commissioner_id === user?.id;
  if (!canScore) return reply({ error: "Commissioner or deputy required" }, 403);

  const apiKey = (Deno.env.get("ODDS_API_KEY") || "").trim();
  if (!apiKey) {
    return reply({ error: "Odds API secret is not configured in Supabase" }, 503);
  }

  const sportKey =
    sport === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const url = new URL(
    `https://api.the-odds-api.com/v4/sports/${sportKey}/scores`,
  );
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("daysFrom", String(daysFrom));
  url.searchParams.set("dateFormat", "iso");

  try {
    const provider = await fetch(url);
    const remaining = provider.headers.get("x-requests-remaining");
    const used = provider.headers.get("x-requests-used");
    const last = provider.headers.get("x-requests-last");
    if (!provider.ok) {
      return reply(
        { error: `Scores provider error ${provider.status}`, remaining, used, last },
        provider.status,
      );
    }

    const raw = await provider.json();
    const events = (Array.isArray(raw) ? raw : []).map((event: any) => ({
      id: String(event.id || ""),
      commenceTime: event.commence_time || null,
      completed: event.completed === true,
      homeTeam: String(event.home_team || ""),
      awayTeam: String(event.away_team || ""),
      scores: Array.isArray(event.scores)
        ? event.scores.map((score: any) => ({
            name: String(score.name || ""),
            score: String(score.score ?? ""),
          }))
        : [],
      lastUpdate: event.last_update || null,
    }));

    return reply({ events, remaining, used, last, sport });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach scores provider";
    return reply({ error: message }, 502);
  }
});
