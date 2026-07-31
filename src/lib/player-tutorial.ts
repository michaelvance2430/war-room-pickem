/**
 * Real-account first-login “walk the dog”.
 * Default = picks-only (Crystal Ball is optional power, not onboarding).
 * Guest demo uses guest-mode tutorials.
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

/** picks = first-week path; full = Crystal Ball + picks (Account re-run). */
export type PlayerTutorialMode = "picks" | "full";

export type PlayerTutorialState = {
  /** User has finished (or skipped) the walkthrough */
  completed: boolean;
  /** Currently mid-walkthrough */
  active: boolean;
  step: PlayerTutorialStep;
  /** Which auth user this is for (re-run is per browser still fine) */
  userId?: string;
  /** Default picks-only for new players */
  mode?: PlayerTutorialMode;
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

const PICKS_ORDER: PlayerTutorialStep[] = [
  "open_picks",
  "fill_picks",
  "save_picks",
  "done",
];

const DEFAULT: PlayerTutorialState = {
  completed: false,
  active: false,
  step: "open_picks",
  mode: "picks",
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
 * Default mode is picks-only (Crystal Ball is optional / Account full re-run).
 */
export function startPlayerTutorial(
  userId?: string,
  opts?: { startAt?: PlayerTutorialStep; mode?: PlayerTutorialMode }
) {
  const mode: PlayerTutorialMode =
    opts?.mode ??
    (opts?.startAt === "open_crystal" ||
    opts?.startAt === "search_team" ||
    opts?.startAt === "lock_crystal"
      ? "full"
      : "picks");
  const startAt =
    opts?.startAt || (mode === "full" ? "open_crystal" : "open_picks");
  write({
    completed: false,
    active: true,
    step: startAt,
    userId,
    mode,
  });
}

/** Picks-only coach — default first-week path. */
export function startPicksOnlyTutorial(userId?: string) {
  startPlayerTutorial(userId, { mode: "picks", startAt: "open_picks" });
}

/** Full coach including Crystal Ball (Account re-run). */
export function startFullPlayerTutorial(userId?: string) {
  startPlayerTutorial(userId, { mode: "full", startAt: "open_crystal" });
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
  // Always use full ORDER for index comparison so crystal→picks still works
  // if someone upgrades mid-run; picks-only never lands on crystal steps.
  const cur = ORDER.indexOf(s.step);
  const next = ORDER.indexOf(step);
  if (next < 0) return;
  if (next <= cur && step !== s.step) return;
  setPlayerTutorialStep(step);
}

/** Explicit back — one step only. */
function orderForMode(mode?: PlayerTutorialMode): PlayerTutorialStep[] {
  return mode === "full" ? ORDER : PICKS_ORDER;
}

export function goBackPlayerTutorial(): PlayerTutorialStep | null {
  const s = getPlayerTutorialState();
  if (!s.active || s.completed) return null;
  const order = orderForMode(s.mode);
  const cur = order.indexOf(s.step);
  // If step isn't in picks order (stale full step), fall back to full order
  const list = cur >= 0 ? order : ORDER;
  const idx = list.indexOf(s.step);
  if (idx <= 0) return null;
  const prev = list[idx - 1];
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
  const s = getPlayerTutorialState();
  const order = orderForMode(s.mode);
  const i = order.indexOf(step);
  if (i >= 0) return i;
  return ORDER.indexOf(step);
}

export function playerTutorialStepCount(): number {
  const s = getPlayerTutorialState();
  const order = orderForMode(s.mode ?? "picks");
  // Exclude "done"
  return order.length - 1;
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
  const mode = getPlayerTutorialState().mode ?? "picks";
  const picksOnly = mode !== "full";

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
      return picksOnly
        ? {
            title: "Step 1 of 3 · Open My Picks",
            body: "This is the job every week. Open My Picks and lock this week’s card before first kickoff.",
            ctaLabel: "Open My Picks →",
            ctaHref: "/picks",
          }
        : {
            title: "Step 4 of 6 · Open My Picks",
            body: "Crystal Ball’s done for now. Open My Picks — that’s where you lock this week’s card.",
            ctaLabel: "Open My Picks →",
            ctaHref: "/picks",
          };
    case "fill_picks":
      return picksOnly
        ? {
            title: "Step 2 of 3 · Fill the card",
            body: "For every game: pick a side, set confidence 1–5 (each number once), set one Best Bet (2×), and answer the prop.",
            ctaLabel: "Open My Picks",
            ctaHref: "/picks",
            allowManualNext: true,
          }
        : {
            title: "Step 5 of 6 · Fill the card",
            body: "For every game: pick a side, set confidence 1–5 (each number once), set one Best Bet (2×), and answer the prop.",
            ctaLabel: "Open My Picks",
            ctaHref: "/picks",
            allowManualNext: true,
          };
    case "save_picks":
      return picksOnly
        ? {
            title: "Step 3 of 3 · Save Picks",
            body: "Hit the big Save Picks button. After first kickoff the whole card freezes — so save before Saturday. That’s the whole weekly job.",
            ctaLabel: "Open My Picks",
            ctaHref: "/picks",
          }
        : {
            title: "Step 6 of 6 · Save Picks",
            body: "Hit the big Save Picks button. After first kickoff the whole card freezes — so save before Saturday.",
            ctaLabel: "Open My Picks",
            ctaHref: "/picks",
          };
    default:
      return {
        title: "You’re set",
        body: picksOnly
          ? "Tutorial complete. Crystal Ball and more flavor live under More when you’re ready. Replay anytime from Account."
          : "Tutorial complete. Replay anytime from Account.",
        ctaLabel: "Home",
        ctaHref: "/",
      };
  }
}
