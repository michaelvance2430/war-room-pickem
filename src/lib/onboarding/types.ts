/**
 * War Room onboarding engine — data-driven journeys.
 * Immersion rule: illuminate War Room; never cover it or replace it.
 * Conversation: speak → user acts → react → celebrate → next
 */

export type OnboardingJourneyId = "player" | "commissioner";

export type CelebrationTier = "none" | "micro" | "peak";

/** Guide attention inside the app (bottom nav), not outside it */
export type PointAtTarget =
  | "home"
  | "picks"
  | "standings"
  | "locker"
  | "commissioner"
  | null;

export type SuccessCondition =
  | { type: "manual" }
  | { type: "pathname"; includes: string }
  | { type: "sessionFlag"; key: string; value?: string }
  | { type: "localFlag"; key: string }
  | { type: "event"; name: string }
  | { type: "always" };

export type ConversationBeat = {
  kicker?: string;
  title: string;
  /** Host voice — short */
  speak: string;
  whyCare?: string;
  /** Slim top strip only — never a huge practice panel */
  practiceBanner?: boolean;
  celebrate?: CelebrationTier;
  celebrateCopy?: string;
  explainAfter?: string;
  nextHint?: string;
  /** Point at real nav so user drives the app */
  pointAt?: PointAtTarget;
  /**
   * Exactly one actionable UI cue this beat ("Start Here").
   * Never leave the host wondering what to click.
   */
  startHere?: boolean;
};

export type OnboardingAction = {
  label: string;
  href?: string;
  resolveHref?: "tutorialPicks" | "commissionerCard" | "commissionerResults" | "home";
  advancesOnClick?: boolean;
};

export type OnboardingStep = {
  id: string;
  goal: string;
  conversation: ConversationBeat;
  action?: OnboardingAction;
  secondaryAction?: { label: string; skipTo?: string | "complete" };
  successCondition: SuccessCondition;
  nextStep: string | null;
  futureSteps?: string[];
  /** fullscreen only for true peaks (welcome once, final once) */
  layout?: "coach" | "fullscreen";
};

export type OnboardingJourney = {
  id: OnboardingJourneyId;
  name: string;
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
  completed: Partial<Record<OnboardingJourneyId, boolean>>;
  active: boolean;
  journeyId: OnboardingJourneyId | null;
  stepId: string | null;
  phase: OnboardingRuntimePhase;
  userId?: string;
  practicePicksHref?: string;
};

export const ONBOARDING_EVENT = "warroom-onboarding";
export const ONBOARDING_STORAGE_KEY = "warroom-onboarding-v1";
