/**
 * Shared league rules — player survival guide (Rules page + short onboarding).
 * Describes production behavior; does not redefine scoring/locks.
 */

export type RuleLine =
  | string
  | {
      text: string;
      /** Extra weight for irreversible consequences only */
      bold?: boolean;
    };

export type RuleSection = {
  title: string;
  body: RuleLine[];
  /** Highlighted box (lock callout, etc.) */
  callout?: boolean;
  /** Optional expandable block under the section */
  expand?: {
    label: string;
    body: string[];
  };
};

export const RULES_SEEN_KEY = "warroom-rules-seen-v2";

/** Page cold open — binding product copy */
export const RULES_COLD_OPEN =
  "Thursday. Friday. Saturday. Sunday. Monday. Football has declared war on the calendar.";

/** Shared 30-second north star */
export const RULES_THIRTY_SECOND: RuleLine[] = [
  {
    bold: true,
    text: "Cover the spread. Rank 5→1 once each. Save Picks before first kickoff—or score nothing.",
  },
  "1. Pick who covers the spread on each game.",
  "2. Rank confidence 5 through 1 — each number once.",
  "3. Finish the card and hit Save Picks before the first kickoff on that week’s slate — or you score zero.",
];

const SPREADS_EXPAND = {
  label: "How spreads work",
  body: [
    "The number on the card is the line.",
    "−7.5 means that team is favored. They must win by more than 7.5 for that side to cover.",
    "+7.5 means that team is the underdog. They cover if they win outright or lose by 7 or fewer.",
    "You’re picking against the spread—not just picking who wins.",
  ],
};

const THIS_WEEK: RuleSection = {
  title: "This week’s job",
  body: [
    "When the card is live, open My Picks (Home may say Make Picks or Finish Card — same place).",
    "You’ll get five games plus a weekly prop.",
    "For each game: pick the side that covers the spread (against the number on the card).",
    "Give each game unique confidence: 5, 4, 3, 2, 1 — each once. 5 = most sure.",
    "Mark one game Best Bet (a hit doubles those confidence points).",
    "Answer the prop.",
    "Tap Save Picks. Later edits: Update Picks.",
  ],
  expand: SPREADS_EXPAND,
};

const LOCK_OR_ZERO: RuleSection = {
  title: "Lock or zero",
  callout: true,
  body: [
    {
      bold: true,
      text: "The whole card freezes at the first kickoff on that week’s slate — every game and the prop.",
    },
    {
      bold: true,
      text: "No Save Picks before that? Zero points for the week. No makeups. No partial credit.",
    },
    "Already saved? You can still Update Picks until first kickoff. After that: frozen for everyone.",
  ],
};

const HOW_YOU_SCORE: RuleSection = {
  title: "How you score",
  body: [
    "Correct ATS pick = its confidence points.",
    "Correct Best Bet = those points ×2. Miss = 0 on that game.",
    "Correct prop = the points shown on this week’s card.",
    "Season standings = sum of your weeks. Only submitted cards count.",
  ],
};

const SEASON_CFB: RuleSection = {
  title: "How the season ends",
  body: [
    "Week 0 may contain a real scored card. It does not independently trigger the championship cut.",
    "Chase points through the regular season into Conference Championships (Week 14).",
    "After that week is scored, the field splits at your league’s cut line — Championship bracket vs Toilet Bowl.",
    "CFP weeks (15–18): still pick; higher weekly score advances your bracket matchup.",
    "Hardware lives in the Trophy Room after the season.",
  ],
};

const SEASON_NFL: RuleSection = {
  title: "How the season ends",
  body: [
    "Official NFL Weeks 1–18 (Thu–Mon football).",
    "After Week 18 is scored, the field splits at your league’s cut line — Championship vs Toilet Bowl.",
    "Playoff weeks: higher weekly score advances the matchup.",
    "Divisions display as AFC/NFC East–West labels — same four seats under the hood.",
    "Hardware lives in the Trophy Room after the season.",
  ],
};

const CRYSTAL_CFB: RuleSection = {
  title: "Crystal Ball",
  callout: true,
  body: [
    "Pick who wins the national championship. Zero standings points — pure pride.",
    {
      bold: true,
      text: "Locks at the earliest of: noon ET Sat Aug 29, 2026; Week 0 first kickoff; or Week 0 scored. No take-backs.",
    },
    "Home may send you to Lock Crystal Ball while it’s open.",
  ],
};

const CRYSTAL_NFL: RuleSection = {
  title: "Super Bowl pick",
  callout: true,
  body: [
    "Your Team = NFL allegiance (who you ride with). Super Bowl Pick = who you think wins it all. Separate answers.",
    "Super Bowl pick is pride only — zero standings points.",
    {
      bold: true,
      text: "Locks at the earliest of: noon ET Thu Sep 10, 2026; Week 1 first kickoff; or Week 1 scored. No take-backs.",
    },
    "Home may say Make Super Bowl Pick / Lock Crystal Ball while it’s open.",
  ],
};

const THE_ROOM: RuleSection = {
  title: "The room",
  body: [
    "Announcements = official league word. Read them.",
    "Locker Room = optional short trash talk — not the rulebook.",
    "Trophy Room = permanent engraved hardware for the league. Season reset doesn’t wipe it.",
    "Cap 32 players so both brackets finish clean. Bigger group → second league code.",
  ],
};

const FINE_PRINT: RuleSection = {
  title: "Fine print",
  body: [
    "If the commissioner changes the slate, My Picks refreshes — re-check and Save Picks / Update Picks while the card is still open.",
  ],
};

/** Full Rules pack for one sport. Crystal section only when enabled. */
export function getRulesForSport(
  sportId?: string | null,
  opts?: { crystalBallEnabled?: boolean; short?: boolean }
): {
  intro: string;
  sections: RuleSection[];
  thirtySecond: RuleLine[];
  coldOpen: string;
} {
  const nfl = sportId === "nfl";
  const crystalOn = opts?.crystalBallEnabled !== false;
  const short = !!opts?.short;

  if (short) {
    return {
      coldOpen: RULES_COLD_OPEN,
      intro: "",
      thirtySecond: RULES_THIRTY_SECOND,
      sections: [LOCK_OR_ZERO],
    };
  }

  const sections: RuleSection[] = [
    {
      title: "The 30-second version",
      body: RULES_THIRTY_SECOND,
    },
    THIS_WEEK,
    LOCK_OR_ZERO,
    HOW_YOU_SCORE,
    nfl ? SEASON_NFL : SEASON_CFB,
  ];

  if (crystalOn) {
    sections.push(nfl ? CRYSTAL_NFL : CRYSTAL_CFB);
  }

  sections.push(THE_ROOM, FINE_PRINT);

  return {
    coldOpen: RULES_COLD_OPEN,
    intro: "",
    thirtySecond: RULES_THIRTY_SECOND,
    sections,
  };
}

/** @deprecated Use getRulesForSport — kept for rare imports */
export const RULES_INTRO =
  "Cover the spread. Rank 5→1 once each. Save Picks before first kickoff—or score nothing.";
export const RULES_INTRO_NFL = RULES_INTRO;
export const RULE_SECTIONS: RuleSection[] = getRulesForSport("cfb").sections;

export function hasSeenRules(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markRulesSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RULES_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}
