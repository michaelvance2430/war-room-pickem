import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isFbsTeam, normalizeTeam } from "../_shared/sport-schedule.ts";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
type CardWindow = {
  window_starts_at: string;
  window_ends_at: string;
  first_game_at: string;
  display_label: string | null;
};

const SCHOOL_MODIFIERS = new Set(["state", "tech", "central", "eastern", "western", "northern", "southern", "international", "christian", "baptist", "pine", "bluff", "ohio"]);

function compactDate(value: string) { return value.replaceAll("-", ""); }

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

async function loadCardWindow(supabaseUrl: string, common: Record<string, string>, sport: string, week: number): Promise<CardWindow | null> {
  const query = new URLSearchParams({
    select: "window_starts_at,window_ends_at,first_game_at,display_label",
    sport_id: `eq.${sport}`,
    week_number: `eq.${week}`,
    window_ends_at: `gte.${new Date().toISOString()}`,
    order: "window_starts_at.asc",
    limit: "1",
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/sport_card_windows?${query}`, { headers: common });
  if (!response.ok) throw new Error(`Card calendar returned ${response.status}`);
  return (await response.json())?.[0] || null;
}

// The live AP endpoint remains primary. This preseason snapshot guarantees
// Week 1 labels if ESPN blocks or changes its edge response unexpectedly.
const WEEK_ONE_AP_TOP_25: [number, string][] = [
  [1, "Ohio State"], [2, "Oregon"], [3, "Georgia"], [4, "Notre Dame"], [5, "Texas"],
  [6, "Indiana"], [7, "Miami"], [8, "Texas A&M"], [9, "Ole Miss"], [10, "Oklahoma"],
  [11, "LSU"], [12, "Texas Tech"], [13, "Alabama"], [14, "USC"], [14, "BYU"],
  [16, "Michigan"], [17, "Washington"], [18, "Penn State"], [19, "SMU"], [20, "Tennessee"],
  [21, "Utah"], [22, "Iowa"], [23, "Houston"], [24, "Louisville"], [25, "Missouri"],
];

function addRankAliases(ranks: Map<string, number>, team: any, rank: number) {
  for (const label of [team?.displayName, team?.shortDisplayName, team?.location, team?.nickname, team?.name, team?.abbreviation]) {
    if (typeof label === "string" && label.trim()) ranks.set(normalizeTeam(label), rank);
  }
}

async function loadCfbRanks(start: string, end: string) {
  const ranks = new Map<string, number>(WEEK_ONE_AP_TOP_25.map(([rank, team]) => [normalizeTeam(team), rank]));
  const rankingsUrl = new URL("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings");
  try {
    const response = await fetch(rankingsUrl);
    if (response.ok) {
      const payload = await response.json();
      const apPoll = (payload.rankings || []).find((poll: any) => poll.type === "ap" || poll.name === "AP Top 25");
      for (const row of apPoll?.ranks || []) {
        const rank = Number(row.current);
        if (Number.isInteger(rank) && rank >= 1 && rank <= 25) addRankAliases(ranks, row.team, rank);
      }
    }
    if (ranks.size > 0) return ranks;

    // Scoreboard metadata is a secondary source if the rankings endpoint is
    // temporarily unavailable. Never discard odds solely because ranks fail.
    const scoreboardUrl = new URL("https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard");
    scoreboardUrl.searchParams.set("dates", `${compactDate(start)}-${compactDate(end)}`);
    scoreboardUrl.searchParams.set("limit", "1000");
    scoreboardUrl.searchParams.set("groups", "80");
    const scoreboardResponse = await fetch(scoreboardUrl);
    if (!scoreboardResponse.ok) return ranks;
    const scoreboard = await scoreboardResponse.json();
    for (const event of scoreboard.events || []) for (const competition of event.competitions || []) {
      for (const competitor of competition.competitors || []) {
        const rank = Number(competitor.curatedRank?.current);
        if (Number.isInteger(rank) && rank >= 1 && rank <= 25) addRankAliases(ranks, competitor.team, rank);
      }
    }
  } catch { /* Rankings are enhancement data; odds remain usable if ESPN is temporarily unavailable. */ }
  return ranks;
}

function rankForTeam(value: string, ranks: Map<string, number>) {
  const team = normalizeTeam(value);
  const exact = ranks.get(team);
  if (exact != null) return exact;
  const candidates = [...ranks.entries()]
    .filter(([label]) => {
      if (label.length < 3 || !team.startsWith(`${label} `)) return false;
      const labelWords = label.split(" ");
      const next = team.split(" ")[labelWords.length];
      return SCHOOL_MODIFIERS.has(labelWords.at(-1) || "") || !SCHOOL_MODIFIERS.has(next);
    })
    .sort((a, b) => b[0].length - a[0].length);
  return candidates[0]?.[1] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Authentication required" }, 401);
  const { leagueId, sport: requestedSport, week } = await req.json().catch(() => ({}));
  const sport = requestedSport === "nfl" ? "nfl" : "cfb";
  if (!leagueId || !Number.isInteger(week)) return reply({ error: "Valid league and week required" }, 400);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  let publishable = legacyAnon;
  try { publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || legacyAnon; } catch { /* legacy fallback */ }
  const common = { apikey: publishable, Authorization: authorization };
  const membershipURL = `${supabaseUrl}/rest/v1/memberships?select=role,is_deputy,leagues!inner(commissioner_id,sport_id,mode)&league_id=eq.${encodeURIComponent(leagueId)}&limit=1`;
  const [membershipResponse, authResponse] = await Promise.all([
    fetch(membershipURL, { headers: common }), fetch(`${supabaseUrl}/auth/v1/user`, { headers: common }),
  ]);
  if (!membershipResponse.ok || !authResponse.ok) return reply({ error: "Could not verify commissioner access" }, 403);
  const membership = (await membershipResponse.json())?.[0];
  const user = await authResponse.json();
  const league = Array.isArray(membership?.leagues) ? membership.leagues[0] : membership?.leagues;
  if (!(membership?.role === "commissioner" || membership?.is_deputy === true || league?.commissioner_id === user?.id)) {
    return reply({ error: "Commissioner or deputy required" }, 403);
  }
  if (league?.sport_id !== sport) return reply({ error: "Requested odds sport does not match this league" }, 403);
  let range: CardWindow | null;
  try {
    range = await loadCardWindow(supabaseUrl, common, sport, week);
  } catch (error) {
    console.error(error);
    return reply({ error: "WEEK CALENDAR UNAVAILABLE — odds desk stays locked" }, 503);
  }
  if (!range) return reply({ error: "SEASON DATE PENDING — odds desk stays locked" }, 423);
  const opensAt = new Date(Date.parse(range.first_game_at) - 7 * 86_400_000);
  const opensOn = easternDateKey(opensAt);
  if (Date.now() < opensAt.getTime()) {
    return reply({
      error: `PAGE OPENS ${opensOn} — seven days before Week ${week}'s first scheduled game day.`,
      opensOn,
    }, 423);
  }

  const apiKey = (Deno.env.get("ODDS_API_KEY") || "").trim();
  if (!apiKey) return reply({ error: "Odds API secret is not configured in Supabase" }, 503);
  const sportKey = sport === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey); url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads"); url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("commenceTimeFrom", new Date(range.window_starts_at).toISOString());
  url.searchParams.set("commenceTimeTo", new Date(range.window_ends_at).toISOString());
  const [provider, cfbRanks] = await Promise.all([
    fetch(url),
    sport === "cfb" ? loadCfbRanks(
      range.window_starts_at.slice(0, 10),
      addCalendarDays(range.window_ends_at.slice(0, 10), -1),
    ) : Promise.resolve(new Map<string, number>()),
  ]);
  const remaining = provider.headers.get("x-requests-remaining");
  const used = provider.headers.get("x-requests-used");
  if (!provider.ok) return reply({ error: `Odds provider error ${provider.status}`, remaining, used }, provider.status);

  const raw = await provider.json();
  const games = (Array.isArray(raw) ? raw : []).flatMap((game: any) => {
    const tip = Date.parse(String(game.commence_time || ""));
    if (!Number.isFinite(tip) || tip < Date.parse(range.window_starts_at) || tip >= Date.parse(range.window_ends_at)) return [];
    if (sport === "cfb" && (!isFbsTeam(game.away_team) || !isFbsTeam(game.home_team))) return [];
    for (const book of game.bookmakers || []) {
      const market = book.markets?.find((item: any) => item.key === "spreads");
      const home = market?.outcomes?.find((item: any) => item.name === game.home_team);
      const away = market?.outcomes?.find((item: any) => item.name === game.away_team);
      if (home?.point == null && away?.point == null) continue;
      const spread = home?.point ?? -(away?.point ?? 0);
      return [{ id: game.id, awayTeam: game.away_team, homeTeam: game.home_team, spread,
        favorite: spread < 0 ? "home" : "away", commenceTime: game.commence_time,
        bookmaker: book.title, awayRank: rankForTeam(game.away_team, cfbRanks),
        homeRank: rankForTeam(game.home_team, cfbRanks) }];
    }
    return [];
  });
  return reply({ games, remaining, used, weekLabel: range.display_label || `Week ${week}`,
    rankLabel: sport === "nfl" ? "NFL" : "ESPN TOP 25",
    rankedTeams: sport === "cfb" ? cfbRanks.size : 0,
    windowStartsAt: range.window_starts_at, windowEndsAt: range.window_ends_at });
});
