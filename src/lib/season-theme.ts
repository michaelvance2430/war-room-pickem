/**
 * League-wide room skins + holiday backgrounds (commissioner sets for everyone).
 *
 * PRODUCT RULE:
 * - Sport pack owns the DEFAULT skin via data-sport (CFB War Room Colors, NFL primetime, …)
 * - Commissioner can pick extra skins (CFB campus looks) or holiday overlays
 * - Holidays apply app-wide for every sport; CFB skins only offered in CFB rooms
 *
 * Tech: `data-sport` = pack default · `data-season-theme` = room skin / holiday
 */

export type SeasonThemeId =
  | "default"
  | "cfb_saturday"
  | "cfb_night_lights"
  | "cfb_rivalry"
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "newyear";

export type SeasonThemePreset = {
  id: SeasonThemeId;
  label: string;
  /** Short blurb for Commish settings */
  blurb: string;
  /** If set, only show in that sport’s settings */
  sportOnly?: "cfb" | "nfl" | "soccer_wwc";
  /** Holiday props / border unlocks */
  holiday?: boolean;
};

export const DEFAULT_SEASON_THEME_ID: SeasonThemeId = "default";

/**
 * Full catalog. Use seasonThemePresetsForSport() in Commish UI.
 */
export const SEASON_THEME_PRESETS: SeasonThemePreset[] = [
  {
    id: "default",
    label: "War Room Colors",
    blurb:
      "Classic clubhouse: black field + signal green (CFB). NFL rooms use navy/crimson primetime instead. No holiday wash.",
  },
  {
    id: "cfb_saturday",
    label: "CFB · Saturday Turf",
    blurb:
      "College Saturday energy — deep turf green, stadium lights, black edges. CFB rooms only.",
    sportOnly: "cfb",
  },
  {
    id: "cfb_night_lights",
    label: "CFB · Night Game",
    blurb:
      "Friday night lights feel — cooler greens, floodlight white, darker pitch. CFB rooms only.",
    sportOnly: "cfb",
  },
  {
    id: "cfb_rivalry",
    label: "CFB · Rivalry Week",
    blurb:
      "Campus heat — green with crimson rivalry edges. Loud week energy. CFB rooms only.",
    sportOnly: "cfb",
  },
  {
    id: "halloween",
    label: "Halloween 🎃",
    blurb:
      "Orange & purple wash on every page + props. Works for every sport.",
    holiday: true,
  },
  {
    id: "thanksgiving",
    label: "Thanksgiving 🦃",
    blurb:
      "Harvest wash on every page + props. Works for every sport.",
    holiday: true,
  },
  {
    id: "christmas",
    label: "Christmas 🎄",
    blurb:
      "Red/green wash on every page + lights/props. Works for every sport.",
    holiday: true,
  },
  {
    id: "newyear",
    label: "New Year ✨",
    blurb:
      "Sparkle wash on every page + NY props. Works for every sport.",
    holiday: true,
  },
];

const HOLIDAY_IDS = new Set(
  SEASON_THEME_PRESETS.filter((p) => p.holiday).map((p) => p.id)
);

const CFB_SKIN_IDS = new Set(
  SEASON_THEME_PRESETS.filter((p) => p.sportOnly === "cfb").map((p) => p.id)
);

export function isHolidayThemeId(id: string | null | undefined): boolean {
  return !!id && HOLIDAY_IDS.has(id as SeasonThemeId);
}

export function isCfbRoomSkinId(id: string | null | undefined): boolean {
  return !!id && CFB_SKIN_IDS.has(id as SeasonThemeId);
}

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

/** Presets shown in Commish settings for this sport. */
export function seasonThemePresetsForSport(
  sportId?: string | null
): SeasonThemePreset[] {
  const sid = (sportId || "cfb").trim() || "cfb";
  return SEASON_THEME_PRESETS.filter((p) => {
    if (!p.sportOnly) return true;
    return p.sportOnly === sid;
  });
}

/**
 * If an NFL (etc.) room somehow has a CFB-only skin stored, fall back to War Room Colors.
 */
export function resolveSeasonThemeIdForSport(
  raw: string | null | undefined,
  sportId?: string | null
): SeasonThemeId {
  const id = resolveSeasonThemeId(raw);
  if (isCfbRoomSkinId(id) && (sportId || "cfb") !== "cfb") {
    return DEFAULT_SEASON_THEME_ID;
  }
  return id;
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
