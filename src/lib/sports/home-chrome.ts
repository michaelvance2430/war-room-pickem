/**
 * Sport-aware home chrome — same clubhouse shell, different field energy.
 */

import { getLeague } from "@/lib/league";
import { getSportPack, normalizeSportId } from "./registry";
import type { SportId, SportPack } from "./types";

export type SportAtmosphere = {
  /** Outer radial wash */
  baseGradient: string;
  gridLine: string;
  vignette: string;
  scanline: string;
  titleGlow: string;
  accentHex: string;
  /** Optional original full-bleed art plate. UI remains live above it. */
  backgroundImage?: string;
};

export type SportHomeChrome = {
  sportId: SportId;
  pack: SportPack;
  welcomeTitle: string;
  /** Fallback when league has no custom tagline */
  defaultTagline: string;
  sportBadge: string;
  periodWord: string;
  periodProgressHint: string;
  primaryPathLabel: string;
  primaryPathBlurb: string;
  shamePathLabel: string;
  shamePathBlurb: string;
  jobCtaIdle: string;
  atmosphere: SportAtmosphere;
};

/** War Room Colors — classic black + signal green (default CFB clubhouse) */
const CFB_ATMO: SportAtmosphere = {
  baseGradient:
    "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34, 197, 94, 0.12), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(120, 40, 40, 0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 80%, rgba(20, 40, 30, 0.5), transparent 45%), #050805",
  gridLine: "rgba(34,197,94,0.04)",
  vignette:
    "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.35) 3px)",
  titleGlow: "drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]",
  accentHex: "#22c55e",
  backgroundImage: "/skins/cfb-saturday-situation-room.webp",
};

/** CFB · Saturday Turf — brighter campus Saturday */
const CFB_SATURDAY_ATMO: SportAtmosphere = {
  baseGradient: `radial-gradient(ellipse 90% 55% at 50% -5%, rgba(34, 197, 94, 0.28), transparent 52%),
     radial-gradient(ellipse 60% 45% at 100% 80%, rgba(22, 163, 74, 0.14), transparent 50%),
     radial-gradient(ellipse 55% 50% at 0% 90%, rgba(10, 40, 20, 0.85), transparent 48%),
     #030a05`,
  gridLine: "rgba(34,197,94,0.07)",
  vignette:
    "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.78) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 3px)",
  titleGlow: "drop-shadow-[0_0_32px_rgba(34,197,94,0.28)]",
  accentHex: "#22c55e",
  backgroundImage: "/skins/cfb-saturday-situation-room.webp",
};

/** CFB · Night Game — cooler floodlights */
const CFB_NIGHT_ATMO: SportAtmosphere = {
  baseGradient: `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(226, 232, 240, 0.08), transparent 50%),
     radial-gradient(ellipse 85% 55% at 50% 100%, rgba(16, 185, 129, 0.12), transparent 55%),
     radial-gradient(ellipse 50% 50% at 0% 50%, rgba(6, 78, 59, 0.35), transparent 50%),
     #020806`,
  gridLine: "rgba(52,211,153,0.05)",
  vignette:
    "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.88) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.42) 3px)",
  titleGlow: "drop-shadow-[0_0_26px_rgba(52,211,153,0.22)]",
  accentHex: "#34d399",
  backgroundImage: "/skins/cfb-saturday-situation-room.webp",
};

/** CFB · Rivalry Week — green with crimson heat */
const CFB_RIVALRY_ATMO: SportAtmosphere = {
  baseGradient: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34, 197, 94, 0.18), transparent 52%),
     radial-gradient(ellipse 55% 45% at 100% 70%, rgba(185, 28, 28, 0.2), transparent 50%),
     radial-gradient(ellipse 50% 45% at 0% 85%, rgba(20, 40, 20, 0.7), transparent 48%),
     #060805`,
  gridLine: "rgba(34,197,94,0.05)",
  vignette:
    "radial-gradient(ellipse at center, transparent 36%, rgba(0,0,0,0.8) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.36) 3px)",
  titleGlow: "drop-shadow-[0_0_28px_rgba(34,197,94,0.2)] drop-shadow-[0_0_16px_rgba(185,28,28,0.15)]",
  accentHex: "#22c55e",
  backgroundImage: "/skins/cfb-saturday-situation-room.webp",
};

function cfbAtmosphereForTheme(
  seasonThemeId?: string | null
): SportAtmosphere {
  switch (seasonThemeId) {
    case "cfb_saturday":
      return CFB_SATURDAY_ATMO;
    case "cfb_night_lights":
      return CFB_NIGHT_ATMO;
    case "cfb_rivalry":
      return CFB_RIVALRY_ATMO;
    default:
      return CFB_ATMO;
  }
}

/**
 * Pro football Sunday palette — original War Room skin, not any league shield.
 * Midnight navy · signal crimson · steel silver · white.
 */
export const NFL_SUNDAY_COLORS = {
  navy: "#0B1426",
  crimson: "#C1121F",
  silver: "#C5CCD3",
  white: "#F8FAFC",
} as const;

const NFL_ATMO: SportAtmosphere = {
  baseGradient: `radial-gradient(ellipse 85% 55% at 50% -8%, rgba(193, 18, 31, 0.18), transparent 52%),
     radial-gradient(ellipse 55% 45% at 100% 80%, rgba(197, 204, 211, 0.08), transparent 50%),
     radial-gradient(ellipse 50% 50% at 0% 85%, rgba(11, 20, 38, 0.95), transparent 45%),
     #070b14`,
  gridLine: "rgba(197, 204, 211, 0.06)",
  vignette:
    "radial-gradient(ellipse at center, transparent 35%, rgba(5, 8, 16, 0.88) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 3px)",
  titleGlow: "drop-shadow-[0_0_28px_rgba(193,18,31,0.35)]",
  accentHex: NFL_SUNDAY_COLORS.crimson,
};

/** FIFA WWC Brazil 2027™ — Brazilian flag palette (green / gold / blue / white) */
export const WWC_BRAZIL_COLORS = {
  emerald: "#009C3B",
  gold: "#FFDF00",
  royal: "#002776",
  white: "#FFFFFF",
} as const;

const WWC_ATMO: SportAtmosphere = {
  baseGradient:
    // Emerald top · gold heat · deep royal corners · dark pitch
    `radial-gradient(ellipse 85% 55% at 50% -8%, rgba(0, 156, 59, 0.28), transparent 52%),
     radial-gradient(ellipse 55% 45% at 95% 75%, rgba(255, 223, 0, 0.12), transparent 55%),
     radial-gradient(ellipse 50% 50% at 5% 80%, rgba(0, 39, 118, 0.35), transparent 50%),
     radial-gradient(ellipse 40% 30% at 70% 20%, rgba(255, 255, 255, 0.04), transparent 45%),
     #04080a`,
  gridLine: "rgba(0, 156, 59, 0.07)",
  vignette:
    "radial-gradient(ellipse at center, transparent 32%, rgba(0, 20, 40, 0.85) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.32) 3px)",
  titleGlow: "drop-shadow-[0_0_32px_rgba(0,156,59,0.35)] drop-shadow-[0_0_18px_rgba(255,223,0,0.12)]",
  accentHex: WWC_BRAZIL_COLORS.emerald,
};

function chromeForPack(pack: SportPack): SportHomeChrome {
  const sportId = pack.id;

  if (sportId === "nfl") {
    return {
      sportId,
      pack,
      welcomeTitle: "Welcome to the War Room",
      defaultTagline:
        "Sundays. Spreads. Tailgates. Just the room and the late window.",
      sportBadge: "PRO FOOTBALL · SUNDAY",
      periodWord: "Week",
      periodProgressHint: "Season weeks — lock before first kickoff",
      primaryPathLabel: "Championship Bracket",
      primaryPathBlurb: "Top half. One path. Lights on.",
      shamePathLabel: "Toilet Bowl",
      shamePathBlurb: "Bottom half still matters. Sunday still hurts.",
      jobCtaIdle: "Make my picks",
      atmosphere: NFL_ATMO,
    };
  }

  if (sportId === "soccer_wwc") {
    return {
      sportId,
      pack,
      welcomeTitle: "Welcome to the War Room",
      defaultTagline:
        "Brazil 2027. Same clubhouse. Global stage. Lock the card, roast the room, chase the Cup.",
      sportBadge: "FIFA WOMEN'S WORLD CUP BRAZIL 2027™",
      periodWord: "Matchday",
      periodProgressHint: "Tournament matchdays — short, loud, zero chill",
      primaryPathLabel: "Championship path",
      primaryPathBlurb: "Top half. One road. Lift the trophy energy.",
      shamePathLabel: "Toilet Bowl",
      shamePathBlurb: "Bottom half still matters. Group-stage ghost stories welcome.",
      jobCtaIdle: "Lock this matchday’s card",
      atmosphere: WWC_ATMO,
    };
  }

  // Default / CFB — War Room Colors (+ optional CFB room skins)
  return {
    sportId,
    pack,
    welcomeTitle: "Welcome to the War Room",
    defaultTagline:
      "Fair picks. Loud opinions. Living history — Saturdays that stick.",
    sportBadge: pack.shortLabel.toUpperCase(),
    periodWord: "Week",
    periodProgressHint: "Season weeks — lock before first kickoff",
    primaryPathLabel: "Championship Bracket",
    primaryPathBlurb: "Top half. One path. No excuses.",
    shamePathLabel: "Toilet Bowl",
    shamePathBlurb: "Shame bracket. Still matters.",
    jobCtaIdle: "Make my picks",
    atmosphere: CFB_ATMO,
  };
}

/** Resolve chrome from active league + automatic CFB atmosphere. */
export function resolveHomeChrome(
  sportId?: string | null,
  seasonThemeId?: string | null
): SportHomeChrome {
  const id =
    sportId ||
    getLeague()?.sportId ||
    undefined;
  const pack = getSportPack(normalizeSportId(id));
  const chrome = chromeForPack(pack);
  // Prefer explicit (tests) → painted DOM → automatic resolve (never stored prefs)
  let theme = seasonThemeId || null;
  if (!theme && typeof window !== "undefined") {
    try {
      const {
        getActiveSeasonThemeIdFromDom,
        resolveAutomaticSeasonTheme,
      } = require("../season-theme") as typeof import("../season-theme");
      theme =
        getActiveSeasonThemeIdFromDom() ||
        resolveAutomaticSeasonTheme({
          sportId: pack.id,
          trustedWeek: null,
        });
    } catch {
      theme = null;
    }
  }
  if (pack.id === "cfb") {
    return {
      ...chrome,
      atmosphere: cfbAtmosphereForTheme(theme),
    };
  }
  return chrome;
}

export function isWwcLeague(sportId?: string | null): boolean {
  return normalizeSportId(sportId || getLeague()?.sportId) === "soccer_wwc";
}
