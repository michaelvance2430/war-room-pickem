const PREF_KEY = "warroom-opening-cinematic-enabled-v1";

export function isOpeningCinematicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setOpeningCinematicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* preference failure must never block the app */
  }
}

