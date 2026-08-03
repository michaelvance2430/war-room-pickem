import type { OnboardingJourney, OnboardingJourneyId } from "../types";
import { playerJourney } from "./player";
import { commissionerJourney } from "./commissioner";

const REGISTRY: Record<OnboardingJourneyId, OnboardingJourney> = {
  player: playerJourney,
  commissioner: commissionerJourney,
};

export function getJourney(id: OnboardingJourneyId): OnboardingJourney {
  return REGISTRY[id];
}

export function listJourneys(): OnboardingJourney[] {
  return Object.values(REGISTRY);
}
