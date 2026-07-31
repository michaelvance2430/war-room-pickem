/** League-wide holiday / season backgrounds (commissioner sets for everyone). */

export type SeasonThemeId =
  | "default"
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "newyear";

export type SeasonThemePreset = {
  id: SeasonThemeId;
  label: string;
  /** Short blurb for Commish settings */
  blurb: string;
};

export const DEFAULT_SEASON_THEME_ID: SeasonThemeId = "default";

export const SEASON_THEME_PRESETS: SeasonThemePreset[] = [
  {
    id: "default",
    label: "War Room (default)",
    blurb: "Classic dark green — no holiday dressing.",
  },
  {
    id: "halloween",
    label: "Halloween 🎃",
    blurb:
      "Orange & purple wash over the War Room + pumpkins & ghost on the sides.",
  },
  {
    id: "thanksgiving",
    label: "Thanksgiving 🦃",
    blurb:
      "Harvest wash over the War Room + turkeys & cornucopia on the edges.",
  },
  {
    id: "christmas",
    label: "Christmas 🎄",
    blurb:
      "Red/green wash over the War Room + lights under the nav, tree & Santa.",
  },
  {
    id: "newyear",
    label: "New Year ✨",
    blurb:
      "Sparkle wash over the War Room + ball drop & fireworks energy.",
  },
];

export function isSeasonThemeId(v: unknown): v is SeasonThemeId {
  return (
    typeof v === "string" &&
    SEASON_THEME_PRESETS.some((p) => p.id === v)
  );
}

export function resolveSeasonThemeId(
  raw: string | null | undefined
): SeasonThemeId {
  return isSeasonThemeId(raw) ? raw : DEFAULT_SEASON_THEME_ID;
}

export const SEASON_THEME_EVENT = "warroom-season-theme";

const LEAGUE_KEY = "warroom-league";

/**
 * Keep theme on local league cache so View as player / reload still sees it
 * even before (or after) Save settings hits the cloud.
 */
function persistThemeToLocalLeague(theme: SeasonThemeId) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    if (!raw) return;
    const league = JSON.parse(raw) as {
      settings?: Record<string, unknown>;
    };
    league.settings = { ...(league.settings || {}), seasonThemeId: theme };
    localStorage.setItem(LEAGUE_KEY, JSON.stringify(league));
  } catch {
    /* ignore */
  }
}

/** Apply theme on <html> so CSS variables hit the whole app. */
export function applySeasonTheme(
  id: string | null | undefined,
  opts?: { persistLocal?: boolean }
) {
  if (typeof document === "undefined") return;
  const theme = resolveSeasonThemeId(id);
  const root = document.documentElement;
  if (theme === "default") {
    root.removeAttribute("data-season-theme");
  } else {
    root.setAttribute("data-season-theme", theme);
  }
  // Default: persist so Commish → View as player keeps the wash
  if (opts?.persistLocal !== false) {
    persistThemeToLocalLeague(theme);
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SEASON_THEME_EVENT, { detail: theme })
    );
  } catch {
    /* ignore */
  }
}

/** Re-read league cache and paint theme (call after View as player / navigation). */
export function reapplySeasonThemeFromLocal() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LEAGUE_KEY);
    const league = raw ? JSON.parse(raw) : null;
    const id = league?.settings?.seasonThemeId as string | undefined;
    applySeasonTheme(id, { persistLocal: false });
  } catch {
    applySeasonTheme(DEFAULT_SEASON_THEME_ID, { persistLocal: false });
  }
}
