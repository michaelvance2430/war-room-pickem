/**
 * Moment registry — every future tradition plugs in here.
 * First Moment: Season Opening (CFB / NFL sport packs).
 */

import type { MomentDefinition } from "./types";

/**
 * 🔒 FROZEN Tier I Tradition — Season Opening (CFB).
 * Change only with unanimous Tradition protection approval.
 * Ship freeze: 0b884c0 · Do not keep polishing.
 */
export const MOMENT_SEASON_OPEN_CFB: MomentDefinition = {
  id: "season_open_cfb",
  name: "College Football Opening",
  tier: "tradition",
  frozen: true,
  category: "season_begins",
  purpose:
    "Mark that CFB season has officially begun in this room — annual tradition, not a login animation.",
  emotionalWeight: 5,
  supportedSports: ["cfb"],
  priority: 10,
  animation: "full_ceremony",
  replayPolicy: "once_per_user_league_season",
  blocksNavigation: true,
  /** ~7.5s — peak budget includes silence after Practice line */
  durationTargetMs: 7600,
  foundryPreview: true,
};

/**
 * 🔒 FROZEN Tier I Tradition — Season Opening (NFL).
 * Change only with unanimous Tradition protection approval.
 */
export const MOMENT_SEASON_OPEN_NFL: MomentDefinition = {
  id: "season_open_nfl",
  name: "NFL Kickoff Opening",
  tier: "tradition",
  frozen: true,
  category: "season_begins",
  purpose:
    "Mark that the NFL season has officially begun in this room — Opening Weekend energy.",
  emotionalWeight: 5,
  supportedSports: ["nfl"],
  priority: 10,
  animation: "full_ceremony",
  replayPolicy: "once_per_user_league_season",
  blocksNavigation: true,
  durationTargetMs: 7600,
  foundryPreview: true,
};

const ALL: MomentDefinition[] = [
  MOMENT_SEASON_OPEN_CFB,
  MOMENT_SEASON_OPEN_NFL,
];

export function getMomentDefinition(id: string): MomentDefinition | null {
  return ALL.find((m) => m.id === id) || null;
}

export function listMoments(): MomentDefinition[] {
  return [...ALL];
}

export function seasonOpenMomentIdForSport(
  sportId: string | null | undefined
): "season_open_cfb" | "season_open_nfl" {
  return sportId === "nfl" ? "season_open_nfl" : "season_open_cfb";
}
