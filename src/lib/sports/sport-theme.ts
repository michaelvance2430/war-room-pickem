/**
 * Full-app sport skin — default look per pack.
 * CFB = stock green tokens (no data-sport).
 * NFL = primetime navy/crimson (data-sport=nfl).
 * WWC = Brazil palette (data-sport=soccer_wwc) when live again.
 *
 * Holiday / season themes (Halloween, etc.) still apply on top:
 * SeasonThemeApplier sets data-season-theme; CSS for seasons is loaded
 * AFTER sport skins so holidays win when chosen.
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
 * Paint sport default skin on <html data-sport="…">.
 * Does not clear holiday themes — those are a separate attribute.
 */
export function applySportTheme(sportId: string | null | undefined) {
  if (typeof document === "undefined") return;
  const id = normalizeSportId(sportId);
  const root = document.documentElement;

  if (id === "nfl") {
    root.setAttribute("data-sport", "nfl");
  } else if (id === "soccer_wwc") {
    root.setAttribute("data-sport", "soccer_wwc");
  } else {
    // CFB and others → college default tokens
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
