/**
 * Full-app sport skin — swaps CSS tokens so WWC feels nothing like CFB.
 * Applied on <html data-sport="…"> from the active league.
 */

import { normalizeSportId } from "./registry";
import type { SportId } from "./types";

export const SPORT_THEME_EVENT = "warroom-sport-theme";

const LEAGUE_KEY = "warroom-league";

export function getLeagueSportIdFromLocal(): SportId {
  if (typeof window === "undefined") return "cfb";
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return "cfb";
    const lg = JSON.parse(raw) as { sportId?: string };
    return normalizeSportId(lg?.sportId);
  } catch {
    return "cfb";
  }
}

/**
 * Paint sport skin on the whole app.
 * CFB / default → stock green War Room tokens (no data-sport).
 * soccer_wwc → Brazil 2027 palette via globals.css [data-sport="soccer_wwc"].
 */
export function applySportTheme(sportId: string | null | undefined) {
  if (typeof document === "undefined") return;
  const id = normalizeSportId(sportId);
  const root = document.documentElement;

  if (id === "soccer_wwc") {
    root.setAttribute("data-sport", "soccer_wwc");
  } else {
    root.removeAttribute("data-sport");
  }

  try {
    window.dispatchEvent(
      new CustomEvent(SPORT_THEME_EVENT, { detail: id })
    );
  } catch {
    /* ignore */
  }
}

export function reapplySportThemeFromLocal() {
  applySportTheme(getLeagueSportIdFromLocal());
}
