/**
 * Which sport desk you're looking at when you have multi-sport rooms.
 * Home / Account only list leagues for this sport — no football when
 * you're in baseball season, etc.
 */

import { getLeague, getSession } from "@/lib/league";
import type { SportId } from "@/lib/sports/types";
import { getSportPack, normalizeSportId } from "@/lib/sports/registry";

const KEY = "warroom-sport-room-scope-v1";
export const EVENT_SPORT_ROOM_SCOPE = "warroom-sport-room-scope";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Last sport desk the user chose (may be stale if they left all rooms). */
export function getStoredSportScope(): SportId | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeSportId(raw);
  } catch {
    return null;
  }
}

export function setSportScope(sportId: string | null | undefined): void {
  if (!canUse()) return;
  const id = normalizeSportId(sportId);
  try {
    localStorage.setItem(KEY, id);
    window.dispatchEvent(
      new CustomEvent(EVENT_SPORT_ROOM_SCOPE, { detail: id })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Resolve which sport desk to show.
 * Prefer stored scope if user still has a room in that sport;
 * else active league sport; else first available.
 */
export function resolveSportScope(opts: {
  membershipSportIds: string[];
  activeSportId?: string | null;
}): SportId {
  const available = [
    ...new Set(
      opts.membershipSportIds.map((s) => normalizeSportId(s || "cfb"))
    ),
  ];
  if (!available.length) {
    return normalizeSportId(
      opts.activeSportId || getLeague()?.sportId || "cfb"
    );
  }

  const stored = getStoredSportScope();
  if (stored && available.includes(stored)) return stored;

  const active = normalizeSportId(
    opts.activeSportId || getLeague()?.sportId || available[0]
  );
  if (available.includes(active)) return active;

  return available[0];
}

/** Sync scope to active league's sport (after switch / create). */
export function syncSportScopeToActiveLeague(): void {
  const sport = getLeague()?.sportId;
  if (sport) setSportScope(sport);
}

export function sportScopeLabel(sportId: string | null | undefined): string {
  return getSportPack(sportId).shortLabel;
}

export function sportScopeEmoji(sportId: string | null | undefined): string {
  return getSportPack(sportId).emoji;
}

/** Player id helper for future per-user scope if needed */
export function scopeKeyForUser(): string | null {
  return getSession()?.playerId || null;
}
