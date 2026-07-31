/**
 * Join as Guest — local Demo War Room (simulated through Week 9).
 * No real account required; does not touch production leagues.
 */

import type { League, Session } from "./league";
import { setViewAsPlayer } from "./view-as-player";
import { seedGuestDemoWorld, GUEST_LEAGUE_ID, GUEST_PLAYER_ID } from "./guest-demo-seed";

const KEY = "warroom-guest-mode-v1";

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
  return getGuestState().active === true;
}

export function patchGuestState(partial: Partial<GuestState>) {
  write({ ...getGuestState(), ...partial });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("warroom-guest-mode", { detail: getGuestState() }));
  }
}

/**
 * Start guest demo: seed local world, session, league. Returns home path.
 */
export function enterGuestDemo(): { ok: true } | { ok: false; error: string } {
  if (!canUse()) return { ok: false, error: "Storage unavailable" };
  try {
    seedGuestDemoWorld();
    write({
      active: true,
      role: null,
      welcomeDone: false,
      playerTutorialDone: false,
      commishTutorialDone: false,
      enteredAt: new Date().toISOString(),
    });
    setViewAsPlayer(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("warroom-guest-mode", { detail: getGuestState() })
      );
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start guest demo",
    };
  }
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
    name: "Demo War Room",
    code: "GUEST1",
  };
}
