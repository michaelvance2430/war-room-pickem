import type { Prop } from "./types";

/** Top-level prop menu (Commish picks category first). */
export type PropCategory = "players" | "teams" | "funny" | "odd";

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
};

/**
 * Commissioner prop menu — category → question.
 *
 * Auto props: objective from final scores + locked spreads only.
 * Manual props: real pick’em flavor (yards, TDs, fumbles) — host settles from box score.
 */
export const PROP_PRESETS: PropPreset[] = [
  // ——— PLAYERS (manual — no player stats in odds feed yet) ———
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

  // ——— TEAMS (auto from scores / ATS) ———
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

  // ——— FUNNY (mostly auto from scores) ———
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

  // ——— ODD (manual — box-score weirdness) ———
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
      "Will ANY team miss an extra-point kick (or fail a 2-pt conversion attempt counts only if you choose kick XP miss — use official XP misses) on this week's card?",
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
];

export const CUSTOM_PROP_ID = "custom";

export function presetsForCategory(cat: PropCategory): PropPreset[] {
  return PROP_PRESETS.filter((p) => p.category === cat);
}

export function getPropPreset(id: string): PropPreset | undefined {
  return PROP_PRESETS.find((p) => p.id === id);
}

export function categoryForPresetId(id: string): PropCategory {
  return getPropPreset(id)?.category || "teams";
}

export function propFromPreset(preset: PropPreset, weekNumber = 1): Prop {
  return {
    id: `prop-${preset.id}-w${weekNumber}`,
    question: preset.question,
    options: [...preset.options] as [string, string],
    points: preset.points,
  };
}

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
    if (preset.id.includes("cover") || preset.id.includes("favorite") || preset.id.includes("dog"))
      return "covers";
    return "scoring";
  }
  return "scoring";
}
