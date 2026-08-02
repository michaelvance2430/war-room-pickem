/**
 * Sandbox host hop bar — opt-in only.
 *
 * Never turns on just because you opened Build next card / Commish tools.
 * Must be flipped on explicitly (commissioner “Sandbox hop bar” toggle).
 * Always clear on league switch / Exit Host.
 */

export const EVENT_LEAGUE_SWITCHED = "warroom-league-switched";
export const EVENT_SANDBOX_HOST_HOP = "warroom-sandbox-host-hop";

/**
 * v2 — old v1 keys auto-stuck ON after any /commissioner visit.
 * Bumping the prefix clears that glitch for everyone.
 */
export const HOP_ACTIVE_PREFIX = "warroom-sandbox-host-hop-active-v2";

export function hopKeyForLeague(leagueId: string | null | undefined): string {
  return `${HOP_ACTIVE_PREFIX}:${leagueId || "none"}`;
}

export function isSandboxHostHopActive(
  leagueId: string | null | undefined
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(hopKeyForLeague(leagueId)) === "1";
  } catch {
    return false;
  }
}

export function setSandboxHostHopActive(
  on: boolean,
  leagueId: string | null | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    const key = hopKeyForLeague(leagueId);
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ok */
  }
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_SANDBOX_HOST_HOP, {
        detail: { on: !!on, leagueId: leagueId || null },
      })
    );
  } catch {
    /* ok */
  }
}

/** Call on every league switch — bar must never follow you into another room. */
export function clearSandboxHostHopOnLeagueSwitch(): void {
  if (typeof window === "undefined") return;
  try {
    const kill: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // v1 + v2 + any future prefix
      if (k?.includes("sandbox-host-hop-active")) kill.push(k);
    }
    kill.push("warroom-sandbox-host-hop-active-v1");
    kill.push("warroom-sandbox-host-hop-active-v2");
    kill.push("warroom-sandbox-chrome-dismissed-v1");
    for (const k of [...new Set(kill)]) localStorage.removeItem(k);
    sessionStorage.removeItem("warroom-sandbox-chrome-dismissed-v1");
  } catch {
    /* ok */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_LEAGUE_SWITCHED));
    window.dispatchEvent(
      new CustomEvent(EVENT_SANDBOX_HOST_HOP, {
        detail: { on: false, leagueId: null },
      })
    );
  } catch {
    /* ok */
  }
}
