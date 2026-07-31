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
    body: "For each game, pick who covers the spread — not just who wins. + means underdog, − means favorite.",
  },
  {
    title: "2. Confidence 1–5",
    body: "Give each game a unique number 1–5. That’s the points you score if you’re right. Use 5 on your strongest lean.",
  },
  {
    title: "3. Best Bet",
    body: "Mark one game as Best Bet. Hit it = those confidence points double. Miss it = zero on that game.",
  },
  {
    title: "4. Prop",
    body: "Answer the weekly prop for bonus points (usually 3).",
  },
  {
    title: "5. Lock before first kickoff",
    body: "Hit Save when all five games + Best Bet + prop are filled. ALL picks must be locked before the first kickoff on the slate. After that the whole card freezes — no edits, no late locks. Miss it = 0 points. No makeups.",
  },
];
