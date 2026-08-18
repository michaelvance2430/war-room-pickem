/**
 * Board copy — truth + flavor.
 *
 * GUARDRAIL
 * ─────────
 * The Board itself always tells the truth (is anything public? open? sealed?).
 * Flavor can get increasingly sarcastic — but never invents league facts
 * ("Mike faded Alabama 12 weeks") unless that is real data.
 * Universal jokes are fine ("Somebody overthought this.").
 *
 * Season voice progression:
 *   Early  (0–3)  → Teach
 *   Mid    (4–9)  → Assume competence
 *   Late   (10–20)→ Roast everyone equally
 *   NFL PO (19–22)→ Playoff veterans (still universal, still true)
 *
 * Index = week number (CFB 0–20, NFL 1–22 Super Bowl).
 */

export type BoardCopy = {
  /** Always true for the board state. */
  status: string;
  /** Progressive personality. No fake league stats. */
  flavor: string;
  emoji?: string;
};

/** @deprecated prefer BoardCopy — kept for any residual callers */
export type BoardEmptyTake = {
  emoji: string;
  title: string;
  body: string;
};

// ─── SEALED (nothing public yet / pre-kickoff) ─────────────────────
// Status = truth about privacy. Flavor progresses teach → roast.

const SEALED: BoardCopy[] = [
  // 0 — Teach
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "Locked cards become public after kickoff.",
  },
  // 1
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "Picks stay secret until the first whistle. That's the whole point.",
  },
  // 2
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "First kickoff opens the room. Until then, nobody peeks.",
  },
  // 3
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "You know the rule: no Board until kickoff. Hang tight.",
  },
  // 4 — assume competence
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "Same vault as always. Whistle first, roast later.",
  },
  // 5
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "You already know how this works. Kickoff is the unlock.",
  },
  // 6
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Patience is hard. Being wrong in public is harder. Wait for it.",
  },
  // 7
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "The Board doesn't do sneak peeks. Neither should you.",
  },
  // 8
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "Cards stay face-down. Drama is scheduled for after kickoff.",
  },
  // 9
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "If you needed a reminder, you wouldn't still be here. Whistle first.",
  },
  // 10 — roast equally
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "We're not early-access-ing your bad decisions. Kickoff only.",
  },
  // 11
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "The vault has higher standards than your confidence ranks.",
  },
  // 12
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "Come back when the ball moves. Until then, pure denial.",
  },
  // 13
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "We've seen enough seasons to know you'll refresh anyway.",
  },
  // 14
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Late-season discipline: wait for kickoff like a professional degenerate.",
  },
  // 15
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Playoff energy, same old rule. No public picks before the whistle.",
  },
  // 16
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "Big week. Empty Board. The math is cruel and correct.",
  },
  // 17
  {
    emoji: "🔒",
    status: "Nothing to reveal yet.",
    flavor: "Everyone's a genius until the cards open. Not yet.",
  },
  // 18
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Endgame rules still apply. Kickoff or nothing.",
  },
  // 19 — NFL Wild Card
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Wild Card week. Still no free looks. Earn the humiliation at kickoff.",
  },
  // 20 — Divisional
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "Divisional round. The vault doesn't care about your bracket.",
  },
  // 21 — Conference
  {
    emoji: "🔒",
    status: "Nothing public yet.",
    flavor: "Conference weekend. Secrets until the first snap. Always.",
  },
  // 22 — Super Bowl
  {
    emoji: "🔒",
    status: "Still sealed.",
    flavor: "Super Bowl card. Same rule as Week 1. Kickoff opens the room.",
  },
];

// ─── OPEN (first kickoff hit — cards revealing) ────────────────────
// Status = truth that the board is open. Flavor progresses teach → roast.

const OPEN: BoardCopy[] = [
  // 0 — Teach
  {
    status: "Cards are public now.",
    flavor: "Compare locked picks. This is the whole point of The Board.",
  },
  // 1
  {
    status: "Everyone's cards are public now.",
    flavor: "See who locked what. No take-backs after kickoff.",
  },
  // 2
  {
    status: "Everyone's cards are public now.",
    flavor:
      "Time to find out who thought the cupcake was the lock of the century.",
  },
  // 3
  {
    status: "The Board is open.",
    flavor: "Bold calls and bad ones live here. Both get witnesses.",
  },
  // 4 — assume competence
  {
    status: "The Board is open.",
    flavor: "You know what to do. Hunt the chaos. Nod at the chalk.",
  },
  // 5
  {
    status: "No more secrets.",
    flavor: "Confidence ranks are public now. Act accordingly.",
  },
  // 6
  {
    status: "No more secrets.",
    flavor: "Somebody really used their Confidence 5 on that game…",
  },
  // 7
  {
    status: "No more secrets.",
    flavor: "Confidence ratings are apparently a work of fiction.",
  },
  // 8
  {
    status: "The Board is open.",
    flavor: "Somebody definitely overthought this. Possibly several somebodies.",
  },
  // 9
  {
    status: "The Board is open.",
    flavor: "If your Best Bet needs a paragraph of justification, it wasn't.",
  },
  // 10 — roast equally
  {
    status: "Welcome back.",
    flavor:
      'Statistically speaking, at least one of you still believes "gut feeling" beats research.',
  },
  // 11
  {
    status: "Welcome back.",
    flavor: "Same room. New excuses. The cards don't care.",
  },
  // 12
  {
    status: "No more secrets.",
    flavor: "We've stopped asking why. We're just documenting it now.",
  },
  // 13
  {
    status: "The Board is open.",
    flavor: "Late season means fewer surprises and louder confidence. Prove it.",
  },
  // 14
  {
    status: "The Board is open.",
    flavor:
      "We've stopped questioning your decision-making. It's healthier this way.",
  },
  // 15
  {
    status: "The Board is open.",
    flavor: "Playoff cards hit different. The witnesses stay the same.",
  },
  // 16
  {
    status: "No more secrets.",
    flavor: "Big stage. Public picks. No alibis that survive a screenshot.",
  },
  // 17
  {
    status: "No more secrets.",
    flavor: "If you're still chalk-maxxing, at least own it out loud.",
  },
  // 18
  {
    status: "The Board is open.",
    flavor: "End of the regular grind. The receipts are all here.",
  },
  // 19 — Wild Card
  {
    status: "The Board is open.",
    flavor: "Wild Card weekend. One-and-done energy. Cards don't flinch.",
  },
  // 20 — Divisional
  {
    status: "No more secrets.",
    flavor: "Divisional round. Everyone's a bracket expert until the Board loads.",
  },
  // 21 — Conference
  {
    status: "The Board is open.",
    flavor: "Conference championships. Public picks. Eternal group-chat fuel.",
  },
  // 22 — Super Bowl
  {
    status: "The Board is open.",
    flavor:
      "Super Bowl card is live. Every lock in this room is now a permanent record.",
  },
];

function atWeek(list: BoardCopy[], week?: number): BoardCopy {
  const n = list.length;
  if (n === 0) {
    return {
      emoji: "🔒",
      status: "Nothing to reveal yet.",
      flavor: "Locked cards become public after kickoff.",
    };
  }
  const w = Number(week);
  const index = Number.isFinite(w) ? Math.trunc(w) : 0;
  return list[((index % n) + n) % n]!;
}

/** Pre-kickoff / empty Board — truth status + progressive flavor. */
export function boardSealedCopy(week?: number): BoardCopy {
  return atWeek(SEALED, week);
}

/** Post-kickoff Board open — truth status + progressive flavor. */
export function boardOpenCopy(week?: number): BoardCopy {
  return atWeek(OPEN, week);
}

/**
 * Empty-state take (sealed). Prefer boardSealedCopy in new code.
 * title = status (truth), body = flavor.
 */
export function boardEmptyTakeAt(week?: number): BoardEmptyTake {
  const c = boardSealedCopy(week);
  return {
    emoji: c.emoji || "🔒",
    title: c.status,
    body: c.flavor,
  };
}

/** @deprecated use boardEmptyTakeAt / boardSealedCopy */
export const BOARD_EMPTY_TAKES: BoardEmptyTake[] = SEALED.map((c) => ({
  emoji: c.emoji || "🔒",
  title: c.status,
  body: c.flavor,
}));
