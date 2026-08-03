/**
 * One-time contextual coaching keys.
 * Never a single tutorial_completed flag — each milestone is independent.
 */

export const COACH_KEYS = {
  /** Per league · commissioner */
  COMMISH_BUILD_FIRST_CARD: "coach_commissioner_build_first_card",
  COMMISH_PUBLISH_FIRST_CARD: "coach_commissioner_publish_first_card",
  COMMISH_INVITE_MEMBERS: "coach_commissioner_invite_members",
  /** Per league · player */
  PLAYER_MAKE_FIRST_PICKS: "coach_player_make_first_picks",
  PLAYER_SUBMIT_FIRST_PICKS: "coach_player_submit_first_picks",
  PLAYER_VIEW_FIRST_RESULTS: "coach_player_view_first_results",
} as const;

export type CoachKey = (typeof COACH_KEYS)[keyof typeof COACH_KEYS];

export type CoachScope = "league" | "account";

export type CoachDefinition = {
  key: CoachKey;
  scope: CoachScope;
  /** Commissioner vs player surface */
  role: "commissioner" | "player";
  title: string;
  body: string;
  primaryLabel: string;
  /** Where the primary button sends them */
  href: string;
  secondaryLabel: string;
};

/** First-ship prompts only (no multi-step walkthrough recreation). */
export const COACH_DEFS: Record<CoachKey, CoachDefinition> = {
  [COACH_KEYS.COMMISH_INVITE_MEMBERS]: {
    key: COACH_KEYS.COMMISH_INVITE_MEMBERS,
    scope: "league",
    role: "commissioner",
    title: "👋 One thing to get started",
    body: "Invite friends so your league isn’t empty. One share is enough.",
    primaryLabel: "Share invite",
    href: "/#invite-friends",
    secondaryLabel: "Not now",
  },
  [COACH_KEYS.COMMISH_BUILD_FIRST_CARD]: {
    key: COACH_KEYS.COMMISH_BUILD_FIRST_CARD,
    scope: "league",
    role: "commissioner",
    title: "👋 One thing to get started",
    body: "Build your first card so your league can make picks.",
    primaryLabel: "Build card",
    href: "/commissioner?tab=card&first=1",
    secondaryLabel: "Not now",
  },
  [COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD]: {
    key: COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD,
    scope: "league",
    role: "commissioner",
    title: "Publish so friends can pick",
    body: "A draft isn’t live. Publish the week card to open picks for the room.",
    primaryLabel: "Open host tools",
    href: "/commissioner?tab=card",
    secondaryLabel: "Not now",
  },
  [COACH_KEYS.PLAYER_MAKE_FIRST_PICKS]: {
    key: COACH_KEYS.PLAYER_MAKE_FIRST_PICKS,
    scope: "league",
    role: "player",
    title: "👋 One thing to get started",
    body: "Open My Picks and fill this week’s card. That’s the weekly job.",
    primaryLabel: "Make picks",
    href: "/picks",
    secondaryLabel: "Not now",
  },
  [COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS]: {
    key: COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS,
    scope: "league",
    role: "player",
    title: "Lock it in",
    body: "When the card looks right, hit Save / Lock so you’re on the board.",
    primaryLabel: "Finish picks",
    href: "/picks",
    secondaryLabel: "Not now",
  },
  [COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS]: {
    key: COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS,
    scope: "league",
    role: "player",
    title: "Your first results are in",
    body: "A week was scored. Check Standings to see how you did.",
    primaryLabel: "View standings",
    href: "/standings",
    secondaryLabel: "Not now",
  },
};

/** Offer order — one prompt at a time. */
export const COACH_OFFER_ORDER: CoachKey[] = [
  COACH_KEYS.COMMISH_INVITE_MEMBERS,
  COACH_KEYS.COMMISH_BUILD_FIRST_CARD,
  COACH_KEYS.COMMISH_PUBLISH_FIRST_CARD,
  COACH_KEYS.PLAYER_MAKE_FIRST_PICKS,
  COACH_KEYS.PLAYER_SUBMIT_FIRST_PICKS,
  COACH_KEYS.PLAYER_VIEW_FIRST_RESULTS,
];
