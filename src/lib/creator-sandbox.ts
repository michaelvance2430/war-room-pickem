/**
 * Creator-only flight simulator — test features without spinning real leagues.
 * State is local to this browser. Never visible to players.
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

export type CreatorSandboxState = {
  enabled: boolean;
  /** Fake active week for labels / progressive math */
  weekNumber: number;
  /** Pretend this many weeks already scored */
  scoredCount: number;
  /** Override progressive phase (auto = derive from week/scored) */
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

/** Sandbox knobs only apply when enabled AND current user is creator. */
export function isCreatorSandboxActive(): boolean {
  if (!isCreatorSession()) return false;
  return loadCreatorSandbox().enabled;
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

/** What progressive UI should pretend under sandbox. */
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
    offerGazetteReveal: false, // jumps force popup separately
    fullRoom,
    phase,
  };
}

// —— Jump buttons (existing app events) ——

export async function jumpRingCeremony(): Promise<void> {
  const { requestRingCeremonyPreview } = await import("./ring-ceremony");
  requestRingCeremonyPreview({ force: true });
}

export async function jumpCardPublished(weekNumber?: number): Promise<void> {
  const s = loadCreatorSandbox();
  const w = weekNumber ?? s.weekNumber;
  const { notifyCardPublished } = await import("./first-session");
  notifyCardPublished({
    weekNumber: w,
    weekLabel: weekTitle(w, s.sportId),
  });
}

export function jumpGazetteShelfReveal(): void {
  // Put progressive into deepening so nav would show Gazette after dismiss
  saveCreatorSandbox({
    enabled: true,
    weekNumber: Math.max(loadCreatorSandbox().weekNumber, 3),
    scoredCount: Math.max(loadCreatorSandbox().scoredCount, 2),
    phase: "deepening",
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_GAZETTE_SHELF_REVEAL));
  }
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
