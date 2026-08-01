/** Commissioner-selectable home page tagline under "Welcome to the War Room". */

import {
  NFL_HOME_TAGLINE_DEFAULT,
  NFL_HOME_TAGLINE_PRESETS,
} from "./sports/nfl-voice";

export const HOME_TAGLINE_MAX_CHARS = 120;

export type HomeTaglinePreset = {
  id: string;
  /** Dropdown label */
  label: string;
  /** Full line shown on home (empty for custom) */
  text: string;
};

/** CFB / default clubhouse lines */
export const HOME_TAGLINE_PRESETS: HomeTaglinePreset[] = [
  {
    id: "good-teams",
    label: "Where good teams and bad picks come to fight.",
    text: "Where good teams and bad picks come to fight.",
  },
  {
    id: "picks-points",
    label: "Picks. Points. Problems.",
    text: "Picks. Points. Problems.",
  },
  {
    id: "half-flushed",
    label: "Half the room goes to the bracket. Half gets flushed.",
    text: "Half the room goes to the bracket. Half gets flushed.",
  },
  {
    id: "cut-dont-care",
    label: "Championship or Toilet Bowl. The cut doesn't care how you feel.",
    text: "Championship or Toilet Bowl. The cut doesn't care how you feel.",
  },
  {
    id: "custom",
    label: "Write my own…",
    text: "",
  },
];

export const DEFAULT_HOME_TAGLINE_ID = "good-teams";

/** Presets for the active sport — same ids so stored choices still resolve. */
export function homeTaglinePresetsForSport(
  sportId?: string | null
): HomeTaglinePreset[] {
  if (sportId === "nfl") {
    return NFL_HOME_TAGLINE_PRESETS.map((p) => ({ ...p }));
  }
  return HOME_TAGLINE_PRESETS;
}

export function resolveHomeTagline(opts: {
  homeTaglineId?: string | null;
  homeTaglineCustom?: string | null;
  /** When set, NFL leagues get primetime defaults instead of campus copy */
  sportId?: string | null;
}): string {
  const sportId = opts.sportId || "cfb";
  const presets = homeTaglinePresetsForSport(sportId);
  const defaultText =
    sportId === "nfl"
      ? NFL_HOME_TAGLINE_DEFAULT
      : presets.find((p) => p.id === DEFAULT_HOME_TAGLINE_ID)?.text || "";

  const id = opts.homeTaglineId || DEFAULT_HOME_TAGLINE_ID;
  if (id === "custom") {
    const custom = (opts.homeTaglineCustom || "").trim();
    if (custom) return custom.slice(0, HOME_TAGLINE_MAX_CHARS);
    return defaultText;
  }
  const preset = presets.find((p) => p.id === id);
  return preset?.text || defaultText;
}
