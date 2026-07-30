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
    blurb: "Orange & purple — spooky Saturday vibes.",
  },
  {
    id: "thanksgiving",
    label: "Thanksgiving 🦃",
    blurb: "Warm amber & cranberry — turkey week.",
  },
  {
    id: "christmas",
    label: "Christmas 🎄",
    blurb: "Evergreen, gold, and twinkling lights — bowl season cheer.",
  },
  {
    id: "newyear",
    label: "New Year ✨",
    blurb: "Midnight navy & champagne — CFP Final energy.",
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

/** Apply theme on <html> so CSS variables hit the whole app. */
export function applySeasonTheme(id: string | null | undefined) {
  if (typeof document === "undefined") return;
  const theme = resolveSeasonThemeId(id);
  const root = document.documentElement;
  if (theme === "default") {
    root.removeAttribute("data-season-theme");
  } else {
    root.setAttribute("data-season-theme", theme);
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SEASON_THEME_EVENT, { detail: theme })
    );
  } catch {
    /* ignore */
  }
}
