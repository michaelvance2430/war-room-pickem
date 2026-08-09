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

/** Home motto cadence: stable during a visit, fresh often enough to feel alive. */
export const HOME_TAGLINE_ROTATION_DAYS = 3;

/** Small deterministic hash so different rooms do not rotate in lockstep. */
function rotationSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Rotating Home-only motto.
 *
 * Commissioner-written custom copy is a deliberate room identity and remains
 * pinned. Presets rotate every three UTC days; the saved preset is the
 * starting point, while the room key keeps leagues from changing in lockstep.
 */
export function resolveRotatingHomeTagline(opts: {
  homeTaglineId?: string | null;
  homeTaglineCustom?: string | null;
  sportId?: string | null;
  roomKey?: string | null;
  /** Injectable clock for verification. */
  now?: number;
}): string {
  const id = opts.homeTaglineId || DEFAULT_HOME_TAGLINE_ID;
  if (id === "custom") return resolveHomeTagline(opts);

  const presets = homeTaglinePresetsForSport(opts.sportId || "cfb").filter(
    (preset) => preset.id !== "custom" && !!preset.text
  );
  if (presets.length === 0) return resolveHomeTagline(opts);

  const selectedIndex = Math.max(
    0,
    presets.findIndex((preset) => preset.id === id)
  );
  const cadenceMs = HOME_TAGLINE_ROTATION_DAYS * 24 * 60 * 60 * 1000;
  const bucket = Math.floor((opts.now ?? Date.now()) / cadenceMs);
  const roomOffset = rotationSeed(opts.roomKey || "war-room") % presets.length;
  return presets[(selectedIndex + roomOffset + bucket) % presets.length].text;
}
