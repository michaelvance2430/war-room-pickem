import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

// War Room CFB cards use Division I FBS programs only. The provider's NCAAF
// feed also contains FCS and lower-division games, so filter both teams here.
const FBS_SCHOOLS = `Alabama|Arkansas|Auburn|Florida|Georgia|Kentucky|LSU|Mississippi State|Missouri|Oklahoma|Ole Miss|South Carolina|Tennessee|Texas|Texas A&M|Vanderbilt|Illinois|Indiana|Iowa|Maryland|Michigan|Michigan State|Minnesota|Nebraska|Northwestern|Ohio State|Oregon|Penn State|Purdue|Rutgers|UCLA|USC|Washington|Wisconsin|Boston College|California|Clemson|Duke|Florida State|Georgia Tech|Louisville|Miami|NC State|North Carolina|Pittsburgh|SMU|Stanford|Syracuse|Virginia|Virginia Tech|Wake Forest|Arizona|Arizona State|Baylor|BYU|Cincinnati|Colorado|Houston|Iowa State|Kansas|Kansas State|Oklahoma State|TCU|Texas Tech|UCF|Utah|West Virginia|Notre Dame|UConn|UMass|Army|East Carolina|Florida Atlantic|Memphis|Navy|North Texas|Rice|South Florida|Temple|Tulane|Tulsa|UTSA|Charlotte|Air Force|Boise State|Colorado State|Fresno State|Hawaii|Nevada|New Mexico|San Diego State|San Jose State|UNLV|Utah State|Wyoming|Akron|Ball State|Bowling Green|Buffalo|Central Michigan|Eastern Michigan|Kent State|Miami (OH)|Northern Illinois|Ohio|Toledo|Western Michigan|Appalachian State|Arkansas State|Coastal Carolina|Georgia Southern|Georgia State|James Madison|Louisiana|Marshall|Old Dominion|South Alabama|Southern Miss|Texas State|Troy|UL Monroe|FIU|Jacksonville State|Kennesaw State|Liberty|Louisiana Tech|Middle Tennessee|New Mexico State|Sam Houston|UTEP|Western Kentucky`
  .split("|")
  .sort((a, b) => b.length - a.length);

const normalizeTeam = (value: string) => value.toLowerCase()
  .replace(/&/g, "and").replace(/\(oh\)/g, "ohio")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
// Words that indicate the provider name is a different institution, not the
// ranked/FBS school followed by its mascot (Houston Baptist is not Houston).
const SCHOOL_MODIFIERS = new Set(["state", "tech", "central", "eastern", "western", "northern", "southern", "international", "christian", "baptist", "pine", "bluff", "ohio"]);
function isFbsTeam(value: string) {
  const team = normalizeTeam(value);
  return FBS_SCHOOLS.some((school) => {
    const key = normalizeTeam(school);
    if (team !== key && !team.startsWith(`${key} `)) return false;
    const schoolWords = key.split(" ");
    const next = team.split(" ")[schoolWords.length];
    return !next || SCHOOL_MODIFIERS.has(schoolWords.at(-1) || "") || !SCHOOL_MODIFIERS.has(next);
  });
}

function dateWindow(sport: string, week: number) {
  const fixed: Record<string, [string, string]> = sport === "nfl" ? {
    19: ["2027-01-16", "2027-01-18"], 20: ["2027-01-23", "2027-01-24"],
    21: ["2027-01-31", "2027-02-01"], 22: ["2027-02-14", "2027-02-14"],
  } : {
    0: ["2026-08-27", "2026-09-02"],
    15: ["2026-12-18", "2026-12-21"], 16: ["2026-12-31", "2027-01-02"],
    17: ["2027-01-08", "2027-01-11"], 18: ["2027-01-18", "2027-01-20"],
  };
  if (fixed[week]) return { start: fixed[week][0], end: fixed[week][1] };
  if ((sport === "nfl" && (week < 1 || week > 18)) || (sport !== "nfl" && (week < 1 || week > 14))) return null;
  let start: Date;
  let end: Date;
  if (sport === "nfl") {
    start = new Date("2026-09-10T12:00:00Z");
    start.setUTCDate(start.getUTCDate() + (week - 1) * 7);
    end = new Date(start); end.setUTCDate(end.getUTCDate() + 4);
  } else if (week === 1) {
    start = new Date("2026-09-03T12:00:00Z");
    end = new Date(start); end.setUTCDate(end.getUTCDate() + 4);
  } else {
    // ESPN's CFB buckets roll Tuesday through Monday from Week 2 forward.
    start = new Date("2026-09-08T12:00:00Z");
    start.setUTCDate(start.getUTCDate() + (week - 2) * 7);
    end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function compactDate(value: string) { return value.replaceAll("-", ""); }

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
  const range = Number.isInteger(week) ? dateWindow(sport, week) : null;
  if (!leagueId || !range) return reply({ error: "Valid league and week required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const legacyAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  let publishable = legacyAnon;
  try { publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || legacyAnon; } catch { /* legacy fallback */ }
  const common = { apikey: publishable, Authorization: authorization };
  const membershipURL = `${supabaseUrl}/rest/v1/memberships?select=role,is_deputy,leagues!inner(commissioner_id)&league_id=eq.${encodeURIComponent(leagueId)}&limit=1`;
  const [membershipResponse, authResponse] = await Promise.all([
    fetch(membershipURL, { headers: common }), fetch(`${supabaseUrl}/auth/v1/user`, { headers: common }),
  ]);
  if (!membershipResponse.ok || !authResponse.ok) return reply({ error: "Could not verify commissioner access" }, 403);
  const membership = (await membershipResponse.json())?.[0];
  const user = await authResponse.json();
  if (!(membership?.role === "commissioner" || membership?.is_deputy === true || membership?.leagues?.commissioner_id === user?.id)) {
    return reply({ error: "Commissioner or deputy required" }, 403);
  }

  const apiKey = (Deno.env.get("ODDS_API_KEY") || "").trim();
  if (!apiKey) return reply({ error: "Odds API secret is not configured in Supabase" }, 503);
  const sportKey = sport === "nfl" ? "americanfootball_nfl" : "americanfootball_ncaaf";
  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  url.searchParams.set("apiKey", apiKey); url.searchParams.set("regions", "us");
  url.searchParams.set("markets", "spreads"); url.searchParams.set("oddsFormat", "american");
  const [provider, cfbRanks] = await Promise.all([
    fetch(url),
    sport === "cfb" ? loadCfbRanks(range.start, range.end) : Promise.resolve(new Map<string, number>()),
  ]);
  const remaining = provider.headers.get("x-requests-remaining");
  const used = provider.headers.get("x-requests-used");
  if (!provider.ok) return reply({ error: `Odds provider error ${provider.status}`, remaining, used }, provider.status);

  const raw = await provider.json();
  const games = (Array.isArray(raw) ? raw : []).flatMap((game: any) => {
    const day = String(game.commence_time || "").slice(0, 10);
    if (day < range.start || day > range.end) return [];
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
  return reply({ games, remaining, used, weekLabel: `${range.start} – ${range.end}`,
    rankLabel: sport === "nfl" ? "NFL" : "ESPN TOP 25",
    rankedTeams: sport === "cfb" ? cfbRanks.size : 0 });
});
