/**
 * War Room onboarding engine — data-driven journeys.
 * Constitution: Promise, Founder Rule, identity, celebration restraint.
 *
 * Conversation model (game coaching, not docs):
 *   System speaks → User acts → System reacts → Celebrate → Explain → Next
 */

export type OnboardingJourneyId = "player" | "commissioner";

export type CelebrationTier = "none" | "micro" | "peak";

/** How we know the user completed this beat */
export type SuccessCondition =
  | { type: "manual" }
  | { type: "pathname"; includes: string }
  | { type: "sessionFlag"; key: string; value?: string }
  | { type: "localFlag"; key: string }
  | { type: "event"; name: string }
  | { type: "always" };

export type ConversationBeat = {
  /** Eyebrow / chapter label */
  kicker?: string;
  /** Main headline — short */
  title: string;
  /** One or two sentences max — why this exists */
  speak: string;
  /** Optional: why care (War Room identity, not mechanics dump) */
  whyCare?: string;
  /** Show practice / sandbox banner */
  practiceBanner?: boolean;
  /** After success, before next */
  celebrate?: CelebrationTier;
  celebrateCopy?: string;
  /** What just happened (trust) */
  explainAfter?: string;
  /** Point to next action */
  nextHint?: string;
};

export type OnboardingAction = {
  label: string;
  href?: string;
  /** Resolve live vs practice picks, etc. */
  resolveHref?: "tutorialPicks" | "commissionerCard" | "commissionerResults";
  /** Primary continues journey after navigation */
  advancesOnClick?: boolean;
};

/**
 * One step in a journey — configuration only, no app-scattered if/else.
 */
export type OnboardingStep = {
  id: string;
  goal: string;
  conversation: ConversationBeat;
  action?: OnboardingAction;
  /** Secondary: skip beat, mark complete, jump */
  secondaryAction?: { label: string; skipTo?: string | "complete" };
  successCondition: SuccessCondition;
  nextStep: string | null;
  /** Optional preview of upcoming goals (not a dump) */
  futureSteps?: string[];
  /** Full-screen peak (welcome / you're ready) vs sticky coach */
  layout?: "coach" | "fullscreen";
};

export type OnboardingJourney = {
  id: OnboardingJourneyId;
  name: string;
  /** Felt end-state for this journey */
  successFeeling: string;
  steps: OnboardingStep[];
};

export type OnboardingRuntimePhase =
  | "idle"
  | "speak"
  | "awaiting"
  | "celebrate"
  | "complete";

export type OnboardingPersistedState = {
  /** journeyId → finished */
  completed: Partial<Record<OnboardingJourneyId, boolean>>;
  active: boolean;
  journeyId: OnboardingJourneyId | null;
  stepId: string | null;
  phase: OnboardingRuntimePhase;
  userId?: string;
  /** Practice picks href when resolved */
  practicePicksHref?: string;
};

export const ONBOARDING_EVENT = "warroom-onboarding";
export const ONBOARDING_STORAGE_KEY = "warroom-onboarding-v1";
