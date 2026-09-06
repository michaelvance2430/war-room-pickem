// Shared provider identity and CFB eligibility rules. Schedule ingestion and
// paid odds pulls must agree on what counts as a War Room game.

const FBS_SCHOOLS = `Alabama|Arkansas|Auburn|Florida|Georgia|Kentucky|LSU|Mississippi State|Missouri|Oklahoma|Ole Miss|South Carolina|Tennessee|Texas|Texas A&M|Vanderbilt|Illinois|Indiana|Iowa|Maryland|Michigan|Michigan State|Minnesota|Nebraska|Northwestern|Ohio State|Oregon|Penn State|Purdue|Rutgers|UCLA|USC|Washington|Wisconsin|Boston College|California|Clemson|Duke|Florida State|Georgia Tech|Louisville|Miami|NC State|North Carolina|Pittsburgh|SMU|Stanford|Syracuse|Virginia|Virginia Tech|Wake Forest|Arizona|Arizona State|Baylor|BYU|Cincinnati|Colorado|Houston|Iowa State|Kansas|Kansas State|Oklahoma State|TCU|Texas Tech|UCF|Utah|West Virginia|Notre Dame|UConn|UMass|Army|East Carolina|Florida Atlantic|Memphis|Navy|North Texas|Rice|South Florida|Temple|Tulane|Tulsa|UTSA|Charlotte|Air Force|Boise State|Colorado State|Fresno State|Hawaii|Nevada|New Mexico|San Diego State|San Jose State|UNLV|Utah State|Wyoming|Akron|Ball State|Bowling Green|Buffalo|Central Michigan|Eastern Michigan|Kent State|Miami (OH)|Northern Illinois|Ohio|Toledo|Western Michigan|Appalachian State|Arkansas State|Coastal Carolina|Georgia Southern|Georgia State|James Madison|Louisiana|Marshall|Old Dominion|South Alabama|Southern Miss|Texas State|Troy|UL Monroe|FIU|Jacksonville State|Kennesaw State|Liberty|Louisiana Tech|Middle Tennessee|New Mexico State|Sam Houston|UTEP|Western Kentucky`
  .split("|")
  .sort((a, b) => b.length - a.length);

// Words that indicate the provider name is a different institution, not the
// FBS school followed by its mascot. Houston Baptist is not Houston.
const SCHOOL_MODIFIERS = new Set([
  "state", "tech", "central", "eastern", "western", "northern", "southern",
  "international", "christian", "baptist", "pine", "bluff", "ohio",
]);

export function normalizeTeam(value: string) {
  return value.toLowerCase()
    .replace(/&/g, "and")
    .replace(/\(oh\)/g, "ohio")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isFbsTeam(value: string) {
  const team = normalizeTeam(value);
  return FBS_SCHOOLS.some((school) => {
    const key = normalizeTeam(school);
    if (team !== key && !team.startsWith(`${key} `)) return false;
    const schoolWords = key.split(" ");
    const next = team.split(" ")[schoolWords.length];
    return !next || SCHOOL_MODIFIERS.has(schoolWords.at(-1) || "") || !SCHOOL_MODIFIERS.has(next);
  });
}

export function providerSportKey(sport: string) {
  switch (sport) {
    case "nfl": return "americanfootball_nfl";
    case "ncaam": return "basketball_ncaab";
    case "ncaaw": return "basketball_wncaab";
    default: return "americanfootball_ncaaf";
  }
}

export function isEligibleScheduleEvent(sport: string, awayTeam: string, homeTeam: string) {
  return sport !== "cfb" || (isFbsTeam(awayTeam) && isFbsTeam(homeTeam));
}

export type ScheduleEvent = {
  id: string;
  commence_time: string;
  away_team: string;
  home_team: string;
};

export function eligibleEventsForWindow(
  sport: string,
  events: ScheduleEvent[],
  windowStartsAt: string,
  windowEndsAt: string,
) {
  const start = Date.parse(windowStartsAt);
  const end = Date.parse(windowEndsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  return events.filter((event) => {
    const tip = Date.parse(event.commence_time);
    return Number.isFinite(tip) && tip >= start && tip < end &&
      isEligibleScheduleEvent(sport, event.away_team, event.home_team);
  });
}

export function earliestEligibleEvent(
  sport: string,
  events: ScheduleEvent[],
  windowStartsAt: string,
  windowEndsAt: string,
) {
  return eligibleEventsForWindow(sport, events, windowStartsAt, windowEndsAt)
    .sort((left, right) => Date.parse(left.commence_time) - Date.parse(right.commence_time))[0] ?? null;
}
