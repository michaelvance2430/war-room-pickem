import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const keyFromBundle = (bundle: string, legacy: string) => {
  try {
    const value = JSON.parse(Deno.env.get(bundle) || "{}").default;
    if (value) return String(value);
  } catch { /* legacy fallback */ }
  return Deno.env.get(legacy) || "";
};

type Ranking = { id: string; name: string; market: string; rank: number; points: number; fp_votes: number };
type Ballot = { user_id: string; ranked_team_ids: string[] };

const aggregate = (ballots: Ballot[]) => {
  const points = new Map<string, number>();
  const firsts = new Map<string, number>();
  for (const ballot of ballots) {
    if (!Array.isArray(ballot.ranked_team_ids) || ballot.ranked_team_ids.length !== 10 || new Set(ballot.ranked_team_ids).size !== 10) continue;
    ballot.ranked_team_ids.forEach((id, index) => {
      points.set(id, (points.get(id) || 0) + 10 - index);
      if (index === 0) firsts.set(id, (firsts.get(id) || 0) + 1);
    });
  }
  return [...points.keys()].sort((a, b) =>
    (points.get(b)! - points.get(a)!) || (firsts.get(b)! - firsts.get(a)!) || a.localeCompare(b)
  ).slice(0, 10).map((id, index) => ({ id, rank: index + 1, points: points.get(id), firstPlaceVotes: firsts.get(id) || 0 }));
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply({ error: "POST required" }, 405);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
  const body = await request.json().catch(() => ({}));
  const leagueId = String(body.leagueId || "");
  const requestedWeek = Number(body.week);
  const season = Number(body.season || new Date().getUTCFullYear());
  if (!leagueId || !Number.isInteger(requestedWeek) || requestedWeek < 0) return reply({ error: "League and CFB week required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishable = keyFromBundle("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = keyFromBundle("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return reply({ error: "Server database secret unavailable" }, 503);
  const callerHeaders = { apikey: publishable, Authorization: authorization };
  const serviceHeaders = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

  const [authResponse, cardResponse] = await Promise.all([
    fetch(`${supabaseUrl}/auth/v1/user`, { headers: callerHeaders }),
    fetch(`${supabaseUrl}/rest/v1/week_cards?select=lock_time&league_id=eq.${encodeURIComponent(leagueId)}&week_number=eq.${requestedWeek}&limit=1`, { headers: serviceHeaders }),
  ]);
  if (!authResponse.ok) return reply({ error: "Could not verify league membership" }, 403);
  const user = await authResponse.json();
  if (!user?.id) return reply({ error: "Authentication required" }, 401);
  const membershipResponse = await fetch(
    `${supabaseUrl}/rest/v1/memberships?select=user_id,leagues!inner(sport_id)&league_id=eq.${encodeURIComponent(leagueId)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: callerHeaders },
  );
  if (!membershipResponse.ok) return reply({ error: "Could not verify league membership" }, 403);
  const membership = (await membershipResponse.json())?.[0];
  const league = Array.isArray(membership?.leagues) ? membership.leagues[0] : membership?.leagues;
  if (!membership || league?.sport_id !== "cfb") return reply({ error: "CFB league membership required" }, 403);
  const card = cardResponse.ok ? (await cardResponse.json())?.[0] : null;
  const revealAt = card?.lock_time || new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  const cacheBase = `${supabaseUrl}/rest/v1/cfb_ap_polls`;
  let cached: any = null;
  const cachedResponse = await fetch(`${cacheBase}?season=eq.${season}&order=week.desc&limit=1&select=*`, { headers: serviceHeaders });
  if (cachedResponse.ok) cached = (await cachedResponse.json())?.[0] || null;
  const stale = !cached || Date.now() - Date.parse(cached.fetched_at || "") > 6 * 60 * 60_000;
  if (stale) {
    const providerKey = (Deno.env.get("SPORTRADAR_NCAAFB_API_KEY") || "").trim();
    if (!providerKey && !cached) return reply({ error: "Sportradar secret is not configured" }, 503);
    if (providerKey) {
      const provider = await fetch(`https://api.sportradar.com/ncaafb/trial/v7/en/polls/AP25/${season}/rankings.json`, { headers: { "x-api-key": providerKey } });
      if (provider.ok) {
        const payload = await provider.json();
        const rankings: Ranking[] = Array.isArray(payload?.rankings) ? payload.rankings : [];
        if (rankings.length === 25) {
          cached = { season, week: Number(payload?.week || requestedWeek), poll_name: payload?.poll?.name || "Associated Press Top 25", effective_at: payload?.effective_time || null, rankings, fetched_at: new Date().toISOString() };
          await fetch(`${cacheBase}?on_conflict=season,week`, { method: "POST", headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(cached) });
        }
      } else if (!cached) return reply({ error: `Sportradar returned ${provider.status}` }, 502);
    }
  }
  if (!cached) return reply({ error: "AP Top 25 is not available" }, 503);

  const ballotBase = `${supabaseUrl}/rest/v1/cfb_member_ballots`;
  const selector = `league_id=eq.${encodeURIComponent(leagueId)}&season=eq.${season}&week=eq.${requestedWeek}`;
  if (body.action === "save") {
    const ids = Array.isArray(body.rankedTeamIds) ? body.rankedTeamIds.map(String) : [];
    const validIDs = new Set((cached.rankings || []).map((ranking: Ranking) => ranking.id));
    if (ids.length !== 10 || new Set(ids).size !== 10 || ids.some((id: string) => !validIDs.has(id))) return reply({ error: "Choose ten unique AP-ranked teams" }, 400);
    if (Date.now() >= Date.parse(revealAt)) return reply({ error: "This ballot is already locked" }, 409);
    const saveResponse = await fetch(`${ballotBase}?on_conflict=league_id,season,week,user_id`, {
      method: "POST", headers: { ...serviceHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ league_id: leagueId, season, week: requestedWeek, user_id: user.id, ranked_team_ids: ids, reveal_at: revealAt, updated_at: new Date().toISOString() }),
    });
    if (!saveResponse.ok) return reply({ error: "The room rejected that ballot" }, 500);
  }

  const ballotsResponse = await fetch(`${ballotBase}?${selector}&select=user_id,ranked_team_ids`, { headers: serviceHeaders });
  const ballots: Ballot[] = ballotsResponse.ok ? await ballotsResponse.json() : [];
  const revealed = Date.now() >= Date.parse(revealAt);
  const own = ballots.find((ballot) => ballot.user_id === user.id)?.ranked_team_ids || [];
  return reply({
    season: cached.season, pollWeek: cached.week, roomWeek: requestedWeek, pollName: cached.poll_name,
    effectiveAt: cached.effective_at, fetchedAt: cached.fetched_at, rankings: cached.rankings,
    filedCount: new Set(ballots.map((ballot) => ballot.user_id)).size, official: new Set(ballots.map((ballot) => ballot.user_id)).size >= 4,
    revealAt, revealed, ownBallot: own, memberResults: revealed ? aggregate(ballots) : [],
  });
});
