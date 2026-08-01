/**
 * War Room CFB season map — Week 0 through CFP.
 *
 * Scrub (recommended for a full “real” season after an independent Week 0):
 *
 * | App # | Label                         | Role                              | Cut?        |
 * |-------|-------------------------------|-----------------------------------|-------------|
 * | 0     | Week 0 · Openers              | Independent early slate           | No*         |
 * | 1–12  | Week 1 … Week 12             | Regular season pick'em            | Yes         |
 * | 13    | Week 13 · Late RS             | Final regular-season Saturday(s)  | Yes         |
 * | 14    | Conf. Championships           | Conf title games — CUT LOCKS HERE | Yes → cut   |
 * | 15    | CFP Round 1                   | First round (12-team)             | Bracket     |
 * | 16    | CFP Quarterfinals             | NY6 / QF                          | Bracket     |
 * | 17    | CFP Semifinals                | Semis                             | Bracket     |
 * | 18    | CFP National Championship     | Title game                        | Bracket     |
 *
 * *Week 0: run as its own card. Score it if you want fun points, but the
 * championship/toilet cut is based on standings after Conference Championships
 * (week 14) are scored — not after Week 0 alone.
 *
 * Count of pick'em “choices” (published cards you may run):
 * - Week 0 only:            1 (independent)
 * - Regular season 1–13:   13
 * - Conference champ:       1  (finalizer for brackets)
 * - CFP playoff rounds:     4  (R1 → QF → SF → Final)
 * - TOTAL max cards:       1 + 13 + 1 + 4 = 19 slots (app weeks 0–18)
 *
 * Bracket weeks (15–18): standings already locked into Championship vs Toilet;
 * those weeks advance bracket matchups (higher weekly score advances). You can
 * still publish a 5-game pick'em card on real CFP games if you want.
 */

export type SeasonPhase =
  | "week0"
  | "regular"
  | "conf_championship"
  | "cfp_r1"
  | "cfp_qf"
  | "cfp_sf"
  | "cfp_final"
  | "other";

/** Highest week index in the full calendar (0…N inclusive). Always 18 — not configurable. */
export const FULL_SEASON_MAX_WEEK = 18;

/** After this week is scored, Championship / Toilet fields lock from standings. */
export const DEFAULT_CUT_LOCK_WEEK = 14;

/**
 * Fixed season length for every league.
 * Weeks 0–18: openers → RS → Conf Champ cut → CFP Final.
 * Do not expose a shorter option — CFB needs the full map.
 */
export const SEASON_MAX_WEEK = FULL_SEASON_MAX_WEEK;
export const DEFAULT_SEASON_WEEKS = FULL_SEASON_MAX_WEEK;

/**
 * 2026 CFB pick'em windows (America/New_York civil dates, inclusive).
 *
 * Week 0: Sat Aug 29 only (special kickoff)
 * Week 1+: Thu–Mon college windows (Labor Day week for Week 1)
 */
export type WeekDateWindow = {
  weekNumber: number;
  /** YYYY-MM-DD start (ET calendar date) */
  startDate: string;
  /** YYYY-MM-DD end (ET calendar date), inclusive */
  endDate: string;
};

/** Week 0 = Aug 29, 2026. Week 1 = Sep 3–7, then +7 days each RS week. */
function buildRegularWindows2026(): WeekDateWindow[] {
  const out: WeekDateWindow[] = [
    { weekNumber: 0, startDate: "2026-08-29", endDate: "2026-08-29" },
  ];
  // Week 1 opens Thu Sep 3, 2026 through Mon Sep 7
  let start = utcNoonFromYmd("2026-09-03");
  for (let w = 1; w <= 13; w++) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 4); // Thu→Mon
    out.push({
      weekNumber: w,
      startDate: ymdFromUtcNoon(start),
      endDate: ymdFromUtcNoon(end),
    });
    start = new Date(start);
    start.setUTCDate(start.getUTCDate() + 7);
  }
  // Conf Champ weekend (first weekend of Dec 2026)
  out.push({
    weekNumber: 14,
    startDate: "2026-12-04",
    endDate: "2026-12-06",
  });
  // CFP (approx 2026–27 windows — filter when books post)
  out.push(
    { weekNumber: 15, startDate: "2026-12-18", endDate: "2026-12-21" },
    { weekNumber: 16, startDate: "2026-12-31", endDate: "2027-01-02" },
    { weekNumber: 17, startDate: "2027-01-08", endDate: "2027-01-11" },
    { weekNumber: 18, startDate: "2027-01-18", endDate: "2027-01-20" }
  );
  return out;
}

const WINDOWS_2026 = buildRegularWindows2026();

/**
 * 2026–27 NFL pick'em — **official NFL week numbers only**.
 *
 * Regular season (app weeks 1–18) = NFL Weeks 1–18, Thu→Mon:
 *   Week 1  Sep 10–14, 2026
 *   Week 2  Sep 17–21
 *   …
 *   Week 18 ~ Jan 7–11, 2027 (final RS weekend)
 *
 * Playoffs are NOT renumbered as “Week 15–18” (that would lie to fans).
 * After RS: app weeks 19–22 = Wild Card → Divisional → Conference → Super Bowl.
 *
 * Cut locks after Week 18 (full regular season), then brackets advance on
 * playoff cards (19–22). CFB still cuts after week 14.
 *
 * Super Bowl LXI: Feb 14, 2027 (SoFi).
 */
export const NFL_RS_MAX_WEEK = 18;
export const NFL_PLAYOFF_WEEKS = [19, 20, 21, 22] as const;
export const NFL_SEASON_MAX_WEEK = 22; // through Super Bowl
export const NFL_CUT_LOCK_WEEK = 18;

function buildNflWindows2026(): WeekDateWindow[] {
  const out: WeekDateWindow[] = [];
  // Official NFL Weeks 1–18: Thursday → Monday
  let start = utcNoonFromYmd("2026-09-10");
  for (let w = 1; w <= NFL_RS_MAX_WEEK; w++) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 4); // Thu→Mon
    out.push({
      weekNumber: w,
      startDate: ymdFromUtcNoon(start),
      endDate: ymdFromUtcNoon(end),
    });
    start = new Date(start);
    start.setUTCDate(start.getUTCDate() + 7);
  }
  // Real postseason (not fake “Week 15 = Wild Card”)
  out.push(
    { weekNumber: 19, startDate: "2027-01-16", endDate: "2027-01-18" }, // Wild Card
    { weekNumber: 20, startDate: "2027-01-23", endDate: "2027-01-24" }, // Divisional
    { weekNumber: 21, startDate: "2027-01-31", endDate: "2027-02-01" }, // Conference
    { weekNumber: 22, startDate: "2027-02-14", endDate: "2027-02-14" } // Super Bowl LXI
  );
  return out;
}

/**
 * Week numbers that exist for this sport.
 * NFL: 1–22 (RS 1–18 + playoffs). CFB: 0–18.
 */
export function listSeasonWeekNumbers(
  sportId?: string | null
): number[] {
  const sport = resolveCalendarSport(sportId);
  if (sport === "nfl") {
    return Array.from({ length: NFL_SEASON_MAX_WEEK }, (_, i) => i + 1);
  }
  return Array.from({ length: FULL_SEASON_MAX_WEEK + 1 }, (_, i) => i);
}

/** First pick'em week for the sport (NFL starts at 1). */
export function firstSeasonWeek(sportId?: string | null): number {
  const weeks = listSeasonWeekNumbers(sportId);
  return weeks[0] ?? 1;
}

/** Last week index for the sport (NFL Super Bowl = 22). */
export function seasonMaxWeek(sportId?: string | null): number {
  return resolveCalendarSport(sportId) === "nfl"
    ? NFL_SEASON_MAX_WEEK
    : FULL_SEASON_MAX_WEEK;
}

/** After this week is scored, Championship / Toilet fields lock. */
export function cutLockWeek(sportId?: string | null): number {
  return resolveCalendarSport(sportId) === "nfl"
    ? NFL_CUT_LOCK_WEEK
    : DEFAULT_CUT_LOCK_WEEK;
}

/** Bracket advancement weeks (CFP 15–18 or NFL playoffs 19–22). */
export function bracketWeeksForSport(
  sportId?: string | null
): readonly number[] {
  return resolveCalendarSport(sportId) === "nfl"
    ? NFL_PLAYOFF_WEEKS
    : ([15, 16, 17, 18] as const);
}

const NFL_WINDOWS_2026 = buildNflWindows2026();

/** Active league sport when available (client). Safe default: cfb. */
export function resolveCalendarSport(
  explicit?: string | null
): "cfb" | "nfl" {
  if (explicit === "nfl" || explicit === "cfb") return explicit;
  try {
    // Lazy import avoids any circular load issues at module init
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLeague } = require("./league") as typeof import("./league");
    return getLeague()?.sportId === "nfl" ? "nfl" : "cfb";
  } catch {
    return "cfb";
  }
}

function utcNoonFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function ymdFromUtcNoon(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekDateWindow(
  weekNumber: number,
  sportId?: string | null
): WeekDateWindow | null {
  const sport = resolveCalendarSport(sportId);
  const bank = sport === "nfl" ? NFL_WINDOWS_2026 : WINDOWS_2026;
  return bank.find((w) => w.weekNumber === weekNumber) || null;
}

/** Human range e.g. "Aug 29, 2026" or "Sep 3–7, 2026" */
export function weekDateRangeLabel(
  weekNumber: number,
  sportId?: string | null
): string {
  const w = weekDateWindow(weekNumber, sportId);
  if (!w) return "";
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  if (w.startDate === w.endDate) return fmt(w.startDate);
  const a = fmt(w.startDate);
  const b = fmt(w.endDate);
  // "Sep 3, 2026" + "Sep 7, 2026" → "Sep 3–7, 2026" when same month/year
  const [aMonthDay, aYear] = [a.replace(/,?\s*\d{4}$/, ""), a.match(/\d{4}/)?.[0]];
  const [bMonthDay, bYear] = [b.replace(/,?\s*\d{4}$/, ""), b.match(/\d{4}/)?.[0]];
  if (aYear === bYear && aMonthDay.split(" ")[0] === bMonthDay.split(" ")[0]) {
    const startDay = aMonthDay.split(" ")[1];
    const endDay = bMonthDay.split(" ")[1];
    return `${aMonthDay.split(" ")[0]} ${startDay}–${endDay}, ${aYear}`;
  }
  return `${a} – ${b}`;
}

/**
 * Inclusive ET window: startDate 00:00:00 America/New_York → endDate 23:59:59.999 ET.
 */
export function weekWindowMs(
  weekNumber: number,
  sportId?: string | null
): {
  startMs: number;
  endMs: number;
} | null {
  const w = weekDateWindow(weekNumber, sportId);
  if (!w) return null;
  return {
    startMs: etStartOfDayMs(w.startDate),
    endMs: etEndOfDayMs(w.endDate),
  };
}

/** Midnight America/New_York on civil date YYYY-MM-DD → epoch ms. */
function etStartOfDayMs(ymd: string): number {
  // Prefer EDT (-04:00); if that lands on a different ET calendar day, use EST (-05:00).
  let t = Date.parse(`${ymd}T00:00:00-04:00`);
  if (etYmd(t) !== ymd) {
    t = Date.parse(`${ymd}T00:00:00-05:00`);
  }
  return t;
}

function etEndOfDayMs(ymd: string): number {
  // Start of next calendar day in ET, minus 1ms
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return etStartOfDayMs(nextYmd) - 1;
}

function etYmd(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

export function filterGamesForWeek<
  T extends { commenceTime?: string; startTime?: string },
>(games: T[], weekNumber: number, sportId?: string | null): T[] {
  const win = weekWindowMs(weekNumber, sportId);
  if (!win) return games;
  return games.filter((g) => {
    const raw = g.commenceTime || g.startTime;
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    return t >= win.startMs && t <= win.endMs;
  });
}

/** CFB phase map (week 14 = conf champ cut, 15–18 = CFP). */
export function seasonPhase(weekNumber: number): SeasonPhase {
  if (weekNumber === 0) return "week0";
  if (weekNumber >= 1 && weekNumber <= 13) return "regular";
  if (weekNumber === 14) return "conf_championship";
  if (weekNumber === 15) return "cfp_r1";
  if (weekNumber === 16) return "cfp_qf";
  if (weekNumber === 17) return "cfp_sf";
  if (weekNumber === 18) return "cfp_final";
  return "other";
}

/** NFL-aware phase: 1–18 RS, 19–22 playoffs (honest labels). */
export function seasonPhaseForSport(
  weekNumber: number,
  sportId?: string | null
): SeasonPhase {
  if (resolveCalendarSport(sportId) === "nfl") {
    if (weekNumber >= 1 && weekNumber <= 17) return "regular";
    if (weekNumber === 18) return "conf_championship"; // cut week (end of RS)
    if (weekNumber === 19) return "cfp_r1";
    if (weekNumber === 20) return "cfp_qf";
    if (weekNumber === 21) return "cfp_sf";
    if (weekNumber === 22) return "cfp_final";
    return "other";
  }
  return seasonPhase(weekNumber);
}

export function weekTitle(
  weekNumber: number,
  sportId?: string | null
): string {
  const sport = resolveCalendarSport(sportId);
  if (sport === "nfl") {
    if (weekNumber >= 1 && weekNumber <= 18) {
      return weekNumber === 18
        ? "Week 18 · Final RS"
        : `Week ${weekNumber}`;
    }
    if (weekNumber === 19) return "Wild Card";
    if (weekNumber === 20) return "Divisional";
    if (weekNumber === 21) return "Conference";
    if (weekNumber === 22) return "Super Bowl";
    return `Week ${weekNumber}`;
  }
  switch (seasonPhase(weekNumber)) {
    case "week0":
      return "Week 0";
    case "conf_championship":
      return "Conf. Champ";
    case "cfp_r1":
      return "CFP R1";
    case "cfp_qf":
      return "CFP QF";
    case "cfp_sf":
      return "CFP SF";
    case "cfp_final":
      return "CFP Final";
    default:
      return `Week ${weekNumber}`;
  }
}

export function weekSubtitle(
  weekNumber: number,
  sportId?: string | null
): string {
  const sport = resolveCalendarSport(sportId);
  const range = weekDateRangeLabel(weekNumber, sport);
  const rangeBit = range ? ` ${range}.` : "";
  if (sport === "nfl") {
    if (weekNumber >= 1 && weekNumber <= 17) {
      if (weekNumber === 1) {
        return `Official NFL Week 1 (Thu–Mon).${rangeBit} Kickoff week. Counts toward standings.`;
      }
      return `Official NFL Week ${weekNumber} (Thu–Mon).${rangeBit} Counts toward standings.`;
    }
    if (weekNumber === 18) {
      return `Official NFL Week 18 — final regular season.${rangeBit} After scoring, cut locks Championship vs Toilet.`;
    }
    if (weekNumber === 19) {
      return `Wild Card weekend.${rangeBit} Playoff card — higher weekly score advances the bracket.`;
    }
    if (weekNumber === 20) {
      return `Divisional round.${rangeBit} Playoff card — bracket advancement.`;
    }
    if (weekNumber === 21) {
      return `Conference championships.${rangeBit} Playoff card — bracket advancement.`;
    }
    if (weekNumber === 22) {
      return `Super Bowl LXI.${rangeBit} Final card of the year.`;
    }
    return range ? `Pick'em card · ${range}.` : "Pick'em card for this week.";
  }
  switch (seasonPhase(weekNumber)) {
    case "week0":
      return `Special kickoff Saturday only (${range || "Aug 29, 2026"}). Separate card from Week 1.`;
    case "regular":
      if (weekNumber === 1) {
        return `Opening weekend Thu–Mon.${rangeBit} Not Week 0. Counts toward standings.`;
      }
      if (weekNumber === 13) {
        return `Late regular season.${rangeBit} Last RS window before Conf Champ.`;
      }
      return `Regular-season Thu–Mon window.${rangeBit} Counts toward standings & the cut.`;
    case "conf_championship":
      return `Conference championship weekend.${rangeBit} After scoring, cut locks Championship vs Toilet.`;
    case "cfp_r1":
      return `CFP first round.${rangeBit} Bracket advancement week.`;
    case "cfp_qf":
      return `CFP quarterfinals / NY6.${rangeBit} Bracket advancement week.`;
    case "cfp_sf":
      return `CFP semifinals.${rangeBit} Bracket advancement week.`;
    case "cfp_final":
      return `CFP National Championship.${rangeBit} Final bracket week.`;
    default:
      return range ? `Pick'em card · ${range}.` : "Pick'em card for this week.";
  }
}

export function weekPillHint(
  weekNumber: number,
  sportId?: string | null
): string {
  const sport = resolveCalendarSport(sportId);
  if (sport === "nfl") {
    if (weekNumber === 18) return "CUT";
    if (weekNumber === 19) return "wild card";
    if (weekNumber === 20) return "divisional";
    if (weekNumber === 21) return "conference";
    if (weekNumber === 22) return "Super Bowl";
    return "";
  }
  switch (seasonPhase(weekNumber)) {
    case "week0":
      return "openers";
    case "conf_championship":
      return "CUT";
    case "cfp_r1":
    case "cfp_qf":
    case "cfp_sf":
      return "playoff";
    case "cfp_final":
      return "title";
    default:
      return "";
  }
}

/** Human summary for settings / docs. */
export const SEASON_SCRUB_SUMMARY = {
  week0: "1 independent opener week (run alone if you want)",
  regularSeason: "13 pick'em weeks (Week 1–13)",
  confChampionship: "1 week (app week 14) — locks Championship vs Toilet cut",
  cfpPlayoffs: "4 weeks (15–18): R1, QF, SF, National Championship",
  totalCardsMax: 19, // weeks 0 through 18 inclusive
  cutLocksAfterWeek: DEFAULT_CUT_LOCK_WEEK,
};

/** NFL-facing season map copy for commissioner settings */
export const NFL_SEASON_SCRUB_SUMMARY = {
  week0: "None — starts at official NFL Week 1",
  regularSeason:
    "NFL Weeks 1–18 exactly (Thu–Mon). Same numbers as the league.",
  cutWeek: "After Week 18 (final RS) — Championship vs Toilet locks",
  playoffs:
    "App weeks 19–22: Wild Card · Divisional · Conference · Super Bowl LXI (Feb 14)",
  weekShape: "Thu→Mon. Official NFL week numbers. Not made-up.",
  totalCardsMax: NFL_SEASON_MAX_WEEK,
  cutLocksAfterWeek: NFL_CUT_LOCK_WEEK,
  firstKickoff: "2026-09-10 ~8:20 PM ET (Kickoff)",
  week1: "2026-09-10 – 2026-09-14",
  superBowl: "2027-02-14 Super Bowl LXI",
  preseasonCounts: false,
};
