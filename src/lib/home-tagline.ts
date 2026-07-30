/** Commissioner-selectable home page tagline under "Welcome to the War Room". */

export const HOME_TAGLINE_MAX_CHARS = 120;

export type HomeTaglinePreset = {
  id: string;
  /** Dropdown label */
  label: string;
  /** Full line shown on home (empty for custom) */
  text: string;
};

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

export function resolveHomeTagline(opts: {
  homeTaglineId?: string | null;
  homeTaglineCustom?: string | null;
}): string {
  const id = opts.homeTaglineId || DEFAULT_HOME_TAGLINE_ID;
  if (id === "custom") {
    const custom = (opts.homeTaglineCustom || "").trim();
    if (custom) return custom.slice(0, HOME_TAGLINE_MAX_CHARS);
    // Empty custom → fall back so home never looks blank
    return (
      HOME_TAGLINE_PRESETS.find((p) => p.id === DEFAULT_HOME_TAGLINE_ID)?.text ||
      ""
    );
  }
  const preset = HOME_TAGLINE_PRESETS.find((p) => p.id === id);
  return (
    preset?.text ||
    HOME_TAGLINE_PRESETS.find((p) => p.id === DEFAULT_HOME_TAGLINE_ID)?.text ||
    ""
  );
}
