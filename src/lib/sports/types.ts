/**
 * Sport pack contracts — multi-sport War Room.
 * Shared clubhouse; each sport is a pack (calendar, markets, copy, badges…).
 */

export type SportId =
  | "cfb"
  | "nfl"
  | "nba"
  | "nhl"
  | "march_madness"
  | "nascar"
  | "mlb"
  | "soccer"
  | "soccer_wwc";

export type SportPackStatus = "live" | "coming_soon" | "hidden";

/** What commissioners see when creating a league. */
export type SportPickerOption = {
  id: SportId;
  label: string;
  shortLabel: string;
  emoji: string;
  blurb: string;
  /** Sort order in create-league list */
  sortOrder: number;
  status: SportPackStatus;
};

/** Runtime pack surface (expand as packs land). */
export type SportPack = SportPickerOption & {
  /** Default regular-season length hint for UI */
  defaultSeasonWeeks: number;
  defaultGamesPerWeek: number;
  /** Crystal Ball / pride pick label */
  pridePickLabel: string;
  rulesOneLiner: string;
};

export const DEFAULT_SPORT_ID: SportId = "cfb";
