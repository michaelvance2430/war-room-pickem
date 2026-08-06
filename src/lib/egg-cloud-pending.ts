/**
 * Durable pending cloud sync for Easter Egg finds (D-02 P7).
 *
 * Storage key: warroom-egg-cloud-pending-v1
 * Shape: { version: 1, byUser: { [authUuid]: { [discoveryId]: PendingEggEntry } } }
 *
 * Isolation:
 * - Queues live under byUser[authUuid] forever (until success / permanent / stale / explicit wipe).
 * - Do NOT prune other users on account switch.
 * - Do NOT clear on ordinary logout.
 * - Flush only the currently authenticated user; never send A’s ids under B’s session.
 *
 * Backoff:
 * - attempts, lastAttemptAt, nextAttemptAt per entry.
 * - Bounded exponential backoff; flush respects nextAttemptAt unless force=true.
 */

import { isApprovedEasterEggId } from "@/lib/easter-egg-db-catalog-seed";

export const EGG_CLOUD_PENDING_STORAGE_KEY = "warroom-egg-cloud-pending-v1";

/** Drop temporary pending older than this from enqueue age. */
export const EGG_PENDING_STALE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

/** Backoff: base 30s, doubles per attempt, cap 6h */
export const EGG_BACKOFF_BASE_MS = 30_000;
export const EGG_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

export type PendingEggStatus = "pending" | "permanent_rejected";

export type PendingEggEntry = {
  discoveryId: string;
  status: PendingEggStatus;
  enqueuedAt: string; // ISO
  updatedAt: string; // ISO
  attempts: number;
  lastAttemptAt?: string; // ISO
  nextAttemptAt?: string; // ISO — flush skips until this unless force
  lastError?: string;
  lastReason?: string;
};

export type PendingEggStore = {
  version: 1;
  byUser: Record<string, Record<string, PendingEggEntry>>;
};

export function emptyPendingStore(): PendingEggStore {
  return { version: 1, byUser: {} };
}

/**
 * Next delay after `attempts` completed failures (attempts is post-increment count).
 * attempt 1 → base, 2 → 2*base, … capped at EGG_BACKOFF_MAX_MS.
 */
export function computeBackoffMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  const raw = EGG_BACKOFF_BASE_MS * Math.pow(2, n - 1);
  return Math.min(EGG_BACKOFF_MAX_MS, raw);
}

export function computeNextAttemptAtIso(
  attempts: number,
  fromMs = Date.now()
): string {
  return new Date(fromMs + computeBackoffMs(attempts)).toISOString();
}

function canStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readPendingStore(): PendingEggStore {
  if (!canStorage()) return emptyPendingStore();
  try {
    const raw = localStorage.getItem(EGG_CLOUD_PENDING_STORAGE_KEY);
    if (!raw) return emptyPendingStore();
    const parsed = JSON.parse(raw) as PendingEggStore;
    if (!parsed || parsed.version !== 1 || typeof parsed.byUser !== "object") {
      return emptyPendingStore();
    }
    return parsed;
  } catch {
    return emptyPendingStore();
  }
}

export function writePendingStore(store: PendingEggStore): void {
  if (!canStorage()) return;
  try {
    localStorage.setItem(EGG_CLOUD_PENDING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Explicit local-data wipe only (account deletion / “clear site data” product path).
 * NOT for ordinary logout or account switch.
 */
export function clearPendingForUser(userId: string): void {
  if (!userId) return;
  const store = readPendingStore();
  delete store.byUser[userId];
  writePendingStore(store);
}

/**
 * IDs ready for automatic flush for this user only.
 * - status pending
 * - approved catalog id
 * - not stale by enqueuedAt
 * - nextAttemptAt <= now (unless force)
 */
export function listPendingRetryIds(
  userId: string,
  opts?: { force?: boolean; nowMs?: number }
): string[] {
  if (!userId) return [];
  const force = opts?.force === true;
  const nowMs = opts?.nowMs ?? Date.now();
  const store = readPendingStore();
  const map = store.byUser[userId] || {};
  const out: string[] = [];
  let mutated = false;

  for (const [id, entry] of Object.entries(map)) {
    if (entry.status === "permanent_rejected") continue;
    if (!isApprovedEasterEggId(id)) {
      delete map[id];
      mutated = true;
      continue;
    }
    const enq = Date.parse(entry.enqueuedAt);
    if (Number.isFinite(enq) && nowMs - enq > EGG_PENDING_STALE_MS) {
      delete map[id];
      mutated = true;
      continue;
    }
    if (!force && entry.nextAttemptAt) {
      const next = Date.parse(entry.nextAttemptAt);
      if (Number.isFinite(next) && next > nowMs) continue;
    }
    out.push(id);
  }

  if (mutated) {
    store.byUser[userId] = map;
    writePendingStore(store);
  }
  return out.sort();
}

/** First enqueue or re-queue after temporary fail without burning an attempt. */
export function enqueuePendingEgg(
  userId: string,
  discoveryId: string,
  meta?: { error?: string; reason?: string; nowMs?: number }
): boolean {
  if (!userId || !isApprovedEasterEggId(discoveryId)) return false;
  const store = readPendingStore();
  const map = store.byUser[userId] || {};
  const prev = map[discoveryId];
  if (prev?.status === "permanent_rejected") return false;

  const nowMs = meta?.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();

  // New enqueue: eligible immediately (nextAttemptAt = now).
  // Existing pending after fail is updated via markPendingAttemptWithBackoff.
  if (!prev || prev.status !== "pending") {
    map[discoveryId] = {
      discoveryId,
      status: "pending",
      enqueuedAt: now,
      updatedAt: now,
      attempts: 0,
      nextAttemptAt: now,
      lastError: meta?.error,
      lastReason: meta?.reason,
    };
  } else {
    // Already pending — keep schedule; only refresh error metadata if provided
    map[discoveryId] = {
      ...prev,
      updatedAt: now,
      lastError: meta?.error ?? prev.lastError,
      lastReason: meta?.reason ?? prev.lastReason,
    };
  }

  store.byUser[userId] = map;
  writePendingStore(store);
  return true;
}

/**
 * Record a completed temporary-failure attempt and schedule nextAttemptAt.
 * Does not recurse into flush.
 */
export function markPendingAttemptWithBackoff(
  userId: string,
  discoveryId: string,
  meta?: { error?: string; reason?: string; nowMs?: number }
): PendingEggEntry | null {
  if (!userId || !discoveryId) return null;
  const store = readPendingStore();
  const map = store.byUser[userId] || {};
  let prev = map[discoveryId];
  if (prev?.status === "permanent_rejected") return prev;

  const nowMs = meta?.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();

  if (!prev) {
    if (!isApprovedEasterEggId(discoveryId)) return null;
    prev = {
      discoveryId,
      status: "pending",
      enqueuedAt: now,
      updatedAt: now,
      attempts: 0,
    };
  }

  const attempts = (prev.attempts || 0) + 1;
  const entry: PendingEggEntry = {
    ...prev,
    status: "pending",
    updatedAt: now,
    attempts,
    lastAttemptAt: now,
    nextAttemptAt: computeNextAttemptAtIso(attempts, nowMs),
    lastError: meta?.error ?? prev.lastError,
    lastReason: meta?.reason ?? prev.lastReason,
  };
  map[discoveryId] = entry;
  store.byUser[userId] = map;
  writePendingStore(store);
  return entry;
}

export function markPendingPermanentRejected(
  userId: string,
  discoveryId: string,
  meta?: { error?: string; reason?: string; nowMs?: number }
): void {
  if (!userId || !discoveryId) return;
  const store = readPendingStore();
  const map = store.byUser[userId] || {};
  const nowMs = meta?.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const prev = map[discoveryId];
  map[discoveryId] = {
    discoveryId,
    status: "permanent_rejected",
    enqueuedAt: prev?.enqueuedAt || now,
    updatedAt: now,
    attempts: (prev?.attempts || 0) + 1,
    lastAttemptAt: now,
    nextAttemptAt: undefined,
    lastError: meta?.error,
    lastReason: meta?.reason || "rpc_rejected",
  };
  store.byUser[userId] = map;
  writePendingStore(store);
}

/** Remove pending marker after confirmed cloud success. */
export function clearPendingEgg(userId: string, discoveryId: string): void {
  if (!userId || !discoveryId) return;
  const store = readPendingStore();
  const map = store.byUser[userId];
  if (!map || !map[discoveryId]) return;
  delete map[discoveryId];
  store.byUser[userId] = map;
  writePendingStore(store);
}

export function getPendingEntry(
  userId: string,
  discoveryId: string
): PendingEggEntry | null {
  if (!userId || !discoveryId) return null;
  return readPendingStore().byUser[userId]?.[discoveryId] ?? null;
}
