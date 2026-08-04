/**
 * Guest Mode — RETIRED from the live product (2026).
 *
 * War Room is a community: account → join/create → real room.
 * No parallel universe. Defensive helpers remain so old localStorage
 * and call sites fail closed without crashing.
 *
 * Foundry / future demos: do not re-enable without product review.
 */

import type { League, Session } from "./league";
import { setViewAsPlayer } from "./view-as-player";
import { seedGuestDemoWorld, GUEST_LEAGUE_ID, GUEST_PLAYER_ID } from "./guest-demo-seed";

const KEY = "warroom-guest-mode-v1";

/** Product kill-switch — never ship true without reopening guest onboarding. */
export const GUEST_MODE_RETIRED = true;

export type GuestRole = "player" | "commissioner";

export type GuestState = {
  active: boolean;
  role: GuestRole | null;
  welcomeDone: boolean;
  playerTutorialDone: boolean;
  commishTutorialDone: boolean;
  enteredAt: string;
};

const DEFAULT: GuestState = {
  active: false,
  role: null,
  welcomeDone: false,
  playerTutorialDone: false,
  commishTutorialDone: false,
  enteredAt: "",
};

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getGuestState(): GuestState {
  if (!canUse()) return { ...DEFAULT };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as GuestState) };
  } catch {
    return { ...DEFAULT };
  }
}

function write(s: GuestState) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function isGuestMode(): boolean {
  // Retired: always false so Home/Picks/Locker never take the guest fork.
  if (GUEST_MODE_RETIRED) return false;
  return getGuestState().active === true;
}

/**
 * Clear leftover guest tour local state (old browsers still on KEY=active).
 * Safe to call on app boot / login. Does not touch real auth sessions unless
 * the stored session is the guest tour player id.
 */
export function purgeRetiredGuestSession(): void {
  if (!canUse()) return;
  try {
    const raw = localStorage.getItem(KEY);
    let wasGuest = false;
    if (raw) {
      try {
        const s = JSON.parse(raw) as GuestState;
        wasGuest = s?.active === true;
      } catch {
        wasGuest = true;
      }
    }
    let sessionIsGuest = false;
    try {
      const sessRaw = localStorage.getItem("warroom-session");
      if (sessRaw) {
        const sess = JSON.parse(sessRaw) as Session;
        sessionIsGuest =
          sess?.playerId === GUEST_PLAYER_ID ||
          sess?.leagueId === GUEST_LEAGUE_ID;
      }
    } catch {
      /* ignore */
    }
    if (!wasGuest && !sessionIsGuest) return;
    exitGuestDemo();
  } catch {
    /* ignore */
  }
}

export function patchGuestState(partial: Partial<GuestState>) {
  write({ ...getGuestState(), ...partial });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("warroom-guest-mode", { detail: getGuestState() }));
  }
}

/**
 * @deprecated Guest retired — always false. Kept so call sites compile.
 */
export function ensureGuestWorld(): boolean {
  if (GUEST_MODE_RETIRED) return false;
  if (!canUse() || getGuestState().active !== true) return false;
  try {
    const prev = getGuestState();
    let sessionRaw = localStorage.getItem("warroom-session");
    let leagueRaw = localStorage.getItem("warroom-league");
    let session: Session | null = null;
    let league: League | null = null;
    try {
      session = sessionRaw ? (JSON.parse(sessionRaw) as Session) : null;
    } catch {
      session = null;
    }
    try {
      league = leagueRaw ? (JSON.parse(leagueRaw) as League) : null;
    } catch {
      league = null;
    }
    const activeWeek = localStorage.getItem("warroom-active-week");
    const week9 = localStorage.getItem("warroom-card-week-9");
    const broken =
      !session ||
      !league ||
      session.leagueId !== GUEST_LEAGUE_ID ||
      league.id !== GUEST_LEAGUE_ID ||
      !activeWeek ||
      !week9;
    if (broken) {
      seedGuestDemoWorld();
      if (prev.role) {
        setGuestRole(prev.role);
      }
      // restore tutorial completion flags (seed doesn't touch guest KEY)
      write({ ...getGuestState(), ...prev, active: true });
    }
    return true;
  } catch {
    return false;
  }
}

/** Dismiss all guest coaching forever for this browser guest session. */
export function dismissGuestTutorialForever() {
  const role = getGuestState().role;
  if (role === "commissioner") {
    patchGuestState({
      commishTutorialDone: true,
      playerTutorialDone: true,
      welcomeDone: true,
    });
  } else if (role === "player") {
    patchGuestState({ playerTutorialDone: true, welcomeDone: true });
  } else {
    patchGuestState({
      playerTutorialDone: true,
      commishTutorialDone: true,
      welcomeDone: true,
    });
  }
}

/**
 * Guest entry retired. Create an account — then join or host a real room.
 */
export function enterGuestDemo(): { ok: true } | { ok: false; error: string } {
  return {
    ok: false,
    error:
      "Guest tour is gone. Create a free account — then join a league or start your own. Real room, real history.",
  };
}

export function setGuestRole(role: GuestRole) {
  const sessionRaw = localStorage.getItem("warroom-session");
  let session: Session | null = null;
  try {
    session = sessionRaw ? (JSON.parse(sessionRaw) as Session) : null;
  } catch {
    session = null;
  }
  if (session) {
    session.isCommissioner = role === "commissioner";
    session.playerId = GUEST_PLAYER_ID;
    session.leagueId = GUEST_LEAGUE_ID;
    localStorage.setItem("warroom-session", JSON.stringify(session));
  }
  // Player role = view-as-player chrome off but not commish; Commish = full ops
  setViewAsPlayer(false);
  patchGuestState({ role, welcomeDone: true });
}

export function markGuestTutorialDone(role: GuestRole) {
  if (role === "player") patchGuestState({ playerTutorialDone: true });
  else patchGuestState({ commishTutorialDone: true });
}

export function needsGuestTutorial(role: GuestRole | null = getGuestState().role): boolean {
  if (!isGuestMode() || !role) return false;
  const s = getGuestState();
  return role === "player" ? !s.playerTutorialDone : !s.commishTutorialDone;
}

/** Leave guest and clear demo session so login/join work cleanly. */
export function exitGuestDemo() {
  if (!canUse()) return;
  write({ ...DEFAULT, active: false });
  try {
    localStorage.removeItem("warroom-session");
    localStorage.removeItem("warroom-league");
    localStorage.removeItem("warroom-players");
    localStorage.removeItem("warroom-active-week");
    localStorage.removeItem("warroom-guest-scored-weeks");
    for (let w = 0; w <= 18; w++) {
      localStorage.removeItem(`warroom-card-week-${w}`);
      localStorage.removeItem(`warroom-results-week-${w}`);
      localStorage.removeItem(`warroom-picks-week-${w}`);
    }
  } catch {
    /* ignore */
  }
  setViewAsPlayer(false);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("warroom-guest-mode", { detail: getGuestState() })
    );
  }
}

export function getGuestLeagueHint(): Pick<League, "id" | "name" | "code"> {
  return {
    id: GUEST_LEAGUE_ID,
    name: "War Room Tour",
    code: "GUEST1",
  };
}
