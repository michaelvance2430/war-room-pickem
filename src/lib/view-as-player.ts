/**
 * Commish “see the app as a player” preview.
 * UI-only: hides Commish/Ops/Mod chrome. Server permissions unchanged.
 */

import { reapplySeasonThemeFromLocal } from "./season-theme";

const KEY = "warroom-view-as-player";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function isViewAsPlayer(): boolean {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setViewAsPlayer(on: boolean) {
  if (!canUseStorage()) return;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  // Keep season theme painted when switching Commish ↔ player preview
  if (typeof window !== "undefined") {
    try {
      reapplySeasonThemeFromLocal();
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("warroom-view-as-player", { detail: on })
    );
  }
}

export function toggleViewAsPlayer(): boolean {
  const next = !isViewAsPlayer();
  setViewAsPlayer(next);
  return next;
}
