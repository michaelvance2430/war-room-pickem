/**
 * Role-aware Picks empty state (no card for the week).
 *
 * Mike picks the active option indices below after reviewing the lists.
 * Copy is personality only — routing stays: Build Card vs Locker.
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
 * Tone: sarcastic, funny, direct. Never mean for its own sake.
 */
export const COMMISH_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "Commish · one job",
    title: "You had one job…",
    body: "The room is staring at a blank week because the card still lives in your head. Build it. Publish it. Let them pick.",
    cta: "Build Card",
  },
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
 * Player (non-ops) — cannot build. Peer pressure + Locker, never “go build the card.”
 */
export const PLAYER_PICKS_EMPTY_OPTIONS: PicksEmptyCopy[] = [
  {
    eyebrow: "Waiting room",
    title: "No card yet — you’re not broken.",
    body: "Your commish hasn’t published this week. Lightly poke them in the Locker. Friendly peer pressure is a feature.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Seated",
    title: "You’re ready. The slate isn’t.",
    body: "Nothing to pick until the host drops a card. Hang in the Locker, stir the pot politely, come back when the week goes live.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Group chat energy",
    title: "Commish is still cooking the card.",
    body: "Or forgetting. Either way, you can’t invent five games. Remind them in the Locker — then come lock when it’s up.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Patience (sort of)",
    title: "Picks open when the card exists.",
    body: "That’s a commissioner job, not yours. Use the Locker to keep the room warm while the host does the host thing.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Not your fault",
    title: "Empty week. Host’s move.",
    body: "You’re in the right place. There’s just nothing to lock yet. Tap the Locker, drop a “card when?” and stay human.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Community",
    title: "The room is waiting together.",
    body: "No published slate for this week. Peer pressure welcome. Mean-spirited pile-ons are not. Locker’s open.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Chill path",
    title: "Nothing to pick. Yet.",
    body: "Your job starts when the card lands. Until then: Locker banter, standings envy, and gentle reminders for the person with the keys.",
    cta: "Go to Locker",
  },
  {
    eyebrow: "Live soon",
    title: "Card still in the oven.",
    body: "Commish has to publish before My Picks wakes up. You’re fine. The app is fine. The host just needs a nudge.",
    cta: "Go to Locker",
  },
];

/** Mike: change these indices after reading the options. */
export const ACTIVE_COMMISH_PICKS_EMPTY_INDEX = 0;
export const ACTIVE_PLAYER_PICKS_EMPTY_INDEX = 0;

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
  const i = Math.max(
    0,
    Math.min(
      PLAYER_PICKS_EMPTY_OPTIONS.length - 1,
      ACTIVE_PLAYER_PICKS_EMPTY_INDEX
    )
  );
  return PLAYER_PICKS_EMPTY_OPTIONS[i]!;
}

/** Build Card destination — same host path used elsewhere. */
export const PICKS_EMPTY_BUILD_CARD_HREF = "/commissioner?tab=card";
export const PICKS_EMPTY_LOCKER_HREF = "/locker-room";
