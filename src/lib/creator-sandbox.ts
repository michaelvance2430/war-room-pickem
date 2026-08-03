/**
 * Creator internal helpers — progressive week state for “Through Their Eyes”
 * and Foundry moment jump buttons.
 *
 * Creator Test Mode (standalone knobs UI / banner / /founder/test-mode) is gone.
 * Progressive overrides only apply while Creator Eyes are active.
 * Jump helpers fire real events; they do not expose a product “lab”.
 */

import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { weekTitle } from "@/lib/dates";

const STORAGE_KEY = "warroom-creator-sandbox-v1";
export const EVENT_CREATOR_SANDBOX = "warroom-creator-sandbox";
/** Force the week-3 Gazette shelf popup open. */
export const EVENT_FORCE_GAZETTE_SHELF_REVEAL =
  "warroom-force-gazette-shelf-reveal";

export type SandboxPhase =
  | "auto"
  | "onboarding"
  | "core"
  | "deepening"
  | "full";

/** Internal week/phase bag used by Creator Eyes only (not a user-facing mode). */
export type CreatorSandboxState = {
  enabled: boolean;
  weekNumber: number;
  scoredCount: number;
  phase: SandboxPhase;
  sportId: "cfb" | "nfl";
  updatedAt: string;
};

const DEFAULTS: CreatorSandboxState = {
  enabled: false,
  weekNumber: 1,
  scoredCount: 0,
  phase: "auto",
  sportId: "cfb",
  updatedAt: new Date(0).toISOString(),
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_CREATOR_SANDBOX));
    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
    window.dispatchEvent(new CustomEvent("warroom-first-week-progress"));
  } catch {
    /* ignore */
  }
}

export function isCreatorSession(): boolean {
  return isAppCreator(getSession()?.playerId);
}

function isCreatorEyesActiveSafe(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    return eyes.isCreatorEyesActive();
  } catch {
    return false;
  }
}

export function loadCreatorSandbox(): CreatorSandboxState {
  if (!canUse()) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<CreatorSandboxState>;
    return {
      ...DEFAULTS,
      ...p,
      weekNumber: Number(p.weekNumber) || 1,
      scoredCount: Math.max(0, Number(p.scoredCount) || 0),
      phase: (p.phase as SandboxPhase) || "auto",
      sportId: p.sportId === "nfl" ? "nfl" : "cfb",
      enabled: !!p.enabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveCreatorSandbox(
  patch: Partial<CreatorSandboxState>
): CreatorSandboxState {
  const next: CreatorSandboxState = {
    ...loadCreatorSandbox(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (!canUse()) return next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
  return next;
}

export function clearCreatorSandbox(): void {
  if (!canUse()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/**
 * Wipe leftover standalone Test Mode knobs when Eyes are off.
 * Call once on app chrome mount so old browsers don't keep phantom state.
 */
export function clearOrphanedCreatorTestMode(): void {
  if (!canUse() || !isCreatorSession()) return;
  if (isCreatorEyesActiveSafe()) return;
  const s = loadCreatorSandbox();
  if (s.enabled) clearCreatorSandbox();
}

/**
 * True only when Creator Eyes are driving progressive chrome.
 * Standalone “Test Mode” is retired — never active without Eyes.
 */
export function isCreatorSandboxActive(): boolean {
  if (!isCreatorSession()) return false;
  if (!loadCreatorSandbox().enabled) return false;
  return isCreatorEyesActiveSafe();
}

export function derivePhase(
  state: CreatorSandboxState
): Exclude<SandboxPhase, "auto"> {
  if (state.phase !== "auto") return state.phase;
  if (state.scoredCount <= 0 && state.weekNumber <= 1) return "onboarding";
  if (state.scoredCount >= 2 || state.weekNumber >= 3) return "deepening";
  if (state.scoredCount >= 1 || state.weekNumber >= 2) return "core";
  return "onboarding";
}

export function phaseLabel(phase: Exclude<SandboxPhase, "auto">): string {
  switch (phase) {
    case "onboarding":
      return "Onboarding — Picks · Board · Locker only";
    case "core":
      return "Core — locked once; competition loud, depth quiet";
    case "deepening":
      return "Deepening — Gazette shelf / News unlocked (~week 3)";
    case "full":
      return "Full room — everything visible";
  }
}

/** Progressive UI pretends this week only while Creator Eyes are active. */
export function sandboxProgressiveOverrides(): {
  activeWeek: number;
  scoredCount: number;
  firstWeekChrome: boolean;
  showGazetteShelf: boolean;
  showNewsShelf: boolean;
  showDeepTiles: boolean;
  offerGazetteReveal: boolean;
  fullRoom: boolean;
  phase: Exclude<SandboxPhase, "auto">;
} | null {
  if (!isCreatorSandboxActive()) return null;
  const s = loadCreatorSandbox();
  const phase = derivePhase(s);
  const fullRoom = phase === "full";
  const firstWeekChrome = phase === "onboarding";
  const showDeepTiles = phase !== "onboarding";
  const showGazetteShelf = fullRoom || phase === "deepening";
  return {
    activeWeek: s.weekNumber,
    scoredCount: s.scoredCount,
    firstWeekChrome,
    showGazetteShelf,
    showNewsShelf: showGazetteShelf,
    showDeepTiles,
    offerGazetteReveal: false,
    fullRoom,
    phase,
  };
}

// —— Foundry / internal jump helpers (no Test Mode UI) ——

export async function jumpRingCeremony(): Promise<void> {
  const { requestRingCeremonyPreview } = await import("./ring-ceremony");
  requestRingCeremonyPreview({ force: true });
}

export async function jumpCardPublished(weekNumber?: number): Promise<void> {
  let w = weekNumber ?? 1;
  let sport: "cfb" | "nfl" = "cfb";
  try {
    const { getLeague } = await import("./league");
    const league = getLeague();
    if (league?.sportId === "nfl") sport = "nfl";
    if (weekNumber == null) {
      const eyes = loadCreatorSandbox();
      if (isCreatorSandboxActive()) w = eyes.weekNumber;
    }
  } catch {
    /* defaults */
  }
  const { notifyCardPublished } = await import("./first-session");
  notifyCardPublished({
    weekNumber: w,
    weekLabel: weekTitle(w, sport),
  });
}

export function jumpGazetteShelfReveal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_GAZETTE_SHELF_REVEAL));
  }
}

/** Force the actual Gazette paper + cheevo path (Foundry drama, not just shelf). */
export async function jumpGazettePaperAndCheevos(): Promise<void> {
  const { forceFoundryGazetteAndCheevos } = await import("./foundry-preview");
  await forceFoundryGazetteAndCheevos();
}

export function jumpCutStoryDoor(): void {
  void import("./story-doors").then((m) => m.forceStoryDoor("cut"));
}

export function jumpTrophyStoryDoor(): void {
  void import("./story-doors").then((m) => m.forceStoryDoor("trophy"));
}

export function jumpOpenHome(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/";
}

export function jumpOpenPicks(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/picks";
}

export function jumpOpenLocker(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/locker-room";
}

export function jumpOpenGazette(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/gazette";
}
