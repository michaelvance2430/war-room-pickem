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

/** Highest week index in the full calendar (0…N inclusive). */
export const FULL_SEASON_MAX_WEEK = 18;

/** After this week is scored, Championship / Toilet fields lock from standings. */
export const DEFAULT_CUT_LOCK_WEEK = 14;

/** Default highest week number in commissioner week pills. */
export const DEFAULT_SEASON_WEEKS = 18;

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
  switch (seasonPhase(weekNumber)) {
    case "week0":
      return "Independent openers — own card & scores. Does not set the Championship/Toilet cut by itself.";
    case "regular":
      if (weekNumber === 1) {
        return "First real regular-season card (separate from Week 0). Counts toward standings.";
      }
      if (weekNumber === 13) {
        return "Late regular season — last RS Saturday(s) before conference title week.";
      }
      return "Regular-season slate — counts toward standings & the cut.";
    case "conf_championship":
      return "Conference championship games. After this week is scored, top cut → Championship bracket, rest → Toilet Bowl.";
    case "cfp_r1":
      return "CFP first round. Brackets locked — weekly scores advance matchups (optional pick'em card).";
    case "cfp_qf":
      return "CFP quarterfinals / New Year’s Six window. Bracket advancement week.";
    case "cfp_sf":
      return "CFP semifinals. Bracket advancement week.";
    case "cfp_final":
      return "CFP National Championship. Final bracket week.";
    default:
      return "Pick'em card for this week.";
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
