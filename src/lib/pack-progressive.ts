/**
 * Pack-level progressive timing — short event packs unlock sooner.
 * CFB/NFL keep the full-season cadence.
 */

import { getLeague } from "@/lib/league";
import { getSportPack } from "@/lib/sports/registry";
import { cutLockWeek } from "@/lib/season-calendar";

export type PackProgressiveConfig = {
  /** Active week ≥ this → Gazette shelf eligible */
  gazetteMinWeek: number;
  /** Scored weeks ≥ this → Gazette shelf eligible */
  gazetteMinScored: number;
  /** Weeks before cut when cut-line door can fire */
  cutApproachLead: number;
  /** Season is "short event" style */
  shortSeason: boolean;
};

/**
 * Resolve progressive thresholds for a sport pack.
 * Short packs (≤8 default weeks, e.g. WWC shell): unlock paper shelf earlier.
 */
export function packProgressiveConfig(
  sportId?: string | null
): PackProgressiveConfig {
  const id = sportId ?? getLeague()?.sportId ?? "cfb";
  const pack = getSportPack(id as Parameters<typeof getSportPack>[0]);
  const weeks = pack?.defaultSeasonWeeks ?? 18;
  const shortSeason = weeks <= 8;

  if (shortSeason) {
    return {
      gazetteMinWeek: 2,
      gazetteMinScored: 1,
      cutApproachLead: 1,
      shortSeason: true,
    };
  }

  // Full football seasons — paper shelf after first scored week (was 2)
  return {
    gazetteMinWeek: 2,
    gazetteMinScored: 1,
    cutApproachLead: 2,
    shortSeason: false,
  };
}

/** Gazette / News shelf timing (replaces hard-coded week 3). */
export function isGazetteShelfTiming(opts: {
  activeWeek: number;
  scoredCount: number;
  sportId?: string | null;
}): boolean {
  const c = packProgressiveConfig(opts.sportId);
  return (
    opts.scoredCount >= c.gazetteMinScored ||
    opts.activeWeek >= c.gazetteMinWeek
  );
}

/** Cut-line door: approaching cut using pack lead weeks. */
export function isCutApproachingForPack(opts: {
  activeWeek: number;
  scoredCount: number;
  sportId?: string | null;
}): boolean {
  const c = packProgressiveConfig(opts.sportId);
  const cut = cutLockWeek(opts.sportId);
  // Short seasons: cut may still be high if using CFB calendar — clamp approach to mid-pack
  const approachAt = Math.max(1, cut - c.cutApproachLead);
  const scoredApproach = Math.max(0, cut - c.cutApproachLead);
  return opts.activeWeek >= approachAt || opts.scoredCount >= scoredApproach;
}
