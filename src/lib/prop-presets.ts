import type { Prop } from "./types";

/** Top-level prop menu (Commish picks category first). */
export type PropCategory = "players" | "teams" | "funny" | "odd";

/** Football sports that share the prop bank today. */
export type PropSport = "cfb" | "nfl";

export const PROP_CATEGORIES: {
  id: PropCategory;
  label: string;
  blurb: string;
}[] = [
  {
    id: "players",
    label: "Players",
    blurb: "QB / skill / defense style O/U — set result from box score after games.",
  },
  {
    id: "teams",
    label: "Teams",
    blurb: "Spreads, totals, covers on this week’s card — auto-scored from finals.",
  },
  {
    id: "funny",
    label: "Funny",
    blurb: "Dumb-but-measurable card props. Most auto-score.",
  },
  {
    id: "odd",
    label: "Odd",
    blurb: "Weird box-score junk (fumbles, returns…). Commish sets Yes/No after games.",
  },
];

/** Light sport-flavored category blurbs for the commish UI. */
export function propCategoriesForSport(sportId?: string | null) {
  const nfl = normalizePropSport(sportId) === "nfl";
  return PROP_CATEGORIES.map((c) => {
    if (c.id === "players") {
      return {
        ...c,
        blurb: nfl
          ? "Pro box-score props (yards, TDs, sacks). You set Yes/No after games."
          : "Campus box-score props (air raids, workhorse RBs, pick parties). You set Yes/No after games.",
      };
    }
    if (c.id === "teams") {
      return {
        ...c,
        blurb: nfl
          ? "NFL spreads, totals, covers on this week’s card — auto from finals."
          : "Saturday spreads, shootout totals, covers on this week’s card — auto from finals.",
      };
    }
    if (c.id === "funny") {
      return {
        ...c,
        blurb: nfl
          ? "Primetime dumb props — chalk sweeps, 3-spots, road dogs. Mostly auto."
          : "Campus chaos props — 60-burgers, home dogs, chalk sweeps. Mostly auto.",
      };
    }
    return {
      ...c,
      blurb: nfl
        ? "Weird pro junk (returns, blocks, dual-100s). Commish settles after games."
        : "Weird campus junk (pick-sixes, 2-pts, blocks). Commish settles after games.",
    };
  });
}

export type PropPreset = {
  id: string;
  category: PropCategory;
  /** Short label for the second dropdown */
  label: string;
  question: string;
  options: [string, string];
  points: number;
  /**
   * auto = settle from final scores/ATS (prop-settle.ts)
   * manual = commissioner picks the answer after games (player/odd stats)
   */
  settle: "auto" | "manual";
  /**
   * Which sports show this preset in the dropdown.
   * Omit or empty = available for both CFB and NFL.
   */
  sports?: PropSport[];
};

export function normalizePropSport(sportId?: string | null): PropSport {
  return sportId === "nfl" ? "nfl" : "cfb";
}

export function presetFitsSport(
  p: PropPreset,
  sportId?: string | null
): boolean {
  if (!p.sports || p.sports.length === 0) return true;
  return p.sports.includes(normalizePropSport(sportId));
}

/**
 * Commissioner prop menu — category → question.
 *
 * Shared bank + CFB-only / NFL-only flavor lines so dual-sport rooms
 * don't feel copy-pasted. Auto props still need scores/ATS only.
 */
export const PROP_PRESETS: PropPreset[] = [
  // ——— PLAYERS (shared, manual) ———
  {
    id: "pl-qb-pass-yds-250",
    category: "players",
    label: "Any QB 250+ pass yds?",
    question:
      "Will ANY starting QB in the five games on this week's card throw for 250 or more passing yards (official final box score)?",
    options: ["Yes — at least one QB ≥ 250", "No — every QB ≤ 249"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-qb-pass-yds-300",
    category: "players",
    label: "Any QB 300+ pass yds?",
    question:
      "Will ANY QB in the five games on this week's card throw for 300 or more passing yards?",
    options: ["Yes — at least one QB ≥ 300", "No — every QB ≤ 299"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-qb-pass-td-3",
    category: "players",
    label: "Any QB 3+ pass TDs?",
    question:
      "Will ANY QB in the five games on this week's card throw 3 or more touchdown passes?",
    options: ["Yes — at least one QB ≥ 3 pass TDs", "No — every QB ≤ 2"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-qb-int-2",
    category: "players",
    label: "Any QB 2+ INTs?",
    question:
      "Will ANY QB in the five games on this week's card throw 2 or more interceptions?",
    options: ["Yes — at least one QB ≥ 2 INTs", "No — every QB ≤ 1 INT"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-rb-rush-100",
    category: "players",
    label: "Any RB 100+ rush yds?",
    question:
      "Will ANY running back in the five games on this week's card rush for 100 or more yards?",
    options: ["Yes — at least one RB ≥ 100", "No — every RB ≤ 99"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-rb-rush-td-2",
    category: "players",
    label: "Any RB 2+ rush TDs?",
    question:
      "Will ANY running back in the five games on this week's card score 2 or more rushing touchdowns?",
    options: ["Yes — at least one RB ≥ 2 rush TDs", "No — every RB ≤ 1"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-wr-rec-100",
    category: "players",
    label: "Any WR 100+ rec yds?",
    question:
      "Will ANY wide receiver in the five games on this week's card have 100 or more receiving yards?",
    options: ["Yes — at least one WR ≥ 100", "No — every WR ≤ 99"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-wr-rec-td-2",
    category: "players",
    label: "Any WR 2+ rec TDs?",
    question:
      "Will ANY wide receiver in the five games on this week's card catch 2 or more touchdown passes?",
    options: ["Yes — at least one WR ≥ 2 rec TDs", "No — every WR ≤ 1"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-te-rec-60",
    category: "players",
    label: "Any TE 60+ rec yds?",
    question:
      "Will ANY tight end in the five games on this week's card have 60 or more receiving yards?",
    options: ["Yes — at least one TE ≥ 60", "No — every TE ≤ 59"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-k-fg-3",
    category: "players",
    label: "Any kicker 3+ made FGs?",
    question:
      "Will ANY kicker in the five games on this week's card make 3 or more field goals?",
    options: ["Yes — at least one kicker ≥ 3 FGs", "No — every kicker ≤ 2"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-def-sack-3",
    category: "players",
    label: "Any defense 3+ sacks?",
    question:
      "Will ANY of the ten team defenses on this week's card record 3 or more sacks?",
    options: ["Yes — at least one defense ≥ 3 sacks", "No — every defense ≤ 2"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-def-int-2",
    category: "players",
    label: "Any defense 2+ INTs?",
    question:
      "Will ANY of the ten team defenses on this week's card record 2 or more interceptions?",
    options: ["Yes — at least one defense ≥ 2 INTs", "No — every defense ≤ 1"],
    points: 3,
    settle: "manual",
  },

  // ——— PLAYERS · CFB-only (campus ceilings) ———
  {
    id: "pl-cfb-qb-pass-400",
    category: "players",
    sports: ["cfb"],
    label: "Any QB 400+ pass yds? (air raid)",
    question:
      "Saturday special: will ANY QB in the five games on this week's card throw for 400 or more passing yards?",
    options: ["Yes — at least one QB ≥ 400", "No — every QB ≤ 399"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-cfb-qb-pass-td-5",
    category: "players",
    sports: ["cfb"],
    label: "Any QB 5+ pass TDs?",
    question:
      "Will ANY QB in the five games on this week's card throw 5 or more touchdown passes?",
    options: ["Yes — at least one QB ≥ 5 pass TDs", "No — every QB ≤ 4"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-cfb-rb-rush-200",
    category: "players",
    sports: ["cfb"],
    label: "Any RB 200+ rush yds?",
    question:
      "Will ANY running back in the five games on this week's card rush for 200 or more yards?",
    options: ["Yes — at least one RB ≥ 200", "No — every RB ≤ 199"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-cfb-wr-rec-150",
    category: "players",
    sports: ["cfb"],
    label: "Any WR 150+ rec yds?",
    question:
      "Will ANY wide receiver in the five games on this week's card post 150 or more receiving yards?",
    options: ["Yes — at least one WR ≥ 150", "No — every WR ≤ 149"],
    points: 3,
    settle: "manual",
  },

  // ——— PLAYERS · NFL-only (pro ceilings) ———
  {
    id: "pl-nfl-qb-pass-350",
    category: "players",
    sports: ["nfl"],
    label: "Any QB 350+ pass yds?",
    question:
      "Will ANY QB in the five games on this week's card throw for 350 or more passing yards?",
    options: ["Yes — at least one QB ≥ 350", "No — every QB ≤ 349"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-nfl-rb-rush-150",
    category: "players",
    sports: ["nfl"],
    label: "Any RB 150+ rush yds?",
    question:
      "Will ANY running back in the five games on this week's card rush for 150 or more yards?",
    options: ["Yes — at least one RB ≥ 150", "No — every RB ≤ 149"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-nfl-wr-rec-150",
    category: "players",
    sports: ["nfl"],
    label: "Any WR 150+ rec yds?",
    question:
      "Will ANY wide receiver in the five games on this week's card post 150 or more receiving yards?",
    options: ["Yes — at least one WR ≥ 150", "No — every WR ≤ 149"],
    points: 3,
    settle: "manual",
  },
  {
    id: "pl-nfl-k-fg-50",
    category: "players",
    sports: ["nfl"],
    label: "Any made FG from 50+?",
    question:
      "Will ANY kicker on this week's card make a field goal from 50 or more yards?",
    options: ["Yes — at least one FG ≥ 50", "No — no 50+ FG"],
    points: 3,
    settle: "manual",
  },

  // ——— TEAMS (shared, auto) ———
  {
    id: "tm-spreads-3-of-5-under-7",
    category: "teams",
    label: "3+ of 5 games: margin ≤ 7?",
    question:
      "Will at least 3 of the 5 games on this week's card be decided by 7 or fewer points (final margin 1–7)?",
    options: ["Yes — ≥ 3 games margin ≤ 7", "No — ≤ 2 games margin ≤ 7"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-spreads-3-of-5-under-3",
    category: "teams",
    label: "3+ of 5 games: margin ≤ 3?",
    question:
      "Will at least 3 of the 5 games on this week's card be decided by 3 or fewer points (final margin 1–3)?",
    options: ["Yes — ≥ 3 games margin ≤ 3", "No — ≤ 2 games margin ≤ 3"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-spread-cover-dog",
    category: "teams",
    label: "Any underdog covers?",
    question:
      "Using the spread locked on this week's card: will ANY of the five underdogs cover? (Push does NOT count.)",
    options: ["Yes — at least one dog covers", "No — no dog covers"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-favorites-3-covers",
    category: "teams",
    label: "Favorites cover 3+ of 5?",
    question:
      "Using the spreads locked on this week's card: will favorites cover in at least 3 of the 5 games? (Push = no cover.)",
    options: ["Yes — favorites cover ≥ 3", "No — favorites cover ≤ 2"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-total-over-55",
    category: "teams",
    label: "Any game total Over 55.5?",
    question:
      "Will ANY of the five games on this week's card finish with a combined score of 56 or more?",
    options: ["Yes — at least one total ≥ 56", "No — every total ≤ 55"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-total-under-40",
    category: "teams",
    label: "Any game total Under 40.5?",
    question:
      "Will ANY of the five games on this week's card finish with a combined score of 40 or fewer?",
    options: ["Yes — at least one total ≤ 40", "No — every total ≥ 41"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-highest-total-60",
    category: "teams",
    label: "Highest total Over 60.5?",
    question:
      "Among the five games, will the highest combined final score be 61 or more?",
    options: ["Yes — highest ≥ 61", "No — highest ≤ 60"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-combined-280",
    category: "teams",
    label: "All 5 totals combined Over 280.5?",
    question:
      "Will the sum of the five final combined scores be 281 or more points?",
    options: ["Yes — combined ≥ 281", "No — combined ≤ 280"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-margin-21",
    category: "teams",
    label: "Any game margin 21+?",
    question:
      "Will ANY of the five games be decided by 21 or more points?",
    options: ["Yes — at least one margin ≥ 21", "No — every margin ≤ 20"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-team-under-10",
    category: "teams",
    label: "Any team scores ≤ 9?",
    question:
      "Will ANY of the ten teams on this week's card finish with 9 or fewer points?",
    options: ["Yes — at least one team ≤ 9", "No — every team ≥ 10"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-any-team-over-45",
    category: "teams",
    label: "Any team scores ≥ 46?",
    question:
      "Will ANY of the ten teams on this week's card finish with 46 or more points?",
    options: ["Yes — at least one team ≥ 46", "No — every team ≤ 45"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-both-teams-25",
    category: "teams",
    label: "Any game both teams ≥ 25?",
    question:
      "Will ANY game end with both home and away scoring 25 or more points each?",
    options: ["Yes — at least one game both ≥ 25", "No — never both ≥ 25"],
    points: 3,
    settle: "auto",
  },

  // ——— TEAMS · CFB-only (Saturday scoring) ———
  {
    id: "tm-cfb-total-70",
    category: "teams",
    sports: ["cfb"],
    label: "Any game total Over 70.5?",
    question:
      "Campus shootout watch: will ANY of the five games finish with a combined score of 71 or more?",
    options: ["Yes — at least one total ≥ 71", "No — every total ≤ 70"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-cfb-team-56",
    category: "teams",
    sports: ["cfb"],
    label: "Any team scores ≥ 56?",
    question:
      "Will ANY of the ten teams on this week's card finish with 56 or more points?",
    options: ["Yes — at least one team ≥ 56", "No — every team ≤ 55"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-cfb-margin-35",
    category: "teams",
    sports: ["cfb"],
    label: "Any blowout margin 35+?",
    question:
      "Will ANY of the five games be decided by 35 or more points?",
    options: ["Yes — at least one margin ≥ 35", "No — every margin ≤ 34"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-cfb-both-30",
    category: "teams",
    sports: ["cfb"],
    label: "Any game both teams ≥ 30?",
    question:
      "Will ANY game end with both home and away scoring 30 or more points each?",
    options: ["Yes — at least one game both ≥ 30", "No — never both ≥ 30"],
    points: 3,
    settle: "auto",
  },

  // ——— TEAMS · NFL-only (pro scoring) ———
  {
    id: "tm-nfl-total-under-35",
    category: "teams",
    sports: ["nfl"],
    label: "Any game total Under 35.5?",
    question:
      "Defensive Sunday: will ANY of the five games finish with a combined score of 35 or fewer?",
    options: ["Yes — at least one total ≤ 35", "No — every total ≥ 36"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-nfl-team-under-14",
    category: "teams",
    sports: ["nfl"],
    label: "Any team scores ≤ 13?",
    question:
      "Will ANY of the ten teams on this week's card finish with 13 or fewer points?",
    options: ["Yes — at least one team ≤ 13", "No — every team ≥ 14"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-nfl-total-50",
    category: "teams",
    sports: ["nfl"],
    label: "Any game total Over 50.5?",
    question:
      "Will ANY of the five games finish with a combined score of 51 or more?",
    options: ["Yes — at least one total ≥ 51", "No — every total ≤ 50"],
    points: 3,
    settle: "auto",
  },
  {
    id: "tm-nfl-margin-14",
    category: "teams",
    sports: ["nfl"],
    label: "Any game margin 14+?",
    question:
      "Will ANY of the five games be decided by 14 or more points?",
    options: ["Yes — at least one margin ≥ 14", "No — every margin ≤ 13"],
    points: 3,
    settle: "auto",
  },

  // ——— FUNNY (shared) ———
  {
    id: "fn-all-favorites-cover",
    category: "funny",
    label: "Every favorite covers? (chalk sweep)",
    question:
      "Using locked spreads: will the favorite cover in ALL five games? (Any push or dog cover = No.)",
    options: ["Yes — chalk sweeps all 5", "No — chalk fails at least once"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-all-dogs-cover",
    category: "funny",
    label: "Every dog covers? (chaos sweep)",
    question:
      "Using locked spreads: will every underdog cover all five games? (Any push or favorite cover = No.)",
    options: ["Yes — dogs sweep all 5", "No — not a full dog sweep"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-any-shutout",
    category: "funny",
    label: "Any team gets shut out (0 points)?",
    question:
      "Will ANY team on this week's 5-game card finish with exactly 0 points?",
    options: ["Yes — someone scores 0", "No — everyone scores ≥ 1"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-any-50-burger",
    category: "funny",
    label: "Any team drops 50+ points?",
    question:
      "Will ANY team on this week's card score 50 or more points?",
    options: ["Yes — at least one team ≥ 50", "No — every team ≤ 49"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-same-score-tie",
    category: "funny",
    label: "Any game ends in a tie (regulation)?",
    question:
      "Will ANY of the five games end with home score equal to away score (official final tie, including OT ties where both still equal)?",
    options: ["Yes — at least one tie", "No — every game has a winner"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-combined-under-200",
    category: "funny",
    label: "All 5 totals combined Under 200.5?",
    question:
      "Will the sum of the five combined final scores be 200 or fewer points?",
    options: ["Yes — combined ≤ 200", "No — combined ≥ 201"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-home-teams-sweep",
    category: "funny",
    label: "Home teams go 5–0 straight up?",
    question:
      "Will the home team win all five games on this week's card (straight up, not ATS)?",
    options: ["Yes — home goes 5–0", "No — home loses at least one"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-road-teams-sweep",
    category: "funny",
    label: "Road teams go 5–0 straight up?",
    question:
      "Will the away team win all five games on this week's card (straight up)?",
    options: ["Yes — road goes 5–0", "No — road loses at least one"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-any-ot",
    category: "funny",
    label: "Any game goes to OT?",
    question:
      "Will ANY of the five games play at least one overtime period (check official final)?",
    options: ["Yes — at least one OT", "No — no OT"],
    points: 3,
    settle: "manual",
  },

  // ——— FUNNY · CFB-only ———
  {
    id: "fn-cfb-60-burger",
    category: "funny",
    sports: ["cfb"],
    label: "Any team drops a 60-burger?",
    question:
      "Campus chaos: will ANY team on this week's card score 60 or more points?",
    options: ["Yes — at least one team ≥ 60", "No — every team ≤ 59"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-cfb-dog-14-covers",
    category: "funny",
    sports: ["cfb"],
    label: "Any 14+ dog covers?",
    question:
      "Using locked spreads: will ANY underdog listed at +14 or more cover this week? (Push does NOT count. If no dog is +14+, answer is No.)",
    options: ["Yes — a big dog covers", "No — no +14 dog covers"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-cfb-home-dogs-2",
    category: "funny",
    sports: ["cfb"],
    label: "2+ home underdogs win SU?",
    question:
      "Using locked spreads: will at least 2 home underdogs win straight up on this week's card?",
    options: ["Yes — ≥ 2 home dogs win SU", "No — ≤ 1 home dog wins SU"],
    points: 3,
    settle: "auto",
  },

  // ——— FUNNY · NFL-only ———
  {
    id: "fn-nfl-exactly-3",
    category: "funny",
    sports: ["nfl"],
    label: "Any team scores exactly 3?",
    question:
      "Field-goal special: will ANY team on this week's card finish with exactly 3 points?",
    options: ["Yes — at least one team = 3", "No — nobody finishes on 3"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-nfl-exactly-17",
    category: "funny",
    sports: ["nfl"],
    label: "Any team scores exactly 17?",
    question:
      "Will ANY team on this week's card finish with exactly 17 points?",
    options: ["Yes — at least one team = 17", "No — nobody finishes on 17"],
    points: 3,
    settle: "auto",
  },
  {
    id: "fn-nfl-dogs-win-2-su",
    category: "funny",
    sports: ["nfl"],
    label: "2+ underdogs win straight up?",
    question:
      "Using locked spreads: will at least 2 underdogs win straight up (not just cover) on this week's card?",
    options: ["Yes — ≥ 2 dogs win SU", "No — ≤ 1 dog wins SU"],
    points: 3,
    settle: "auto",
  },

  // ——— ODD (shared, manual) ———
  {
    id: "od-fumbles-3",
    category: "odd",
    label: "3+ fumbles lost on the card?",
    question:
      "Across all five games on this week's card, will there be 3 or more total fumbles lost (team turnovers via fumble)?",
    options: ["Yes — ≥ 3 fumbles lost", "No — ≤ 2 fumbles lost"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-kickoff-td",
    category: "odd",
    label: "Any kickoff returned for a TD?",
    question:
      "Will ANY kickoff be returned for a touchdown in the five games on this week's card?",
    options: ["Yes — at least one KO return TD", "No — no KO return TD"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-punt-td",
    category: "odd",
    label: "Any punt returned for a TD?",
    question:
      "Will ANY punt be returned for a touchdown in the five games on this week's card?",
    options: ["Yes — at least one punt return TD", "No — no punt return TD"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-safety",
    category: "odd",
    label: "Any safety scored?",
    question:
      "Will ANY safety be scored in the five games on this week's card?",
    options: ["Yes — at least one safety", "No — no safeties"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-def-td",
    category: "odd",
    label: "Any defensive/special-teams TD?",
    question:
      "Will ANY defensive or special-teams touchdown be scored (INT/fumble/KO/punt return TD, blocked FG/punt TD, etc.) on this week's card?",
    options: ["Yes — at least one D/ST TD", "No — none"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-missed-xp",
    category: "odd",
    label: "Any missed extra point?",
    question:
      "Will ANY team miss an extra-point kick (failed 2-pt does not count — XP kick miss only) on this week's card?",
    options: ["Yes — at least one missed XP", "No — every XP is good"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-blocked-kick",
    category: "odd",
    label: "Any blocked FG or punt?",
    question:
      "Will ANY field goal or punt be blocked in the five games on this week's card?",
    options: ["Yes — at least one block", "No — no blocks"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-100-rush-rec-same-player",
    category: "odd",
    label: "Any player 100 rush AND 100 rec?",
    question:
      "Will ANY single player on this week's card post 100+ rushing yards AND 100+ receiving yards in the same game?",
    options: ["Yes — unicorn game", "No — no dual-100 player"],
    points: 3,
    settle: "manual",
  },

  // ——— ODD · CFB-only ———
  {
    id: "od-cfb-pick6",
    category: "odd",
    sports: ["cfb"],
    label: "Any pick-six?",
    question:
      "Will ANY interception be returned for a touchdown in the five games on this week's card?",
    options: ["Yes — at least one pick-six", "No — no pick-six"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-cfb-2pt",
    category: "odd",
    sports: ["cfb"],
    label: "Any successful 2-pt conversion?",
    question:
      "Will ANY team convert a 2-point try on this week's card?",
    options: ["Yes — at least one 2-pt good", "No — no successful 2-pt"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-cfb-onside",
    category: "odd",
    sports: ["cfb"],
    label: "Any successful onside kick?",
    question:
      "Will ANY team recover its own onside kick attempt on this week's card?",
    options: ["Yes — at least one onside recovered", "No — no successful onside"],
    points: 3,
    settle: "manual",
  },

  // ——— ODD · NFL-only ———
  {
    id: "od-nfl-missed-fg",
    category: "odd",
    sports: ["nfl"],
    label: "Any missed field goal?",
    question:
      "Will ANY field-goal attempt be missed (no good) in the five games on this week's card?",
    options: ["Yes — at least one missed FG", "No — every FG is good"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-nfl-failed-2pt",
    category: "odd",
    sports: ["nfl"],
    label: "Any failed 2-pt conversion?",
    question:
      "Will ANY team attempt a 2-point conversion and fail on this week's card?",
    options: ["Yes — at least one failed 2-pt", "No — no failed 2-pt"],
    points: 3,
    settle: "manual",
  },
  {
    id: "od-nfl-qb-rush-td",
    category: "odd",
    sports: ["nfl"],
    label: "Any QB rushing TD?",
    question:
      "Will ANY quarterback score a rushing touchdown in the five games on this week's card?",
    options: ["Yes — at least one QB rush TD", "No — no QB rush TD"],
    points: 3,
    settle: "manual",
  },
];

export const CUSTOM_PROP_ID = "custom";

export function presetsForSport(sportId?: string | null): PropPreset[] {
  return PROP_PRESETS.filter(
    (p) => p.settle === "auto" && presetFitsSport(p, sportId)
  );
}

export function presetsForCategory(
  cat: PropCategory,
  sportId?: string | null
): PropPreset[] {
  return PROP_PRESETS.filter(
    (p) =>
      p.settle === "auto" &&
      p.category === cat &&
      presetFitsSport(p, sportId)
  );
}

export function getPropPreset(id: string): PropPreset | undefined {
  return PROP_PRESETS.find((p) => p.id === id);
}

export function categoryForPresetId(id: string): PropCategory {
  return getPropPreset(id)?.category || "teams";
}

/** First preset for a sport (used as draft default). */
export function defaultPropPreset(sportId?: string | null): PropPreset {
  const list = presetsForSport(sportId);
  return list[0] || PROP_PRESETS[0];
}

/** Rotate presets within a sport bank (demo / sandbox). */
export function rotatingPropPreset(
  week: number,
  sportId?: string | null
): PropPreset {
  const list = presetsForSport(sportId);
  if (!list.length) return PROP_PRESETS[0];
  const w = Math.max(0, Math.floor(week));
  return list[w % list.length];
}

export function propFromPreset(preset: PropPreset, weekNumber = 1): Prop {
  return {
    id: `prop-${preset.id}-w${weekNumber}`,
    question: preset.question,
    options: [...preset.options] as [string, string],
    points: preset.points,
  };
}

/**
 * Match a published prop back to a preset.
 * Searches the full bank (all sports) so historical cards still resolve.
 */
export function matchPresetId(prop: Prop | null | undefined): string {
  if (!prop?.question) return PROP_PRESETS[0].id;
  const q = prop.question.trim();
  const byQuestion = PROP_PRESETS.find((p) => p.question.trim() === q);
  if (byQuestion) return byQuestion.id;
  const byId = PROP_PRESETS.find(
    (p) =>
      prop.id === `prop-${p.id}` ||
      prop.id.startsWith(`prop-${p.id}-`) ||
      prop.id.includes(p.id)
  );
  if (byId) return byId.id;
  return CUSTOM_PROP_ID;
}

/** Backward-compatible vibe for any old callers */
export function propVibe(
  preset: PropPreset
): "totals" | "margins" | "covers" | "scoring" {
  if (preset.category === "teams") {
    if (preset.id.includes("total")) return "totals";
    if (preset.id.includes("margin") || preset.id.includes("spread"))
      return "margins";
    if (
      preset.id.includes("cover") ||
      preset.id.includes("favorite") ||
      preset.id.includes("dog")
    )
      return "covers";
    return "scoring";
  }
  return "scoring";
}
