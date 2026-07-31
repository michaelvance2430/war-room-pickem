/**
 * Client store: who has a live “just joined” badge (24h from membership join).
 * Hydrated once per session / league; PlayerLink reads by userId.
 */

import {
  computeJoinTitles,
  isJustJoined,
  JUST_JOINED_MS,
  justJoinedBadgeLabel,
  type JoinTitleMember,
} from "./join-titles";

export type JoinBadgeEntry = {
  label: string;
  joinedAt: string;
  /** When the badge expires (ms) */
  expiresAtMs: number;
};

type Store = {
  leagueId: string | null;
  byUser: Map<string, JoinBadgeEntry>;
  loadedAt: number;
};

const store: Store = {
  leagueId: null,
  byUser: new Map(),
  loadedAt: 0,
};

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeJoinBadges(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJoinBadgeSnapshot(): Map<string, JoinBadgeEntry> {
  return store.byUser;
}

/** Live badge for a user, or null if expired / unknown. */
export function getJustJoinedBadge(
  userId: string | null | undefined,
  nowMs = Date.now()
): string | null {
  if (!userId) return null;
  const row = store.byUser.get(userId);
  if (!row) return null;
  if (nowMs >= row.expiresAtMs) {
    store.byUser.delete(userId);
    return null;
  }
  if (!isJustJoined(row.joinedAt, nowMs)) {
    store.byUser.delete(userId);
    return null;
  }
  return row.label;
}

/**
 * Rebuild from roster (membership joinedAt + join-order titles).
 * Bots never get a just-joined pill.
 */
export function hydrateJoinBadges(
  leagueId: string,
  members: JoinTitleMember[],
  nowMs = Date.now()
) {
  if (!leagueId) return;
  const titles = computeJoinTitles(members);
  const next = new Map<string, JoinBadgeEntry>();

  for (const m of members) {
    if (!m.userId || m.isBot) continue;
    if (!isJustJoined(m.joinedAt, nowMs)) continue;
    const joinedAt = m.joinedAt!;
    const joinedMs = new Date(joinedAt).getTime();
    const title = titles.get(m.userId) || null;
    next.set(m.userId, {
      label: justJoinedBadgeLabel(title),
      joinedAt,
      expiresAtMs: joinedMs + JUST_JOINED_MS,
    });
  }

  store.leagueId = leagueId;
  store.byUser = next;
  store.loadedAt = nowMs;
  notify();
}

export function clearJoinBadges() {
  store.leagueId = null;
  store.byUser = new Map();
  store.loadedAt = 0;
  notify();
}
