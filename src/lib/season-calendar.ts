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

export function weekDateWindow(weekNumber: number): WeekDateWindow | null {
  return WINDOWS_2026.find((w) => w.weekNumber === weekNumber) || null;
}

/** Human range e.g. "Aug 29, 2026" or "Sep 3–7, 2026" */
export function weekDateRangeLabel(weekNumber: number): string {
  const w = weekDateWindow(weekNumber);
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
export function weekWindowMs(weekNumber: number): {
  startMs: number;
  endMs: number;
} | null {
  const w = weekDateWindow(weekNumber);
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
>(games: T[], weekNumber: number): T[] {
  const win = weekWindowMs(weekNumber);
  if (!win) return games;
  return games.filter((g) => {
    const raw = g.commenceTime || g.startTime;
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    return t >= win.startMs && t <= win.endMs;
  });
}

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

export function weekTitle(weekNumber: number): string {
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

export function weekSubtitle(weekNumber: number): string {
  const range = weekDateRangeLabel(weekNumber);
  const rangeBit = range ? ` ${range}.` : "";
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

export function weekPillHint(weekNumber: number): string {
  switch (seasonPhase(weekNumber)) {
    case "week0":
      return "openers";
    case "conf_championship":
      return "CUT";
    case "cfp_r1":
      return "playoff";
    case "cfp_qf":
      return "playoff";
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
