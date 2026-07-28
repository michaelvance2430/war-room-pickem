import type { Prop } from "./types";

export type PropPreset = {
  id: string;
  /** Short label for the dropdown */
  label: string;
  question: string;
  options: [string, string];
  points: number;
  /** Fun / serious tag for the list */
  vibe: "chaos" | "classic" | "spicy";
};

/**
 * Commissioner prop menu — pick one, or use Custom.
 * Keep options binary so the pick sheet stays simple.
 */
export const PROP_PRESETS: PropPreset[] = [
  {
    id: "highest-total",
    label: "Highest-scoring game goes Over 55.5",
    question: "Will the highest-scoring game on the card go Over 55.5 total points?",
    options: ["Over 55.5", "Under 55.5"],
    points: 3,
    vibe: "classic",
  },
  {
    id: "blowout",
    label: "Any game decided by 21+ points?",
    question: "Will any game on this week's card be decided by 21 or more points?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "classic",
  },
  {
    id: "upset",
    label: "Dog covers (or wins outright)",
    question: "Will at least one underdog on the card cover the spread?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "classic",
  },
  {
    id: "shutout-half",
    label: "Any team held under 10 points?",
    question: "Will any team on the card score fewer than 10 points?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "spicy",
  },
  {
    id: "ot",
    label: "Any game goes to overtime?",
    question: "Will any game on this week's card go to overtime?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "spicy",
  },
  {
    id: "combined-total",
    label: "All 5 games combined Over 280.5?",
    question: "Will the combined total points of all 5 games go Over 280.5?",
    options: ["Over 280.5", "Under 280.5"],
    points: 3,
    vibe: "classic",
  },
  {
    id: "coach-rant",
    label: "Coach mic'd-up meltdown vibes",
    question:
      "Will a coach on this card have a postgame soundbite that goes viral (league chat decides)?",
    options: ["Yes — chaos", "No — boring"],
    points: 3,
    vibe: "chaos",
  },
  {
    id: "trash-talk",
    label: "Flag / ejections / drama",
    question:
      "Will there be a targeting ejection OR a player ejection on any card game?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "chaos",
  },
  {
    id: "ranked-lose",
    label: "Ranked team loses outright?",
    question:
      "Will a ranked team (AP/FPI Top 25) on this card lose the game outright?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "spicy",
  },
  {
    id: "fg-decides",
    label: "Game decided by a field goal?",
    question:
      "Will any game on the card be decided by a field goal (margin of 1–3)?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "classic",
  },
  {
    id: "special-teams",
    label: "Special teams / defensive TD?",
    question:
      "Will any card game feature a special teams or defensive touchdown?",
    options: ["Yes", "No"],
    points: 3,
    vibe: "spicy",
  },
  {
    id: "toilet-energy",
    label: "Toilet Bowl energy (chaos prop)",
    question:
      "Will the War Room group chat need a formal apology from someone this week?",
    options: ["Yes — own it", "No — angels only"],
    points: 3,
    vibe: "chaos",
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
  const hit = PROP_PRESETS.find(
    (p) =>
      p.question === prop.question ||
      prop.id.includes(p.id)
  );
  return hit?.id || CUSTOM_PROP_ID;
}
