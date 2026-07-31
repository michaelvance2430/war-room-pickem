/**
 * Real-account first-login “walk the dog” — Crystal Ball + My Picks.
 * Guest demo uses guest-mode tutorials (no Crystal Ball on week 9).
 */

const KEY = "warroom-player-tutorial-v1";

export type PlayerTutorialStep =
  | "open_crystal"
  | "search_team"
  | "lock_crystal"
  | "open_picks"
  | "fill_picks"
  | "save_picks"
  | "done";

export type PlayerTutorialState = {
  /** User has finished (or skipped) the walkthrough */
  completed: boolean;
  /** Currently mid-walkthrough */
  active: boolean;
  step: PlayerTutorialStep;
  /** Which auth user this is for (re-run is per browser still fine) */
  userId?: string;
};

const ORDER: PlayerTutorialStep[] = [
  "open_crystal",
  "search_team",
  "lock_crystal",
  "open_picks",
  "fill_picks",
  "save_picks",
  "done",
];

const DEFAULT: PlayerTutorialState = {
  completed: false,
  active: false,
  step: "open_crystal",
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getPlayerTutorialState(): PlayerTutorialState {
  if (!canUse()) return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as PlayerTutorialState) };
  } catch {
    return { ...DEFAULT };
  }
}

function write(s: PlayerTutorialState) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("warroom-player-tutorial", { detail: s })
    );
  }
}

export function isPlayerTutorialActive(): boolean {
  const s = getPlayerTutorialState();
  return s.active && !s.completed && s.step !== "done";
}

export function needsPlayerTutorial(): boolean {
  return !getPlayerTutorialState().completed;
}

/**
 * First login after rules — or Account re-run.
 * Prefer picks-first when crystal ball is off or card just went live.
 */
export function startPlayerTutorial(
  userId?: string,
  opts?: { startAt?: PlayerTutorialStep }
) {
  write({
    completed: false,
    active: true,
    step: opts?.startAt || "open_crystal",
    userId,
  });
}

/** Picks-only coach (skip crystal) — used when CB is off or user wants simple path. */
export function startPicksOnlyTutorial(userId?: string) {
  startPlayerTutorial(userId, { startAt: "open_picks" });
}

export function completePlayerTutorial() {
  write({
    ...getPlayerTutorialState(),
    completed: true,
    active: false,
    step: "done",
  });
}

export function setPlayerTutorialStep(step: PlayerTutorialStep) {
  const s = getPlayerTutorialState();
  if (!s.active && step !== "done") {
    write({ ...s, active: true, completed: false, step });
    return;
  }
  write({
    ...s,
    step,
    completed: step === "done",
    active: step !== "done",
  });
}

/** Advance only forward (never go back unless forced). */
export function advancePlayerTutorialTo(step: PlayerTutorialStep) {
  const s = getPlayerTutorialState();
  if (!s.active || s.completed) return;
  const cur = ORDER.indexOf(s.step);
  const next = ORDER.indexOf(step);
  if (next < 0) return;
  if (next <= cur && step !== s.step) return;
  setPlayerTutorialStep(step);
}

/** Explicit back — one step only. */
export function goBackPlayerTutorial(): PlayerTutorialStep | null {
  const s = getPlayerTutorialState();
  if (!s.active || s.completed) return null;
  const cur = ORDER.indexOf(s.step);
  if (cur <= 0) return null;
  const prev = ORDER[cur - 1];
  // Force step (bypass forward-only guard)
  write({
    ...s,
    step: prev,
    completed: false,
    active: true,
  });
  // Pause path-based auto-advance so we don't instantly re-skip this step
  try {
    sessionStorage.setItem("warroom-tut-hold-step", prev);
  } catch {
    /* ignore */
  }
  return prev;
}

export function clearTutorialHold() {
  try {
    sessionStorage.removeItem("warroom-tut-hold-step");
  } catch {
    /* ignore */
  }
}

/** True if coach is holding on this step after user hit Back. */
export function isTutorialHeldOn(step: PlayerTutorialStep): boolean {
  try {
    return sessionStorage.getItem("warroom-tut-hold-step") === step;
  } catch {
    return false;
  }
}

export function skipPlayerTutorial() {
  completePlayerTutorial();
}

export function playerTutorialStepIndex(step: PlayerTutorialStep): number {
  return ORDER.indexOf(step);
}

export function playerTutorialStepCount(): number {
  // Exclude "done"
  return ORDER.length - 1;
}

export type CoachCopy = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string | null;
  /** Manual “I did this” when we can’t auto-detect */
  allowManualNext?: boolean;
};

export function coachCopyForStep(step: PlayerTutorialStep): CoachCopy {
  switch (step) {
    case "open_crystal":
      return {
        title: "Step 1 of 6 · Open Crystal Ball",
        body: "Tap below. This is your free preseason flex: who wins the national title? Zero points. Infinite bragging rights.",
        ctaLabel: "Open Crystal Ball →",
        ctaHref: "/crystal-ball",
      };
    case "search_team":
      return {
        title: "Step 2 of 6 · Search your school",
        body: "In the search box, type your national champ pick (team or conference). Tap the school so it’s highlighted.",
        ctaLabel: "I’m on Crystal Ball",
        ctaHref: "/crystal-ball",
        allowManualNext: true,
      };
    case "lock_crystal":
      return {
        title: "Step 3 of 6 · Lock the pick",
        body: "Hit the green Lock pick button. You can change it until Week 0 freezes — lock something now so you’re not blank.",
        ctaLabel: "Back to Crystal Ball",
        ctaHref: "/crystal-ball",
      };
    case "open_picks":
      return {
        title: "Step 4 of 6 · Open My Picks",
        body: "Crystal Ball’s done for now. Open My Picks — that’s where you lock this week’s card.",
        ctaLabel: "Open My Picks →",
        ctaHref: "/picks",
      };
    case "fill_picks":
      return {
        title: "Step 5 of 6 · Fill the card",
        body: "For every game: pick a side, set confidence 1–5 (each number once), set one Best Bet (2×), and answer the prop.",
        ctaLabel: "Open My Picks",
        ctaHref: "/picks",
        allowManualNext: true,
      };
    case "save_picks":
      return {
        title: "Step 6 of 6 · Save Picks",
        body: "Hit the big Save Picks button. After first kickoff the whole card freezes — so save before Saturday.",
        ctaLabel: "Open My Picks",
        ctaHref: "/picks",
      };
    default:
      return {
        title: "You’re set",
        body: "Tutorial complete. Replay anytime from Account.",
        ctaLabel: "Home",
        ctaHref: "/",
      };
  }
}
