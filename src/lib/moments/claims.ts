/**
 * Local claim store for one-shot Moments.
 * Cloud user_season_moments can layer later — local is the production guard today.
 */

import type { MomentClaimIdentity } from "./types";

const STORE_KEY = "warroom-moment-claims-v1";
const SESSION_PREFIX = "warroom-moment-session-";

type ClaimRow = {
  claimedAt: string;
  speechId?: string;
  metadata?: Record<string, string>;
};

type Store = Record<string, ClaimRow>;

function canUse() {
  return typeof window !== "undefined";
}

function claimKey(id: MomentClaimIdentity): string {
  return [
    id.momentId,
    id.userId,
    id.leagueId,
    id.sportId,
    id.seasonKey,
  ].join(":");
}

function readStore(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function isMomentClaimed(id: MomentClaimIdentity): boolean {
  return !!readStore()[claimKey(id)];
}

export function getMomentClaim(id: MomentClaimIdentity): ClaimRow | null {
  return readStore()[claimKey(id)] || null;
}

/**
 * Idempotent claim. Returns true if this call owns the show (new claim).
 * Returns false if already claimed.
 */
export function claimMoment(
  id: MomentClaimIdentity,
  opts?: { speechId?: string; metadata?: Record<string, string> }
): boolean {
  const key = claimKey(id);
  const store = readStore();
  if (store[key]) return false;
  store[key] = {
    claimedAt: new Date().toISOString(),
    speechId: opts?.speechId,
    metadata: opts?.metadata,
  };
  writeStore(store);
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, "1");
  } catch {
    /* ok */
  }
  return true;
}

/** Foundry: clear claim so Mike can re-live a production path */
export function clearMomentClaim(id: MomentClaimIdentity): void {
  const key = claimKey(id);
  const store = readStore();
  delete store[key];
  writeStore(store);
  try {
    sessionStorage.removeItem(SESSION_PREFIX + key);
  } catch {
    /* ok */
  }
}

export function wasMomentClaimedThisSession(id: MomentClaimIdentity): boolean {
  if (!canUse()) return false;
  try {
    return sessionStorage.getItem(SESSION_PREFIX + claimKey(id)) === "1";
  } catch {
    return false;
  }
}
