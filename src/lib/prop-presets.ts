import type { Prop } from "./types";

export type PropPreset = {
  id: string;
  /** Short label for the dropdown */
  label: string;
  question: string;
  options: [string, string];
  points: number;
  vibe: "totals" | "margins" | "covers" | "scoring";
};

/**
 * Commissioner prop menu — pick one, or use Custom.
 *
 * Rules for wording (no arguments later):
 * - Always says "on this week's 5-game card" (or equivalent)
 * - Objective, final-score stats only
 * - Binary Yes/No or Over/Under
 * - No "league chat decides", no vibes, no viral clips
 */
export const PROP_PRESETS: PropPreset[] = [
  {
    id: "any-total-over-55",
    label: "Any of the 5 games finishes Over 55.5 total?",
    question:
      "Will ANY of the five games on this week's card finish with a combined score of 56 or more points (Over 55.5)?",
    options: ["Yes — at least one game ≥ 56", "No — every game ≤ 55"],
    points: 3,
    vibe: "totals",
  },
  {
    id: "any-total-under-40",
    label: "Any of the 5 games finishes Under 40.5 total?",
    question:
      "Will ANY of the five games on this week's card finish with a combined score of 40 or fewer points (Under 40.5)?",
    options: ["Yes — at least one game ≤ 40", "No — every game ≥ 41"],
    points: 3,
    vibe: "totals",
  },
  {
    id: "highest-total-over-60",
    label: "Highest of the 5 game totals Over 60.5?",
    question:
      "Among the five games on this week's card, will the single highest combined final score be 61 or more points (Over 60.5)?",
    options: ["Yes — highest total ≥ 61", "No — highest total ≤ 60"],
    points: 3,
    vibe: "totals",
  },
  {
    id: "all-five-combined-over-280",
    label: "All 5 games' totals combined Over 280.5?",
    question:
      "Will the sum of the five final combined scores on this week's card be 281 or more points (Over 280.5)?",
    options: ["Yes — combined ≥ 281", "No — combined ≤ 280"],
    points: 3,
    vibe: "totals",
  },
  {
    id: "any-margin-21",
    label: "Any of the 5 decided by 21+ points?",
    question:
      "Will ANY of the five games on this week's card be decided by a final margin of 21 or more points (winner score minus loser score ≥ 21)?",
    options: ["Yes — at least one margin ≥ 21", "No — every margin ≤ 20"],
    points: 3,
    vibe: "margins",
  },
  {
    id: "any-margin-3-or-less",
    label: "Any of the 5 decided by 3 or fewer points?",
    question:
      "Will ANY of the five games on this week's card be decided by a final margin of 1, 2, or 3 points?",
    options: ["Yes — at least one margin is 1–3", "No — every margin ≥ 4"],
    points: 3,
    vibe: "margins",
  },
  {
    id: "any-dog-covers",
    label: "Any underdog covers the posted spread?",
    question:
      "Using the spread locked on this week's card when picks closed: will ANY of the five underdogs cover (or win outright if the favorite fails to cover)? A push on that game does NOT count as a cover.",
    options: ["Yes — at least one dog covers", "No — no dog covers"],
    points: 3,
    vibe: "covers",
  },
  {
    id: "favorites-go-3-2-or-better",
    label: "Favorites cover in 3+ of the 5 games?",
    question:
      "Using the spreads locked on this week's card: will the favorite cover in at least 3 of the 5 games? (Push = neither side covers for that game.)",
    options: ["Yes — favorites cover ≥ 3", "No — favorites cover ≤ 2"],
    points: 3,
    vibe: "covers",
  },
  {
    id: "any-team-under-10",
    label: "Any team on the card scores ≤ 9 points?",
    question:
      "Will ANY of the ten teams playing on this week's 5-game card finish with 9 or fewer points?",
    options: ["Yes — at least one team ≤ 9", "No — every team ≥ 10"],
    points: 3,
    vibe: "scoring",
  },
  {
    id: "any-team-over-45",
    label: "Any team on the card scores ≥ 46 points?",
    question:
      "Will ANY of the ten teams playing on this week's 5-game card finish with 46 or more points?",
    options: ["Yes — at least one team ≥ 46", "No — every team ≤ 45"],
    points: 3,
    vibe: "scoring",
  },
  {
    id: "any-ot",
    label: "Any of the 5 games goes to overtime?",
    question:
      "Will ANY of the five games on this week's card be tied at the end of regulation and play at least one overtime period (official final includes OT)?",
    options: ["Yes — at least one game goes to OT", "No — none go to OT"],
    points: 3,
    vibe: "scoring",
  },
  {
    id: "both-teams-25-any-game",
    label: "Any game has BOTH teams ≥ 25 points?",
    question:
      "Will ANY of the five games on this week's card end with both the home team and the away team scoring 25 or more points each?",
    options: ["Yes — at least one game both ≥ 25", "No — never both ≥ 25"],
    points: 3,
    vibe: "scoring",
  },
];

export const CUSTOM_PROP_ID = "custom";

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
  // Prefer exact question text (what we store in week_cards.prop_question)
  const byQuestion = PROP_PRESETS.find((p) => p.question.trim() === q);
  if (byQuestion) return byQuestion.id;
  // ids look like prop-<presetId>-w3
  const byId = PROP_PRESETS.find(
    (p) =>
      prop.id === `prop-${p.id}` ||
      prop.id.startsWith(`prop-${p.id}-`) ||
      prop.id.includes(`-${p.id}-`)
  );
  return byId?.id || CUSTOM_PROP_ID;
}
