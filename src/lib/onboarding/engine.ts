/**
 * Onboarding engine — single source of truth for journey state.
 * Conversation loop: speak → await → celebrate → explain → next.
 */

import {
  ONBOARDING_EVENT,
  ONBOARDING_STORAGE_KEY,
  type OnboardingJourney,
  type OnboardingJourneyId,
  type OnboardingPersistedState,
  type OnboardingRuntimePhase,
  type OnboardingStep,
} from "./types";
import { getJourney } from "./journeys/registry";
import { isSuccessConditionMet } from "./conditions";

const DEFAULT: OnboardingPersistedState = {
  completed: {},
  active: false,
  journeyId: null,
  stepId: null,
  phase: "idle",
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readOnboardingState(): OnboardingPersistedState {
  if (!canUse()) return { ...DEFAULT, completed: {} };
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT, completed: {} };
    const p = JSON.parse(raw) as Partial<OnboardingPersistedState>;
    return {
      ...DEFAULT,
      ...p,
      completed: { ...DEFAULT.completed, ...(p.completed || {}) },
    };
  } catch {
    return { ...DEFAULT, completed: {} };
  }
}

function write(state: OnboardingPersistedState) {
  if (!canUse()) return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ok */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_EVENT, { detail: state })
    );
  } catch {
    /* ok */
  }
}

export function getActiveJourney(): OnboardingJourney | null {
  const s = readOnboardingState();
  if (!s.active || !s.journeyId) return null;
  return getJourney(s.journeyId);
}

export function getActiveStep(): OnboardingStep | null {
  const journey = getActiveJourney();
  const s = readOnboardingState();
  if (!journey || !s.stepId) return null;
  return journey.steps.find((x) => x.id === s.stepId) || null;
}

export function isOnboardingActive(): boolean {
  const s = readOnboardingState();
  return s.active && s.phase !== "idle" && s.phase !== "complete";
}

export function hasCompletedJourney(id: OnboardingJourneyId): boolean {
  return !!readOnboardingState().completed[id];
}

export function needsJourney(id: OnboardingJourneyId): boolean {
  return !hasCompletedJourney(id);
}

export function startJourney(
  journeyId: OnboardingJourneyId,
  opts?: { userId?: string; force?: boolean }
): OnboardingPersistedState {
  if (!opts?.force && hasCompletedJourney(journeyId)) {
    return readOnboardingState();
  }
  const journey = getJourney(journeyId);
  if (!journey?.steps.length) return readOnboardingState();
  const first = journey.steps[0];
  const next: OnboardingPersistedState = {
    ...readOnboardingState(),
    active: true,
    journeyId,
    stepId: first.id,
    phase: "speak",
    userId: opts?.userId,
  };
  write(next);
  return next;
}

export function skipJourney(): OnboardingPersistedState {
  const s = readOnboardingState();
  if (!s.journeyId) {
    const idle = { ...s, active: false, phase: "idle" as const, stepId: null };
    write(idle);
    return idle;
  }
  const next: OnboardingPersistedState = {
    ...s,
    active: false,
    phase: "idle",
    stepId: null,
    journeyId: null,
    completed: { ...s.completed, [s.journeyId]: true },
  };
  write(next);
  return next;
}

export function setPracticePicksHref(href: string) {
  const s = readOnboardingState();
  write({ ...s, practicePicksHref: href });
}

/**
 * User acknowledged speak / tapped primary that advances without nav.
 * Moves speak → awaiting (or complete if always condition).
 */
export function acknowledgeSpeak(): OnboardingPersistedState {
  const s = readOnboardingState();
  const step = getActiveStep();
  if (!s.active || !step) return s;

  if (step.successCondition.type === "always") {
    return beginCelebrate(s, step);
  }
  if (step.successCondition.type === "manual" && !step.action?.href) {
    // Manual step without nav — wait for explicit continue
    const next = { ...s, phase: "awaiting" as OnboardingRuntimePhase };
    write(next);
    return next;
  }
  const next = { ...s, phase: "awaiting" as OnboardingRuntimePhase };
  write(next);
  return next;
}

/** Primary CTA continue after success / manual next */
export function confirmStepComplete(): OnboardingPersistedState {
  const s = readOnboardingState();
  const step = getActiveStep();
  if (!s.active || !step) return s;
  return beginCelebrate(s, step);
}

function beginCelebrate(
  s: OnboardingPersistedState,
  step: OnboardingStep
): OnboardingPersistedState {
  const tier = step.conversation.celebrate || "none";
  if (tier === "none") {
    return advanceToNext(s, step);
  }
  // micro + peak both pause so the user always gets recognition → next
  // (Host auto-advances micro after a short beat; peak waits for dismiss.)
  const next = { ...s, phase: "celebrate" as OnboardingRuntimePhase };
  write(next);
  return next;
}

/** After peak celebration dismiss */
export function finishCelebration(): OnboardingPersistedState {
  const s = readOnboardingState();
  const step = getActiveStep();
  if (!step) return s;
  return advanceToNext(s, step);
}

function advanceToNext(
  s: OnboardingPersistedState,
  step: OnboardingStep
): OnboardingPersistedState {
  if (!step.nextStep || !s.journeyId) {
    return completeActiveJourney(s);
  }
  const journey = getJourney(s.journeyId);
  const nextStep = journey?.steps.find((x) => x.id === step.nextStep);
  if (!nextStep) {
    return completeActiveJourney(s);
  }
  const next: OnboardingPersistedState = {
    ...s,
    stepId: nextStep.id,
    phase: "speak",
  };
  write(next);
  return next;
}

function completeActiveJourney(
  s: OnboardingPersistedState
): OnboardingPersistedState {
  if (!s.journeyId) {
    const idle = { ...s, active: false, phase: "idle" as const, stepId: null };
    write(idle);
    return idle;
  }
  const next: OnboardingPersistedState = {
    ...s,
    active: false,
    phase: "complete",
    stepId: null,
    completed: { ...s.completed, [s.journeyId]: true },
    journeyId: null,
  };
  write(next);
  return next;
}

/**
 * Secondary CTA: skip-to target, complete journey, or treat as "I did it"
 * (manual / soft confirm) and celebrate → next.
 */
export function secondarySkip(): OnboardingPersistedState {
  const s = readOnboardingState();
  const step = getActiveStep();
  if (!s.active || !step) return s;
  if (step.secondaryAction?.skipTo === "complete") {
    return completeActiveJourney(s);
  }
  if (step.secondaryAction?.skipTo) {
    const journey = s.journeyId ? getJourney(s.journeyId) : null;
    const target = journey?.steps.find(
      (x) => x.id === step.secondaryAction?.skipTo
    );
    if (target) {
      const next = { ...s, stepId: target.id, phase: "speak" as const };
      write(next);
      return next;
    }
  }
  // "I've done this" — complete current step with celebration rules
  return beginCelebrate(s, step);
}

/**
 * Poll / path check — if success condition met while awaiting, celebrate.
 */
export function evaluateSuccess(pathname: string | null): OnboardingPersistedState {
  const s = readOnboardingState();
  if (!s.active || s.phase !== "awaiting") return s;
  const step = getActiveStep();
  if (!step) return s;
  if (isSuccessConditionMet(step.successCondition, { pathname })) {
    return beginCelebrate(s, step);
  }
  return s;
}

/** Force complete for Account replay */
export function resetJourney(journeyId: OnboardingJourneyId) {
  const s = readOnboardingState();
  const completed = { ...s.completed };
  delete completed[journeyId];
  write({
    ...s,
    completed,
    active: false,
    journeyId: null,
    stepId: null,
    phase: "idle",
  });
}

export function markJourneyComplete(journeyId: OnboardingJourneyId) {
  const s = readOnboardingState();
  write({
    ...s,
    completed: { ...s.completed, [journeyId]: true },
    active: false,
    journeyId: null,
    stepId: null,
    phase: "idle",
  });
}
