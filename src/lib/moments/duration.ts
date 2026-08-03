/**
 * Season Opening duration presets (testing).
 * Default 10s. Dev/Foundry can override via localStorage.
 */

export type SeasonOpenDurationSec = 6 | 8 | 10 | 12;

export type SeasonOpenPhaseMs = {
  anticipation: number;
  celebration: number;
  transition: number;
  silence: number;
  fade: number;
};

/** Keys for Foundry / dev duration override (preview only; not claim state) */
export const SEASON_OPEN_DURATION_KEY = "warroom-season-open-duration-sec";

/**
 * Pacing curves (not equal slices).
 * 10s: 0–1.5 dark · 1.5–3.5 title · 3.5–7 support · 7–8.5 hold · 8.5–10 fade
 */
export const SEASON_OPEN_DURATION_PRESETS: Record<
  SeasonOpenDurationSec,
  SeasonOpenPhaseMs
> = {
  6: {
    anticipation: 900,
    celebration: 1400,
    transition: 1600,
    silence: 900,
    fade: 1200,
  },
  8: {
    anticipation: 1200,
    celebration: 1800,
    transition: 2200,
    silence: 1200,
    fade: 1600,
  },
  10: {
    anticipation: 1500,
    celebration: 2000,
    transition: 3500,
    silence: 1500,
    fade: 1500,
  },
  12: {
    anticipation: 1800,
    celebration: 2400,
    transition: 4000,
    silence: 1800,
    fade: 2000,
  },
};

export function getSeasonOpenPhaseMs(): SeasonOpenPhaseMs {
  const fallback = SEASON_OPEN_DURATION_PRESETS[10];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SEASON_OPEN_DURATION_KEY);
    const n = raw != null ? Number(raw) : 10;
    if (n === 6 || n === 8 || n === 10 || n === 12) {
      return SEASON_OPEN_DURATION_PRESETS[n];
    }
  } catch {
    /* ok */
  }
  return fallback;
}

export function setSeasonOpenDurationSec(sec: SeasonOpenDurationSec): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEASON_OPEN_DURATION_KEY, String(sec));
  } catch {
    /* ok */
  }
}

export function getSeasonOpenDurationSec(): SeasonOpenDurationSec {
  if (typeof window === "undefined") return 10;
  try {
    const n = Number(localStorage.getItem(SEASON_OPEN_DURATION_KEY) || 10);
    if (n === 6 || n === 8 || n === 10 || n === 12) return n;
  } catch {
    /* ok */
  }
  return 10;
}
