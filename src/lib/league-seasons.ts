/**
 * Seasons a player finished (or meaningfully played) in a given room.
 * Keyed only by league UUID — renames do not break the streak.
 *
 * Use for any "X seasons in the same league" cheevo / loyalty counter.
 */

import {
  roomIdentityKey,
  roomSeasonKey,
  parseRoomSeasonKey,
  type RoomIdentity,
} from "./league-room-identity";
import { defaultSeasonYear } from "./trophies";

const KEY = "warroom-league-seasons-v1";

/** Min weeks played in a season for it to count toward room loyalty */
export const LEAGUE_SEASON_MIN_WEEKS = 6;

type LeagueRow = {
  /** Season years stamped for this league UUID */
  years: number[];
  /** Last known invite code (metadata only) */
  code?: string | null;
};

type Store = Record<string, Record<string, LeagueRow>>; // playerId → leagueId → row

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(map: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Distinct season years finished in one room (by league UUID). */
export function getSeasonsInLeague(
  playerId: string,
  leagueId: string
): number[] {
  const id = roomIdentityKey(leagueId);
  if (!playerId || !id) return [];
  const years = readAll()[playerId]?.[id]?.years || [];
  return [...years].sort((a, b) => a - b);
}

export function getSeasonsInLeagueCount(
  playerId: string,
  leagueId: string
): number {
  return getSeasonsInLeague(playerId, leagueId).length;
}

/**
 * Best "same room" season count across all leagues this player has.
 * Useful for progress UI without a specific room context.
 */
export function getBestSameLeagueSeasonCount(playerId: string): number {
  if (!playerId) return 0;
  const byLeague = readAll()[playerId];
  if (!byLeague) return 0;
  let best = 0;
  for (const row of Object.values(byLeague)) {
    best = Math.max(best, (row.years || []).length);
  }
  return best;
}

/**
 * Stamp that this player completed a season in this room.
 * Identity = league UUID only. Name is ignored; code is optional metadata.
 */
export function recordSeasonInLeague(opts: {
  playerId: string;
  leagueId: string;
  seasonYear?: number;
  /** Invite code snapshot only — never used as the key */
  code?: string | null;
  /** Weeks played this season; if set, must meet LEAGUE_SEASON_MIN_WEEKS */
  weeksPlayed?: number;
}): { recorded: boolean; seasonsInRoom: number } {
  const { playerId } = opts;
  const leagueId = roomIdentityKey(opts.leagueId);
  if (!playerId || !leagueId) {
    return { recorded: false, seasonsInRoom: 0 };
  }

  if (
    typeof opts.weeksPlayed === "number" &&
    opts.weeksPlayed < LEAGUE_SEASON_MIN_WEEKS
  ) {
    return {
      recorded: false,
      seasonsInRoom: getSeasonsInLeagueCount(playerId, leagueId),
    };
  }

  const year = opts.seasonYear ?? defaultSeasonYear();
  const all = readAll();
  if (!all[playerId]) all[playerId] = {};
  const row: LeagueRow = all[playerId][leagueId] || { years: [] };
  const set = new Set(row.years || []);
  const had = set.has(year);
  set.add(year);
  row.years = Array.from(set).sort((a, b) => a - b);
  if (opts.code) row.code = opts.code.trim() || row.code;
  all[playerId][leagueId] = row;
  writeAll(all);

  return {
    recorded: !had,
    seasonsInRoom: row.years.length,
  };
}

/**
 * Active session helper — stamps current room/year if the player has enough weeks.
 */
export function syncLeagueSeasonFromSession(opts: {
  playerId: string;
  leagueId: string;
  weeksPlayed: number;
  code?: string | null;
  seasonYear?: number;
}): number {
  const r = recordSeasonInLeague({
    playerId: opts.playerId,
    leagueId: opts.leagueId,
    weeksPlayed: opts.weeksPlayed,
    code: opts.code,
    seasonYear: opts.seasonYear,
  });
  return r.seasonsInRoom;
}

/** Debug / profile: all rooms with season counts (UUID keys). */
export function listLeagueSeasonCounts(
  playerId: string
): { leagueId: string; seasons: number; years: number[]; code?: string | null }[] {
  if (!playerId) return [];
  const by = readAll()[playerId] || {};
  return Object.entries(by)
    .map(([leagueId, row]) => ({
      leagueId,
      seasons: (row.years || []).length,
      years: [...(row.years || [])],
      code: row.code,
    }))
    .sort((a, b) => b.seasons - a.seasons);
}

/** Room season key helper re-export for stacks / badges */
export { roomSeasonKey, parseRoomSeasonKey, roomIdentityKey };
export type { RoomIdentity };
