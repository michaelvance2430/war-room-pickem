/** Shared league rules — used by onboarding popup + Rules page. */

export type RuleLine =
  | string
  | {
      text: string;
      /** Extra weight for lock deadlines / must-read lines */
      bold?: boolean;
    };

export type RuleSection = {
  title: string;
  body: RuleLine[];
  /** Draw a highlighted box around this section (Crystal Ball lock, etc.) */
  callout?: boolean;
};

export const RULES_SEEN_KEY = "warroom-rules-seen-v2";

export const RULES_INTRO =
  "College football pick'em against the spread. Five games each week, confidence points, one Best Bet multiplier, and a weekly prop.";

export const RULE_SECTIONS: RuleSection[] = [
  {
    title: "1. Go to My Picks",
    body: [
      "Open My Picks once the commissioner publishes the week’s card.",
      "You’ll see five games plus a weekly prop.",
    ],
  },
  {
    title: "2. Pick who covers the spread",
    body: [
      "For each game, pick the side you think will cover (win against the posted line).",
      "Negative odds (e.g. −7.5) mean that team is favored — they’re predicted to win by that many points.",
      "Positive odds (e.g. +7.5) mean that team is the underdog — they’re predicted to lose (or cover if they stay within the number).",
      "You’re not just picking the winner — you’re picking against the number locked on the card.",
    ],
  },
  {
    title: "3. Confidence 1–5",
    body: [
      "Assign each game a unique confidence: 1, 2, 3, 4, or 5.",
      "That number is how many points you earn if that pick is correct.",
      "Use 5 on the game you’re most sure about; use 1 on your weakest lean.",
      "You must use each number exactly once per week.",
    ],
  },
  {
    title: "4. Best Bet (multiplier)",
    body: [
      "Choose one game as your Best Bet.",
      "If that pick hits, those confidence points count double (2×).",
      "If it misses, you don’t get those points (same as any wrong pick).",
    ],
  },
  {
    title: "5. Weekly prop",
    body: [
      "Answer the binary prop for the week (Yes/No or Over/Under style).",
      "Correct prop picks earn bonus points (usually 3).",
    ],
  },
  {
    title: "6. Save your card",
    body: [
      "Hit Save Picks when everything is filled in: side + confidence on all five, one Best Bet, and a prop choice.",
      "Weekly game picks lock at each game’s kickoff — no exceptions. Prop locks at the first kickoff on that card.",
      "Only you can see your weekly picks — league mates cannot spy on your card.",
    ],
  },
  {
    title: "Scoring & standings",
    body: [
      "Weekly score = confidence points for correct ATS picks (+ double for a correct Best Bet) + prop points if you hit the prop.",
      "Season standings total your weekly points.",
      "Week 0 (openers) is optional and independent. Real season runs Week 1 → late RS → Conference Championships.",
      "After Conference Championship week is scored, the cut locks: top half → Championship bracket, bottom → Toilet Bowl.",
      "CFP weeks (R1 / QF / SF / Final) advance those brackets — higher weekly score wins the matchup.",
    ],
  },
  {
    title: "Crystal Ball (preseason) — READ THIS",
    callout: true,
    body: [
      "Optional league feature — commissioner can turn it on/off under Settings.",
      "Before the season starts, pick who you think wins the national championship. Worth zero standings points — pure pride.",
      {
        bold: true,
        text: "LOCK: Crystal Ball picks lock at 12:00 noon ET on Saturday, August 29, 2026 (Week 0). After that, you CANNOT change your pick. No exceptions. No take-backs.",
      },
      {
        bold: true,
        text: "Do it early. If you skip Crystal Ball and it locks, you are stuck without a pick for the whole season.",
      },
      "If you're right when the commissioner crowns the champion, you earn: Village Witch / Wizard Nerd (still zero points).",
      "Open Crystal Ball from the nav menu while it’s still open.",
    ],
  },
  {
    title: "Trophy Room",
    body: [
      "After the season, the commissioner engraves winners: Championship, Toilet Bowl, and Village Nerd (Crystal Ball).",
      "History stays with the league year after year — even if players join/leave or the commissioner is passed on.",
      "Season reset does not wipe the Trophy Room.",
    ],
  },
  {
    title: "Locker Room",
    body: [
      "Optional league chat for short trash talk (280 characters max).",
      "Tap football emojis, post takes, delete your own. Commissioner can delete any message.",
      "Not for official rules — use Announcements for that.",
    ],
  },
  {
    title: "League size",
    body: [
      "Leagues cap at 32 players.",
      "Why: top half → Championship (up to 16), bottom half → Toilet Bowl (up to 16). A 16-team bracket needs 4 rounds — exactly the CFP window (weeks 15–18).",
      "If your group is bigger, start a second league with its own code.",
      "Optional: commissioner can pad empty seats with bots up to 32. Bots auto-pick from coded personas (chalk / dogs / sharp). Clear bots anytime — real players stay.",
    ],
  },
  {
    title: "Profile & tips",
    body: [
      "Upload a profile photo under Account so the league knows who’s who.",
      "If the commissioner changes the week’s games, My Picks refreshes automatically — re-check and Save if the slate changed.",
      "Revisit these rules anytime under Rules in the menu.",
    ],
  },
];

export function hasSeenRules(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === "1";
  } catch {
    return false;
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
