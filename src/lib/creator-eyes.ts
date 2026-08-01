/**
 * Creator “everyone’s eyes” — one-click surface previews.
 * Founder only. Local to this browser. Does not change server permissions.
 *
 * - new_player: quiet nav, first-week Home, player chrome (no Run the Room)
 * - new_commissioner: simple host mode (fill seats yes/no, no deep bot lab)
 */

import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { setViewAsPlayer } from "@/lib/view-as-player";
import {
  clearCreatorSandbox,
  saveCreatorSandbox,
} from "@/lib/creator-sandbox";

const KEY = "warroom-creator-eyes-v1";
export const EVENT_CREATOR_EYES = "warroom-creator-eyes";

export type CreatorEyesMode = "off" | "new_player" | "new_commissioner";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify(mode: CreatorEyesMode) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_CREATOR_EYES, { detail: mode })
    );
    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
    window.dispatchEvent(new CustomEvent("warroom-first-week-progress"));
    window.dispatchEvent(new CustomEvent("warroom-view-as-player"));
    window.dispatchEvent(new CustomEvent("warroom-creator-sandbox"));
  } catch {
    /* ignore */
  }
}

export function isCreatorEyesSession(): boolean {
  return isAppCreator(getSession()?.playerId);
}

export function getCreatorEyesMode(): CreatorEyesMode {
  if (!canUse() || !isCreatorEyesSession()) return "off";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "new_player" || v === "new_commissioner") return v;
  } catch {
    /* ignore */
  }
  return "off";
}

export function isCreatorEyesActive(): boolean {
  return getCreatorEyesMode() !== "off";
}

/**
 * Enter / exit eyes mode.
 * Applies progressive sandbox + player-view chrome as needed.
 */
export function setCreatorEyesMode(mode: CreatorEyesMode): void {
  if (!canUse()) return;
  if (!isCreatorEyesSession() && mode !== "off") return;

  try {
    if (mode === "off") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }

  if (mode === "new_player") {
    // Quiet surface: week 1, no scored weeks, onboarding chrome
    saveCreatorSandbox({
      enabled: true,
      weekNumber: 1,
      scoredCount: 0,
      phase: "onboarding",
    });
    // Hide Commish chrome even if you own the room
    setViewAsPlayer(true);
  } else if (mode === "new_commissioner") {
    // Host surface: simple Run the Room (no progressive player hide required)
    saveCreatorSandbox({
      enabled: true,
      weekNumber: 1,
      scoredCount: 0,
      phase: "onboarding",
    });
    setViewAsPlayer(false);
  } else {
    // off — leave sandbox as-is unless we clear it for cleanliness
    clearCreatorSandbox();
    setViewAsPlayer(false);
  }

  notify(mode);
}

export function creatorEyesLabel(mode: CreatorEyesMode = getCreatorEyesMode()): string {
  switch (mode) {
    case "new_player":
      return "NEW PLAYER EYES";
    case "new_commissioner":
      return "NEW COMMISSIONER EYES";
    default:
      return "";
  }
}

export function creatorEyesBlurb(mode: CreatorEyesMode): string {
  switch (mode) {
    case "new_player":
      return "Quiet nav · first-week Home · no Run the Room · Gazette shelf hidden";
    case "new_commissioner":
      return "Simple host · fill seats yes/no · deep bot tools hidden · checklist spine";
    default:
      return "Normal creator view";
  }
}
