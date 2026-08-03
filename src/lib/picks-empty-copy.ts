/**
 * Role-aware Picks empty state (no card for the week).
 *
 * Commissioner: locked option #0 — "You had one job…"
 * Player: War Room buddy voice — light roast of the host, never customer-support.
 *         Rotates daily (ET) and again on hard reset (new browser session).
 *
 * Routing stays: Build Card vs Go to Locker.
 */

export type PicksEmptyCopy = {
  eyebrow: string;
  title: string;
  body: string;
  /** Primary CTA label */
  cta: string;
};

/**
 * Host / commissioner / deputy — they can actually build the card.
 * Locked primary: index 0.
 */
export const COMMISH_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "Commish · one job",
    title: "You had one job…",
    body: "The room is staring at a blank week because the card still lives in your head. Build it. Publish it. Let them pick.",
    cta: "Build Card",
  },
  // Kept as archive if we ever want variety for hosts later
  {
    eyebrow: "Your move",
    title: "Your league is waiting on you.",
    body: "Players can’t invent the slate. Until you build this week’s card, My Picks is just a waiting room with your name on the door.",
    cta: "Build Card",
  },
  {
    eyebrow: "Host bottleneck",
    title: "Nothing to pick until you drop a card.",
    body: "They’re ready. You’re the only person who can open the door. Five games, one prop, publish — then the room can breathe.",
    cta: "Build Card",
  },
  {
    eyebrow: "Friendly pressure",
    title: "The players can’t make picks until you build the card.",
    body: "This isn’t a bug. It’s you. Own it, build the week, and stop making the group chat wonder if the app is broken.",
    cta: "Build Card",
  },
  {
    eyebrow: "Commish mirror",
    title: "Blank slate. Your fault. Fixable.",
    body: "War Room doesn’t invent games for you. Open the card builder, pick five, publish. Then you can lock your own picks like a normal human.",
    cta: "Build Card",
  },
  {
    eyebrow: "Host tip",
    title: "No card, no picks, no excuses.",
    body: "You started the room. The room is waiting. Build the card before someone starts a petition in the Locker.",
    cta: "Build Card",
  },
  {
    eyebrow: "Season’s waiting",
    title: "Still no card for this week.",
    body: "Anticipation is great. Indefinite silence is not. Build the week so the rivalry can start arguing about spreads instead of you.",
    cta: "Build Card",
  },
  {
    eyebrow: "Do this now",
    title: "You’re blocking the whole league.",
    body: "Not dramatically — literally. No published card means nobody can lock. Hit Build Card and unstick the room.",
    cta: "Build Card",
  },
];

/**
 * Player (non-ops) — buddy across the room, not support desk.
 * Light roast of the commissioner. CTA always Locker (peer pressure).
 * These rotate (see resolvePlayerPicksEmptyCopy).
 */
export const PLAYER_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "Empty slate",
    title:
      "No card yet. Your commissioner appears to be conducting an extensive research project.",
    body: "You’re fine. The app is fine. The host is somewhere between “almost done” and “forgot football exists.” Hit the Locker and apply friendly pressure.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Empty slate",
    title:
      "No card yet. Apparently your commissioner believes football starts next week.",
    body: "It doesn’t. Season’s open. Nudge them in the Locker — peer pressure is part of the sport.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Empty slate",
    title:
      "No card yet. Maybe remind your commissioner the season didn’t get postponed.",
    body: "Nothing to lock until they publish. Go stir the Locker. Keep it fun. Make them feel the group chat energy.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Buddy note",
    title: "Looks like your commissioner overslept.",
    body: "Or got lost in odds. Either way: no slate, no picks. The Locker is where the room gently (or not so gently) wakes the host up.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Buddy note",
    title: "Commish is still “finalizing” the card. In theory.",
    body: "You’re ready. The week isn’t. Drop a “card when?” in the Locker and keep the room warm until the slate lands.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Group chat energy",
    title: "The host has the keys. The door is still locked.",
    body: "Not your job to invent five games. It is your job to make sure they know people are waiting. Locker’s open.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Waiting (with swagger)",
    title: "Picks are closed for renovation. Host contractor: your commissioner.",
    body: "Hang in the Locker. Roast lightly. Celebrate when the card finally drops like it was always the plan.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Waiting (with swagger)",
    title: "No slate. Your commissioner is speedrunning the silent treatment.",
    body: "Don’t invent urgency that isn’t yours — invent a Locker thread. Friendly peer pressure beats staring at an empty week.",
    cta: "Go to Locker",
  },
];

/** Commissioner stays on the winner. */
export const ACTIVE_COMMISH_PICKS_EMPTY_INDEX = 0;

const PLAYER_EMPTY_SALT_KEY = "warroom-picks-empty-player-salt-v1";

function etDayKey(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value || "0";
    const m = parts.find((p) => p.type === "month")?.value || "0";
    const d = parts.find((p) => p.type === "day")?.value || "0";
    return `${y}-${m}-${d}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Stable-ish hash → non-negative int */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Player empty index:
 * - Changes with Eastern calendar day
 * - New random salt on hard reset (new sessionStorage session)
 * Same day + same tab session → same line (no flicker on soft re-render).
 */
export function resolvePlayerPicksEmptyIndex(now = new Date()): number {
  const n = PLAYER_PICKS_EMPTY_OPTIONS.length;
  if (n <= 1) return 0;

  let salt = "0";
  if (typeof window !== "undefined") {
    try {
      let existing = sessionStorage.getItem(PLAYER_EMPTY_SALT_KEY);
      if (existing == null || existing === "") {
        existing = String(Math.floor(Math.random() * 10_000));
        sessionStorage.setItem(PLAYER_EMPTY_SALT_KEY, existing);
      }
      salt = existing;
    } catch {
      salt = "0";
    }
  }

  const day = etDayKey(now);
  return hashStr(`${day}:${salt}`) % n;
}

export function resolveCommishPicksEmptyCopy(): PicksEmptyCopy {
  const i = Math.max(
    0,
    Math.min(
      COMMISH_PICKS_EMPTY_OPTIONS.length - 1,
      ACTIVE_COMMISH_PICKS_EMPTY_INDEX
    )
  );
  return COMMISH_PICKS_EMPTY_OPTIONS[i]!;
}

export function resolvePlayerPicksEmptyCopy(): PicksEmptyCopy {
  const i = resolvePlayerPicksEmptyIndex();
  return PLAYER_PICKS_EMPTY_OPTIONS[i]!;
}

/** Build Card destination — same host path used elsewhere. */
export const PICKS_EMPTY_BUILD_CARD_HREF = "/commissioner?tab=card";
export const PICKS_EMPTY_LOCKER_HREF = "/locker-room";
