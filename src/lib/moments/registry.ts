/**
 * Moment registry — every future tradition plugs in here.
 * First Moment: Season Opening (CFB / NFL sport packs).
 */

import type { MomentDefinition } from "./types";

/** College Football Opening — Saturday / GameDay energy */
export const MOMENT_SEASON_OPEN_CFB: MomentDefinition = {
  id: "season_open_cfb",
  name: "College Football Opening",
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

/** NFL Kickoff Opening — prime time / Opening Weekend */
export const MOMENT_SEASON_OPEN_NFL: MomentDefinition = {
  id: "season_open_nfl",
  name: "NFL Kickoff Opening",
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
