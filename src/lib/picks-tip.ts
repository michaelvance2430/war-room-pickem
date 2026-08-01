/** “How to make picks” tip on My Picks — skip forever if user opts out. */

export const PICKS_TIP_DISMISSED_KEY = "warroom-picks-tip-never-v1";

export function hasDismissedPicksTip(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PICKS_TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPicksTipNeverAgain(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PICKS_TIP_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Concise steps — people won’t read the full rules. */
export const PICKS_HOW_TO_STEPS: { title: string; body: string }[] = [
  {
    title: "1. Pick a side",
    body: "Who covers the spread — not just who wins. + = dog, − = favorite. Yes, the little numbers matter. Shocking.",
  },
  {
    title: "2. Confidence 1–5",
    body: "Each number once. 5 = “I’m basically a genius.” 1 = “I’m vibing.” Right = that many points. Wrong = zero and quiet shame.",
  },
  {
    title: "3. Best Bet",
    body: "Pick one. Hit it = double those points. Miss it = that game is dust. No refunds. No tears (ok, fine, tears).",
  },
  {
    title: "4. Prop",
    body: "The weekly gimme. Usually ~3 pts. Skip it and the lock button will judge you.",
  },
  {
    title: "5. Lock before first kickoff",
    body: "Hit Lock when everything’s filled. First kickoff freezes the whole card — no late saves, no “one more second.” Miss it = 0 and a milk carton. We warned you.",
  },
];
