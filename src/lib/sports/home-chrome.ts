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
};

const WWC_ATMO: SportAtmosphere = {
  baseGradient:
    "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(236, 72, 153, 0.22), transparent 50%), radial-gradient(ellipse 60% 50% at 100% 80%, rgba(56, 189, 248, 0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 70%, rgba(167, 139, 250, 0.16), transparent 50%), #07050c",
  gridLine: "rgba(244,114,182,0.06)",
  vignette:
    "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)",
  scanline:
    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 3px)",
  titleGlow: "drop-shadow-[0_0_34px_rgba(236,72,153,0.28)]",
  accentHex: "#f472b6",
};

function chromeForPack(pack: SportPack): SportHomeChrome {
  const sportId = pack.id;

  if (sportId === "soccer_wwc") {
    return {
      sportId,
      pack,
      welcomeTitle: "Welcome to the War Room",
      defaultTagline:
        "Same clubhouse. Global stage. Lock the card, roast the room, chase the Cup.",
      sportBadge: "WOMEN'S WORLD CUP",
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

  // Default / CFB gold standard
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

/** Resolve chrome from active league (local cache). */
export function resolveHomeChrome(
  sportId?: string | null
): SportHomeChrome {
  const id =
    sportId ||
    getLeague()?.sportId ||
    undefined;
  const pack = getSportPack(normalizeSportId(id));
  return chromeForPack(pack);
}

export function isWwcLeague(sportId?: string | null): boolean {
  return normalizeSportId(sportId || getLeague()?.sportId) === "soccer_wwc";
}
