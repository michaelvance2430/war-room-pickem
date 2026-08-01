/**
 * Permanent badge grants (survive reloads).
 * Keyed by player/user id so live Supabase UUIDs work, not just local mock ids.
 *
 * Sandbox: only creator + prior-season Legend can stick; sim grants are blocked
 * and wiped on season reset.
 */

import {
  isSandboxMode,
  isSandboxProtectedBadge,
} from "./season-mode";

const KEY = "warroom-permanent-badges";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Record<string, string[]> {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, string[]>) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getPermanentBadgeIds(playerId: string): string[] {
  if (!playerId) return [];
  return readAll()[playerId] || [];
}

/** Merge storage + any ids already on the player object. */
export function mergePermanentBadges(
  playerId: string,
  existing?: string[] | null
): string[] {
  const fromStore = getPermanentBadgeIds(playerId);
  const set = new Set([...(existing || []), ...fromStore]);
  return Array.from(set);
}

/** Grant forever. Returns true if newly granted. */
export function grantPermanentBadgeId(
  playerId: string,
  badgeId: string,
  opts?: { leagueId?: string | null }
): boolean {
  if (!playerId || !badgeId) return false;
  // Dry-run / preseason: don't stick First & Final, Elite Commish, Cheevo King, etc.
  if (isSandboxMode() && !isSandboxProtectedBadge(badgeId)) {
    return false;
  }
  const map = readAll();
  const list = map[playerId] || [];
  if (list.includes(badgeId)) return false;
  map[playerId] = [...list, badgeId];
  writeAll(map);

  // Track league provenance for early-leave forfeit
  try {
    const {
      activeLeagueIdForEarn,
      recordLeagueEarnedBadge,
    } = require("./league-earned-ledger") as typeof import("./league-earned-ledger");
    const lid = opts?.leagueId ?? activeLeagueIdForEarn();
    if (lid) recordLeagueEarnedBadge(playerId, lid, badgeId);
  } catch {
    /* ignore */
  }

  return true;
}

/** Strip non-protected permanent grants (sandbox reset). */
export function stripSandboxPermanentBadges(playerId: string): string[] {
  if (!playerId) return [];
  const map = readAll();
  const list = map[playerId] || [];
  if (!list.length) return [];
  const kept = list.filter((id) => isSandboxProtectedBadge(id));
  const removed = list.filter((id) => !isSandboxProtectedBadge(id));
  if (removed.length) {
    map[playerId] = kept;
    writeAll(map);
  }
  return removed;
}

/** All player ids that have any permanent badge entry (for wipe fan-out). */
export function listPermanentBadgePlayerIds(): string[] {
  return Object.keys(readAll());
}

/** Remove a permanent grant (e.g. First & Final after editing picks). */
export function revokePermanentBadgeId(
  playerId: string,
  badgeId: string
): boolean {
  if (!playerId || !badgeId) return false;
  const map = readAll();
  const list = map[playerId] || [];
  if (!list.includes(badgeId)) return false;
  map[playerId] = list.filter((id) => id !== badgeId);
  writeAll(map);
  return true;
}
