/**
 * Sandbox host hop bar state — opt-in per league; always clear on switch.
 */

export const EVENT_LEAGUE_SWITCHED = "warroom-league-switched";
export const HOP_ACTIVE_PREFIX = "warroom-sandbox-host-hop-active-v1";

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
}

/** Call on every league switch — bar must never follow you into another room. */
export function clearSandboxHostHopOnLeagueSwitch(): void {
  if (typeof window === "undefined") return;
  try {
    const kill: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(HOP_ACTIVE_PREFIX)) kill.push(k);
    }
    kill.push("warroom-sandbox-host-hop-active-v1");
    kill.push("warroom-sandbox-chrome-dismissed-v1");
    for (const k of kill) localStorage.removeItem(k);
    sessionStorage.removeItem("warroom-sandbox-chrome-dismissed-v1");
  } catch {
    /* ok */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_LEAGUE_SWITCHED));
  } catch {
    /* ok */
  }
}
