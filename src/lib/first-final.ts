/**
 * Rare badge: First & Final
 * Lock a full card before every other human in the league that week,
 * then never change the slip. Edit after lock → lose that week's claim
 * (and the badge if you have no other clean weeks).
 */

import type { UserPick } from "./types";
import {
  grantPermanentBadgeId,
  revokePermanentBadgeId,
} from "./permanent-badges";

export const FIRST_FINAL_BADGE_ID = "first_and_final";

const KEY = "warroom-first-final-v1";

type WeekClaim = {
  /** Fingerprint of the slip at first lock */
  hash: string;
  /** Still clean (no edits after first lock) */
  clean: boolean;
  /** Were you first among humans? */
  wasFirst: boolean;
  weekNumber: number;
  leagueId: string;
};

type Store = Record<string, WeekClaim[]>;

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Store) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Stable fingerprint of a full slip — any pick change changes this. */
export function slipFingerprint(
  picks: Record<string, UserPick>,
  bestBetId: string | null,
  propChoice: string | null
): string {
  const keys = Object.keys(picks).sort();
  const body = keys
    .map((id) => {
      const p = picks[id];
      return `${id}:${p.pick}:${p.confidence}:${p.isBestBet ? 1 : 0}`;
    })
    .join("|");
  return `${body}||bb:${bestBetId || ""}||prop:${propChoice || ""}`;
}

function claimKey(leagueId: string, weekNumber: number) {
  return `${leagueId}:${weekNumber}`;
}

function listFor(userId: string): WeekClaim[] {
  return readAll()[userId] || [];
}

function saveFor(userId: string, claims: WeekClaim[]) {
  const map = readAll();
  map[userId] = claims;
  writeAll(map);
}

/** Any clean first-lock week still counts → badge earned. */
export function hasCleanFirstFinal(userId: string): boolean {
  if (!userId) return false;
  return listFor(userId).some((c) => c.wasFirst && c.clean);
}

export function countCleanFirstFinalWeeks(userId: string): number {
  if (!userId) return 0;
  return listFor(userId).filter((c) => c.wasFirst && c.clean).length;
}

/** Drop all First & Final claims for a league (sandbox season reset). */
export function clearFirstFinalForLeague(leagueId: string): void {
  if (!leagueId) return;
  const map = readAll();
  let changed = false;
  for (const userId of Object.keys(map)) {
    const next = (map[userId] || []).filter((c) => c.leagueId !== leagueId);
    if (next.length !== (map[userId] || []).length) {
      map[userId] = next;
      changed = true;
      syncPermanent(userId);
    }
  }
  if (changed) writeAll(map);
}

function syncPermanent(userId: string) {
  if (hasCleanFirstFinal(userId)) {
    grantPermanentBadgeId(userId, FIRST_FINAL_BADGE_ID);
  } else {
    revokePermanentBadgeId(userId, FIRST_FINAL_BADGE_ID);
  }
}

/**
 * After a successful cloud save.
 * isFirstSave: no picks row existed before this save.
 * wasFirstInLeague: earliest human lock for this week (claim table / RPC).
 */
export function onPicksSavedForFirstFinal(opts: {
  userId: string;
  leagueId: string;
  weekNumber: number;
  isFirstSave: boolean;
  wasFirstInLeague: boolean;
  picks: Record<string, UserPick>;
  bestBetId: string | null;
  propChoice: string | null;
}): { status: "earned" | "held" | "forfeit" | "not_first" | "ignored" } {
  const { userId, leagueId, weekNumber, isFirstSave, wasFirstInLeague } = opts;
  if (!userId || !leagueId) return { status: "ignored" };

  const hash = slipFingerprint(opts.picks, opts.bestBetId, opts.propChoice);
  const claims = listFor(userId);
  const idx = claims.findIndex(
    (c) => c.leagueId === leagueId && c.weekNumber === weekNumber
  );
  const existing = idx >= 0 ? claims[idx] : null;

  // Re-save of an existing week
  if (!isFirstSave || existing) {
    if (!existing) {
      // Had a cloud row but no local claim (other device) — re-save can't earn first
      return { status: "ignored" };
    }
    if (!existing.wasFirst) {
      return { status: "not_first" };
    }
    if (existing.hash === hash && existing.clean) {
      syncPermanent(userId);
      return { status: "held" };
    }
    // Slip changed — forfeit this week
    claims[idx] = { ...existing, clean: false, hash };
    saveFor(userId, claims);
    syncPermanent(userId);
    return { status: "forfeit" };
  }

  // Brand-new first lock for this week
  const claim: WeekClaim = {
    hash,
    clean: true,
    wasFirst: wasFirstInLeague,
    weekNumber,
    leagueId,
  };
  if (idx >= 0) claims[idx] = claim;
  else claims.push(claim);
  saveFor(userId, claims);
  syncPermanent(userId);

  if (wasFirstInLeague) return { status: "earned" };
  return { status: "not_first" };
}

/** For badge evaluate / shelf. */
export function firstFinalEarned(userId: string): boolean {
  return hasCleanFirstFinal(userId);
}
